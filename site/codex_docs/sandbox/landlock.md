# 7. Linux Landlock + Bubblewrap 沙箱

> 源码位置: `codex-rs/core/src/landlock.rs`, `codex-rs/linux-sandbox/`, `codex-rs/sandboxing/src/landlock/`

## 概述

Linux 上，Codex 使用 Landlock（文件系统隔离）+ Bubblewrap（命名空间隔离）+ Seccomp（系统调用过滤）的组合实现沙箱。

## 底层原理

### 三重隔离

```
Landlock（Linux 5.13+）
  ├── 文件系统访问控制
  ├── 限制进程可以访问的路径
  └── 内核级，无法从用户空间绕过

Bubblewrap (bwrap)
  ├── 命名空间隔离（mount, pid, network, user）
  ├── 创建隔离的文件系统视图
  └── 用户空间工具，但利用内核命名空间

Seccomp
  ├── 系统调用过滤
  ├── 限制进程可以使用的系统调用
  └── 禁止：ptrace, mount, reboot 等危险调用
```

### 执行流程

```rust
// landlock.rs

pub async fn spawn_command_under_linux_sandbox(
    codex_linux_sandbox_exe: P,  // codex-linux-sandbox 可执行文件
    command: Vec<String>,
    command_cwd: PathBuf,
    sandbox_policy: &SandboxPolicy,
    sandbox_policy_cwd: &Path,
    use_legacy_landlock: bool,
    stdio_policy: StdioPolicy,
    network: Option<&NetworkProxy>,
    env: HashMap<String, String>,
) -> std::io::Result<Child> {
    // 1. 从 SandboxPolicy 生成文件系统和网络策略
    let file_system_policy = FileSystemSandboxPolicy::from_legacy_sandbox_policy(
        sandbox_policy, sandbox_policy_cwd
    );
    let network_policy = NetworkSandboxPolicy::from(sandbox_policy);
    
    // 2. 生成 Linux 沙箱命令参数
    let args = create_linux_sandbox_command_args_for_policies(
        command,
        command_cwd.as_path(),
        sandbox_policy,
        &file_system_policy,
        network_policy,
        sandbox_policy_cwd,
        use_legacy_landlock,
        allow_network_for_proxy(false),
    );
    
    // 3. 通过 codex-linux-sandbox 启动命令
    // codex-linux-sandbox 是一个独立的可执行文件
    // 它负责设置 Landlock + Bubblewrap + Seccomp
    spawn_child_async(SpawnChildRequest {
        program: codex_linux_sandbox_exe.to_path_buf(),
        args,
        arg0: Some(CODEX_LINUX_SANDBOX_ARG0),
        cwd: command_cwd,
        network_sandbox_policy: network_policy,
        network,
        stdio_policy,
        env,
    }).await
}
```

### codex-linux-sandbox 可执行文件

```
codex-rs/linux-sandbox/ 是一个独立的 Rust crate

职责：
  1. 解析沙箱策略参数
  2. 设置 Landlock 规则（文件系统隔离）
  3. 设置 Bubblewrap 命名空间（进程隔离）
  4. 设置 Seccomp 过滤器（系统调用限制）
  5. 在隔离环境中执行目标命令

为什么是独立可执行文件？
  - Landlock 需要在进程启动时设置
  - 不能在已运行的进程中动态添加
  - 所以需要一个"沙箱启动器"来包装目标命令
```

### Legacy Landlock vs 新版

```
use_legacy_landlock 参数：
  true  → 使用旧版 Landlock API（兼容 Linux 5.13-5.18）
  false → 使用新版 Landlock API（Linux 5.19+，更多功能）

新版增加的能力：
  - 更细粒度的文件操作控制
  - 网络访问控制（Landlock v4, Linux 6.7+）
```

## 与 macOS Seatbelt 的对比

| 维度 | Linux (Landlock+Bwrap) | macOS (Seatbelt) |
|------|----------------------|------------------|
| 文件系统隔离 | Landlock（内核级） | Seatbelt（内核级） |
| 进程隔离 | Bubblewrap（命名空间） | 无（Seatbelt 不隔离进程） |
| 系统调用过滤 | Seccomp | 无 |
| 策略格式 | JSON（通过命令行参数） | .sb 文件（Scheme 语法） |
| 实现方式 | 独立可执行文件 | sandbox-exec 命令 |
| 内核版本要求 | Linux 5.13+ | macOS 10.5+ |

## 关联知识点

- [沙箱架构总览](/codex_docs/sandbox/architecture) — 三层沙箱体系
- [macOS Seatbelt](/codex_docs/sandbox/seatbelt) — macOS 上的对应实现
- [网络代理隔离](/codex_docs/sandbox/network-proxy) — 网络层隔离

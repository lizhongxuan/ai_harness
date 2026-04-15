# 6. macOS Seatbelt 沙箱

> 源码位置: `codex-rs/core/src/seatbelt.rs`, `codex-rs/sandboxing/src/seatbelt/`, `go_sandbox/seatbelt.go`

## 概述

macOS 上，Codex 使用 Apple 的 Seatbelt（App Sandbox）机制隔离命令执行。通过 `/usr/bin/sandbox-exec` 命令和动态生成的 `.sb` 策略文件实现。

## 底层原理

### 执行流程

```rust
// seatbelt.rs

pub async fn spawn_command_under_seatbelt(
    command: Vec<String>,
    command_cwd: PathBuf,
    sandbox_policy: &SandboxPolicy,
    sandbox_policy_cwd: &Path,
    stdio_policy: StdioPolicy,
    network: Option<&NetworkProxy>,
    env: HashMap<String, String>,
) -> std::io::Result<Child> {
    // 1. 从 SandboxPolicy 生成 Seatbelt 命令参数
    let args = create_seatbelt_command_args_for_policies(
        command,
        &FileSystemSandboxPolicy::from_legacy_sandbox_policy(sandbox_policy, sandbox_policy_cwd),
        NetworkSandboxPolicy::from(sandbox_policy),
        sandbox_policy_cwd,
        false,  // enforce_managed_network
        network,
    );
    
    // 2. 设置沙箱环境变量标记
    env.insert("CODEX_SANDBOX", "seatbelt");
    
    // 3. 通过 /usr/bin/sandbox-exec 启动命令
    spawn_child_async(SpawnChildRequest {
        program: PathBuf::from("/usr/bin/sandbox-exec"),
        args,
        cwd: command_cwd,
        network_sandbox_policy: NetworkSandboxPolicy::from(sandbox_policy),
        network,
        stdio_policy,
        env,
    }).await
}
```

### Seatbelt 策略文件格式

```scheme
;; 由 go_sandbox/seatbelt_policies.go 动态生成

(version 1)
(deny default)                                    ;; 默认拒绝所有操作

;; 文件系统规则
(allow file-read* (subpath "/usr"))               ;; 允许读 /usr
(allow file-read* (subpath "/lib"))               ;; 允许读 /lib
(allow file-read-write* (subpath "/tmp/codex"))   ;; 允许读写工作目录
(deny file-read* (subpath "/Users/xxx/.ssh"))     ;; 禁止读 SSH 密钥
(deny file-read* (subpath "/Users/xxx/.aws"))     ;; 禁止读 AWS 凭证

;; 网络规则
(allow network-outbound
  (remote tcp "github.com:443")                   ;; 允许访问 GitHub
  (remote tcp "registry.npmjs.org:443"))          ;; 允许访问 npm
(deny network*)                                   ;; 禁止其他网络访问

;; 进程规则
(allow process-exec)                              ;; 允许执行子进程
(deny process-info*)                              ;; 禁止查看其他进程信息
```

### Go 沙箱策略生成器

```go
// go_sandbox/seatbelt_policies.go

// 根据 SandboxPolicy 动态生成 .sb 策略文件
// 不同的命令可以有不同的策略
// 策略文件在命令执行前生成，执行后清理
```

### CODEX_SANDBOX 环境变量

```
当命令在 Seatbelt 下运行时：
  CODEX_SANDBOX=seatbelt

用途：
  1. 测试跳过：集成测试检测到已在沙箱中 → 跳过需要嵌套沙箱的测试
  2. 行为调整：某些工具在沙箱中需要不同的行为
  3. 诊断：日志中标记命令是否在沙箱中执行
```

## 设计原因

- **内核级隔离**：Seatbelt 是 macOS 内核的一部分，无法从用户空间绕过
- **动态策略**：每个命令可以有不同的策略，而不是一刀切
- **子进程继承**：sandbox-exec 的子进程自动继承沙箱约束

## 关联知识点

- [沙箱架构总览](/sandbox/architecture) — 三层沙箱体系
- [Linux Landlock](/sandbox/landlock) — Linux 上的对应实现

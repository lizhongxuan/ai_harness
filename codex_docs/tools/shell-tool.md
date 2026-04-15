# 14. Shell 工具

> 源码位置: `codex-rs/core/src/shell.rs`, `codex-rs/core/src/exec.rs`, `codex-rs/core/src/sandboxing/`

## 概述

Shell 工具是 Codex 最核心的工具——执行终端命令。每次执行都经过 Exec Policy 检查 + 沙箱隔离。

## 底层原理

### 执行流程

```
Agent 请求执行命令
  │
  ▼
1. 命令规范化（command_canonicalization.rs）
   - 展开别名
   - 解析管道和链接
   - 标准化路径
  │
  ▼
2. Exec Policy 评估（exec_policy.rs）
   - Starlark 策略引擎评估
   - 返回 allow / prompt / deny
  │
  ▼
3. 用户审批（如果需要）
   - 展示命令内容和原因
   - 等待用户决定
  │
  ▼
4. 沙箱执行（sandboxing/）
   - macOS: Seatbelt
   - Linux: Landlock + Bubblewrap
   - 文件系统和网络隔离
  │
  ▼
5. 结果收集
   - stdout / stderr
   - 退出码
   - 执行时间
  │
  ▼
6. 结果返回给 Agent
```

### Shell 检测

```rust
// shell_detect.rs

// Codex 自动检测用户的 shell 环境：
// - bash / zsh / fish / sh
// - 用于正确设置命令执行环境
// - 确保 PATH 和其他环境变量正确
```

### Shell 快照

```rust
// shell_snapshot.rs

// 在命令执行前后捕获 shell 状态：
// - 环境变量变化
// - 工作目录变化
// - 用于调试和审计
```

## 关联知识点

- [沙箱架构](/sandbox/architecture) — 命令在沙箱中执行
- [策略引擎](/execpolicy/policy-engine) — 命令执行前的策略检查

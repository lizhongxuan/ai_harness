# 4. Hook 系统

> 源码位置: `codex-rs/hooks/`, `codex-rs/core/src/hook_runtime.rs`

## 概述

Codex 的 Hook 系统允许在 Agent 生命周期的关键点注入自定义逻辑。与 Claude Code 的 Hook 系统类似，但实现在 Rust 中，性能更好。

## 底层原理

### Hook 类型

```
Hook 触发点：
  - 命令执行前（pre-exec）
  - 命令执行后（post-exec）
  - 文件修改前（pre-patch）
  - 文件修改后（post-patch）
  - 会话开始/结束
```

### Hook 运行时

```rust
// hook_runtime.rs

// Hook 可以：
// 1. 允许操作继续
// 2. 阻止操作
// 3. 修改操作参数
// 4. 追加上下文信息
```

## 与 Claude Code 的对比

| 维度 | Codex | Claude Code |
|------|-------|------------|
| 实现语言 | Rust | TypeScript |
| Hook 定义 | 配置文件 | JSON 文件 |
| 触发点 | pre/post exec, pre/post patch | PreToolUse, PostToolUse, PermissionRequest, ... |
| 自定义逻辑 | Shell 命令 | Shell 命令 / LLM prompt / Agent |

## 关联知识点

- [事件驱动循环](/agent/event-loop) — Hook 在事件循环中的触发时机
- [审批流程](/execpolicy/approval-flow) — Hook 可以影响审批决策

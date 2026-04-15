# 3. 错误恢复

> 源码位置: `codex-rs/core/src/codex_delegate.rs`, `codex-rs/core/src/compact.rs`

## 概述

Codex 的错误恢复比 Claude Code 简单，但在沙箱相关的错误处理上更精细。核心策略是：**沙箱违规 → 通知用户 → 用户决定是否放宽限制**。

## 底层原理

### 错误分类

| 错误类型 | 来源 | 恢复策略 |
|---------|------|---------|
| 沙箱违规 | 命令触发沙箱限制 | 通知用户，提供放宽选项 |
| API 错误（500/503） | OpenAI API | 重试 |
| 速率限制（429） | OpenAI API | 指数退避 |
| 命令执行失败 | Shell 工具 | 错误回填给模型 |
| Patch 应用失败 | Apply-Patch 工具 | 错误回填给模型 |
| 上下文溢出 | 消息历史太长 | 触发自动压缩 |
| 审批超时 | 用户未响应 | 取消操作 |

### 沙箱违规恢复

```
命令在沙箱中执行
  │
  ▼
沙箱阻止了某个操作（如访问 ~/.ssh）
  │
  ▼
错误信息包含违规原因
  │
  ▼
展示给用户：
  "命令被沙箱阻止：尝试读取 ~/.ssh/id_rsa"
  "是否要为此命令放宽沙箱限制？"
  │
  ├── 用户选择"是" → 更新 exec policy，重试
  └── 用户选择"否" → 错误回填给模型
```

### 审批取消机制

```rust
// codex_delegate.rs

async fn await_approval_with_cancel<F>(
    approval_future: F,
    cancellation_token: CancellationToken,
) -> Result<ApprovalResult> {
    tokio::select! {
        result = approval_future => result,
        _ = cancellation_token.cancelled() => {
            // 用户取消了整个操作
            Ok(ApprovalResult::Cancelled)
        }
    }
}
```

## 与 Claude Code 的对比

| 维度 | Codex | Claude Code |
|------|-------|------------|
| PTL 恢复 | 自动压缩 + 截断 | 7 层防御（collapse → reactive compact） |
| max-output-tokens | 无特殊处理 | 8K→64K 升级 + 多轮恢复 |
| 模型 fallback | 无 | FallbackTriggeredError |
| 沙箱违规 | 通知用户 + 放宽选项 | dangerouslyDisableSandbox |
| 流式错误暂扣 | 无 | 有（withheld errors） |

## 关联知识点

- [自动压缩](/context/auto-compact) — 上下文溢出的恢复
- [策略引擎](/execpolicy/policy-engine) — 沙箱违规后的策略更新

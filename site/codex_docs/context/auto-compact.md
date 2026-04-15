# 12. 自动压缩

> 源码位置: `codex-rs/core/src/compact.rs`, `codex-rs/core/src/compact_remote.rs`

## 概述

Codex 的上下文压缩比 Claude Code 简单得多——没有 7 层防御，而是**自动压缩 + 消息截断**两层。设计哲学是"够用就好"，把复杂性留给沙箱和安全。

## 底层原理

### 压缩流程

```rust
// compact.rs

pub async fn run_compact_task(
    session: &Session,
    items: &[ResponseItem],
    initial_context: InitialContextInjection,
) -> Result<CompactResult> {
    // 1. 收集用户消息（保留原文）
    let user_messages = collect_user_messages(items);
    
    // 2. 将消息历史转换为文本
    let history_text = content_items_to_text(items);
    
    // 3. 调用 LLM 生成摘要
    let summary = call_model_for_summary(history_text).await?;
    
    // 4. 构建压缩后的历史
    let compacted = build_compacted_history(summary, user_messages);
    
    Ok(CompactResult { compacted })
}

// 检查消息是否是摘要（避免重复压缩摘要）
pub fn is_summary_message(message: &str) -> bool {
    message.starts_with("[Summary of previous conversation]")
}

// 构建压缩后的历史
pub fn build_compacted_history(
    summary: String,
    user_messages: Vec<String>,
) -> Vec<ResponseItem> {
    // 摘要 + 保留的用户消息原文
    // 用户消息原文保留是为了让模型知道用户的原始意图
}
```

### 远程压缩

```rust
// compact_remote.rs

// 对于某些 Provider（如 OpenAI），压缩任务可以远程执行
// 这避免了在本地消耗 token 做摘要

pub fn should_use_remote_compact_task(provider: &ModelProviderInfo) -> bool {
    // OpenAI 的 Responses API 支持服务端压缩
    // 其他 Provider 使用本地压缩
}
```

### 消息历史截断

```rust
// thread_rollout_truncation.rs

// 当消息历史超过限制时，从最旧的开始截断
// 保留：
//   - 系统消息
//   - 最近 N 条消息
//   - 摘要消息（如果有）
```

### 与 Claude Code 的对比

| 维度 | Codex | Claude Code |
|------|-------|------------|
| 层级数 | 2（压缩 + 截断） | 7（tool-budget → snip → micro → collapse → auto → blocking → reactive） |
| 触发方式 | 自动（接近上限时） | 分级触发（70%/85%/92%/98%） |
| 摘要方式 | LLM 摘要 | 9 维结构化摘要 |
| 缓存感知 | 无 | 三分区（fresh/frozen/must-reapply） |
| CQRS 分离 | 无 | 有（UI 真相 vs API 真相） |
| 断路器 | 无 | 有 |
| 远程压缩 | 有（OpenAI Responses API） | 无 |

## 设计原因

- **简单优先**：Codex 的设计重心在沙箱安全，不在上下文管理
- **远程压缩**：利用 OpenAI 的服务端能力，减少本地 token 消耗
- **够用就好**：大多数编码任务不需要超长会话

## 关联知识点

- [Token 估算](/codex_docs/context/token-estimate) — 判断何时触发压缩

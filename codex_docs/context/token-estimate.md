# 13. Token 估算

> 源码位置: `codex-rs/core/src/message_history.rs`, `codex-rs/core/src/turn_metadata.rs`

## 概述

Codex 的 token 估算用于判断何时触发自动压缩。由于精确计算 token 需要 API 调用，Codex 使用本地估算 + API 响应校准的策略。

## 底层原理

### 估算策略

```
1. 本地粗估：字符数 / 4 ≈ token 数（英文）
2. API 响应校准：每次 API 调用后用 usage 字段更新估算
3. 消息历史追踪：message_history.rs 维护消息列表和 token 计数
```

### Turn 元数据

```rust
// turn_metadata.rs

// 每轮对话的元数据：
// - token 使用量（input + output）
// - 工具调用次数
// - 执行时间
// - 是否触发了压缩
```

## 关联知识点

- [自动压缩](/context/auto-compact) — token 估算触发压缩

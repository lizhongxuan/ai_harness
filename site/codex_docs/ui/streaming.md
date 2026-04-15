# 18. 流式渲染

> 源码位置: `codex-rs/core/src/stream_events_utils.rs`, `codex-rs/tui/src/chatwidget.rs`

## 概述

Codex 的流式渲染将模型的 SSE 事件实时渲染到终端。Rust 的性能优势在这里体现——即使在高速输出时也能保持流畅。

## 底层原理

### 事件处理

```rust
// stream_events_utils.rs

// 处理 OpenAI Responses API 的 SSE 事件流：
// - response.created
// - response.output_item.added
// - response.content_part.added
// - response.content_part.delta（文本增量）
// - response.function_call_arguments.delta（工具参数增量）
// - response.completed
```

### TUI 渲染

```
SSE 事件流
  │
  ▼
stream_events_utils.rs（解析事件）
  │
  ▼
chatwidget.rs（渲染到终端）
  │
  ├── 文本增量 → 追加到当前消息
  ├── 工具调用 → 显示工具名和参数
  ├── 工具结果 → 显示执行结果
  └── 完成 → 更新状态栏
```

## 关联知识点

- [TUI 架构](/codex_docs/ui/tui-architecture) — 渲染框架
- [Responses API](/codex_docs/api/responses-api) — SSE 事件格式

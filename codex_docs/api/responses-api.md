# 22. Responses API

> 源码位置: `codex-rs/core/src/client.rs`, `codex-rs/core/src/connectors.rs`

## 概述

Codex 优先使用 OpenAI 的 **Responses API**（而不是 Chat Completions API）。Responses API 是 OpenAI 的新一代 API，原生支持工具调用、推理、和流式输出。

## 底层原理

### 为什么用 Responses API

```
Chat Completions API 的问题：
  - GPT-5.x 的工具调用 + 推理在 /v1/chat/completions 上被拒绝
  - 需要额外的消息格式转换
  - 不支持某些新功能（如服务端压缩）

Responses API 的优势：
  - 原生支持工具调用
  - 原生支持推理（reasoning）
  - 支持服务端压缩（remote compact）
  - 更简洁的消息格式
```

### API 模式自动检测

```rust
// 自动检测应该使用哪种 API：

if provider == "openai-codex" {
    api_mode = "codex_responses"
} else if is_direct_openai_url() {
    api_mode = "codex_responses"  // 直连 OpenAI → 用 Responses API
} else if provider == "anthropic" {
    api_mode = "anthropic_messages"
} else {
    api_mode = "chat_completions"  // 其他 Provider → 用 Chat Completions
}
```

### SSE 事件格式

```
Responses API 的 SSE 事件：
  response.created          — 响应开始
  response.output_item.added — 新的输出项（文本/工具调用）
  response.content_part.added — 新的内容块
  response.content_part.delta — 文本增量
  response.function_call_arguments.delta — 工具参数增量
  response.completed        — 响应完成
```

## 与 Claude Code 的对比

| 维度 | Codex | Claude Code |
|------|-------|------------|
| 主要 API | Responses API | Messages API (Anthropic) |
| 备选 API | Chat Completions | 无（只用 Anthropic） |
| 流式协议 | SSE | SSE |
| 服务端压缩 | 支持（remote compact） | 不支持 |
| 推理支持 | 原生 | 原生（extended thinking） |

## 关联知识点

- [Chat Completions 适配](/api/chat-completions) — 非 OpenAI Provider 的适配
- [流式渲染](/ui/streaming) — SSE 事件的渲染

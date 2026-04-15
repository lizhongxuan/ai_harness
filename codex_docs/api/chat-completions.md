# 23. Chat Completions 适配

> 源码位置: `codex-rs/core/src/connectors.rs`, `codex-rs/core/src/client_common.rs`

## 概述

对于非 OpenAI 的 Provider（如 Anthropic、本地模型），Codex 通过适配层将 Responses API 格式转换为 Chat Completions 格式。

## 底层原理

### 适配层

```
Codex 内部统一使用 Responses API 格式
  │
  ▼
connectors.rs — Provider 连接器
  │
  ├── OpenAI → 直接使用 Responses API
  ├── Anthropic → 转换为 Messages API
  ├── 本地模型 → 转换为 Chat Completions
  └── 其他 → 转换为 Chat Completions
```

### 消息格式转换

```
Responses API 格式：
  { type: "message", role: "user", content: [...] }
  { type: "function_call", name: "shell", arguments: "..." }
  { type: "function_call_output", call_id: "...", output: "..." }

Chat Completions 格式：
  { role: "user", content: "..." }
  { role: "assistant", tool_calls: [...] }
  { role: "tool", tool_call_id: "...", content: "..." }
```

## 关联知识点

- [Responses API](/api/responses-api) — 主要 API 格式

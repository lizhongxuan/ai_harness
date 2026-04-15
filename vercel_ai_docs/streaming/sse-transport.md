# 11. SSE 传输

> 源码位置: `packages/ai/src/ui-message-stream/json-to-sse-transform-stream.ts`, `packages/ai/src/text-stream/`

## 概述

Server-Sent Events (SSE) 是 Vercel AI SDK 将流式数据从服务端推送到客户端的传输协议。SDK 提供了 `JsonToSseTransformStream` 将 JSON 对象转换为 SSE 格式，以及 `createTextStreamResponse` / `pipeTextStreamToResponse` 等便捷方法。

## 底层原理

### 传输链路

```mermaid
flowchart LR
    A[streamText] --> B[fullStream<br/>TextStreamPart]
    B --> C[toUIMessageStream<br/>UIMessageChunk]
    C --> D[JsonToSseTransformStream<br/>SSE 格式]
    D --> E[TextEncoderStream<br/>字节流]
    E --> F[HTTP Response<br/>Content-Type: text/event-stream]
    F --> G[客户端<br/>useChat / EventSource]
    
    style D fill:#1a365d,color:#fff
    style F fill:#276749,color:#fff
```

### JsonToSseTransformStream

```typescript
// json-to-sse-transform-stream.ts — 完整源码

class JsonToSseTransformStream extends TransformStream<unknown, string> {
  constructor() {
    super({
      transform(part, controller) {
        // 每个 JSON 对象 → "data: {...}\n\n"
        controller.enqueue(`data: ${JSON.stringify(part)}\n\n`);
      },
      flush(controller) {
        // 流结束 → "data: [DONE]\n\n"
        controller.enqueue('data: [DONE]\n\n');
      },
    });
  }
}

// 输出示例：
// data: {"type":"text-delta","delta":"Hello"}\n\n
// data: {"type":"text-delta","delta":" world"}\n\n
// data: {"type":"finish","finishReason":"stop"}\n\n
// data: [DONE]\n\n
```

### createTextStreamResponse

```typescript
// create-text-stream-response.ts

function createTextStreamResponse({
  status, statusText, headers, textStream,
}: ResponseInit & { textStream: ReadableStream<string> }): Response {
  return new Response(
    textStream.pipeThrough(new TextEncoderStream()),
    {
      status: status ?? 200,
      statusText,
      headers: prepareHeaders(headers, {
        'content-type': 'text/plain; charset=utf-8',
      }),
    },
  );
}
```

### 完整的服务端用法

```typescript
// Next.js App Router 示例

// 方式 1：toUIMessageStreamResponse（最常用）
export async function POST(req: Request) {
  const { messages } = await req.json();
  
  const result = streamText({
    model: openai('gpt-4o'),
    messages,
  });
  
  return result.toUIMessageStreamResponse();
  // 内部流程：fullStream → UIMessageChunk → SSE → Response
}

// 方式 2：toTextStreamResponse（纯文本）
export async function POST(req: Request) {
  const result = streamText({
    model: openai('gpt-4o'),
    prompt: 'Hello',
  });
  
  return result.toTextStreamResponse();
  // 内部流程：textStream → TextEncoder → Response
}

// 方式 3：pipeTextStreamToResponse（Node.js ServerResponse）
export default function handler(req, res) {
  const result = streamText({
    model: openai('gpt-4o'),
    prompt: 'Hello',
  });
  
  result.pipeTextStreamToResponse(res);
}
```

### SSE 协议细节

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type":"start"}

data: {"type":"text-start","id":"0"}

data: {"type":"text-delta","id":"0","delta":"Hello"}

data: {"type":"text-delta","id":"0","delta":" world"}

data: {"type":"text-end","id":"0"}

data: {"type":"finish","finishReason":"stop"}

data: [DONE]
```

### UIMessageStream 的 SSE 响应创建

```typescript
// create-ui-message-stream-response.ts — 简化版

function createUIMessageStreamResponse({ stream, status, headers }) {
  return new Response(
    stream
      .pipeThrough(new JsonToSseTransformStream())  // JSON → SSE
      .pipeThrough(new TextEncoderStream()),          // string → bytes
    {
      status: status ?? 200,
      headers: {
        'content-type': 'text/event-stream',
        'cache-control': 'no-cache',
        'connection': 'keep-alive',
        ...headers,
      },
    },
  );
}
```

### 与 Claude Code / Codex 的对比

| 维度 | Vercel AI SDK | Claude Code | Codex |
|------|--------------|-------------|-------|
| 传输协议 | SSE (HTTP) | 无（终端直接渲染） | 无（终端直接渲染） |
| 数据格式 | JSON over SSE | 不适用 | 不适用 |
| 结束标记 | `data: [DONE]` | 不适用 | 不适用 |
| 客户端 | useChat / EventSource | Ink 组件 | Ratatui 组件 |
| 环境 | Web 浏览器 | 终端 | 终端 |

## 设计原因

- **SSE 而非 WebSocket**：SSE 是单向的，更简单，且与 HTTP/2 兼容
- **JSON 序列化**：结构化数据比纯文本更灵活，支持工具调用、元数据等
- **`[DONE]` 标记**：与 OpenAI API 的 SSE 格式一致，生态兼容
- **多种响应方式**：支持 Web Response（Edge）和 Node.js ServerResponse

## 关联知识点

- [Web Streams 基础](/streaming/web-streams) — TransformStream 原理
- [UIMessageStream](/streaming/ui-message-stream) — SSE 传输的数据源
- [useChat](/ui/use-chat) — 客户端 SSE 消费

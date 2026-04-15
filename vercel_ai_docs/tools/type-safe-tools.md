# 15. 类型安全工具（Type-Safe Tools）

> 参考: `packages/ai/src/generate-text/`, `@ai-sdk/provider-utils`

## 概述

Vercel AI SDK 的工具系统通过 Zod schema 实现编译时类型安全。`tool()` 函数将 Zod schema 与 execute 函数绑定，TypeScript 泛型自动推导参数类型和返回类型，贯穿整个 Agent Loop。

## 底层原理

### 类型流转

```mermaid
flowchart LR
    A[Zod Schema] --> B[tool 函数]
    B --> C[TOOLS 泛型]
    C --> D[generateText<TOOLS>]
    D --> E[executeTools<TOOLS>]
    E --> F[StepResult<TOOLS>]
    F --> G["toolResults: TypedToolResult<TOOLS>[]"]
    
    style A fill:#1a365d,color:#fff
    style C fill:#276749,color:#fff
    style G fill:#744210,color:#fff
```

### tool() 函数

```typescript
// 定义工具
import { tool } from 'ai';
import { z } from 'zod';

const weatherTool = tool({
  description: '获取指定城市的天气',
  parameters: z.object({
    city: z.string().describe('城市名称'),
    unit: z.enum(['celsius', 'fahrenheit']).default('celsius'),
  }),
  execute: async ({ city, unit }) => {
    // TypeScript 自动推导：
    // city: string
    // unit: "celsius" | "fahrenheit"
    const weather = await fetchWeather(city, unit);
    return { temperature: weather.temp, condition: weather.condition };
    // 返回类型也被自动推导
  },
});
```

### ToolSet 类型

```typescript
// 工具集合的类型定义
type ToolSet = Record<string, Tool>;

// 使用时
const tools = {
  weather: weatherTool,
  search: searchTool,
  calculator: calculatorTool,
};
// TypeScript 推导出：
// typeof tools = {
//   weather: Tool<{ city: string; unit: "celsius" | "fahrenheit" }, WeatherResult>;
//   search: Tool<{ query: string }, SearchResult>;
//   calculator: Tool<{ expression: string }, number>;
// }
```

### 泛型在 generateText 中的流转

```typescript
// generateText 的泛型签名
async function generateText<
  TOOLS extends ToolSet,
  USER_CONTEXT extends Context = Context,
  OUTPUT extends Output = never,
>({ model, tools, ... }): Promise<GenerateTextResult<TOOLS, USER_CONTEXT, OUTPUT>>

// 调用时 TOOLS 被自动推导
const result = await generateText({
  model: openai('gpt-4o'),
  tools: { weather: weatherTool, search: searchTool },
  // TOOLS = { weather: Tool<...>, search: Tool<...> }
  prompt: '北京天气怎么样？',
});

// result.toolCalls 的类型：
// Array<
//   | { toolName: 'weather'; args: { city: string; unit: "celsius" | "fahrenheit" } }
//   | { toolName: 'search'; args: { query: string } }
// >

// result.toolResults 的类型：
// Array<
//   | { toolName: 'weather'; result: WeatherResult }
//   | { toolName: 'search'; result: SearchResult }
// >
```

### 工具执行流程

```typescript
// execute-tool-call.ts — 简化版

async function executeToolCall({ toolCall, tools, context }) {
  const tool = tools[toolCall.toolName];
  
  if (!tool) {
    throw new NoSuchToolError({ toolName: toolCall.toolName });
  }
  
  if (!tool.execute) {
    return undefined; // 无 execute → 停止循环（人工审批场景）
  }
  
  // Zod 参数校验（运行时类型检查）
  const args = tool.parameters.parse(toolCall.args);
  
  // 执行工具
  return await tool.execute(args, {
    context,
    toolCallId: toolCall.toolCallId,
  });
}
```

### 工具类型变体

```typescript
// 1. 标准工具（有 execute）
const standardTool = tool({
  parameters: z.object({ query: z.string() }),
  execute: async ({ query }) => searchResults,
});

// 2. 无 execute 工具（人工审批 / 客户端执行）
const approvalTool = tool({
  description: '需要人工确认的操作',
  parameters: z.object({ action: z.string() }),
  // 没有 execute → 模型调用此工具时循环停止
});

// 3. 带 context 的工具
const dbTool = tool({
  parameters: z.object({ sql: z.string() }),
  execute: async ({ sql }, { context }) => {
    // context 来自 generateText 的 context 参数
    return context.db.query(sql);
  },
});
```

### Zod → JSON Schema 转换

```typescript
// SDK 内部将 Zod schema 转换为 JSON Schema 发送给模型
// z.object({ city: z.string(), unit: z.enum(['c', 'f']) })
// →
// {
//   type: 'object',
//   properties: {
//     city: { type: 'string' },
//     unit: { type: 'string', enum: ['c', 'f'] },
//   },
//   required: ['city', 'unit'],
// }
```

### 与 Claude Code / Codex 的对比

| 维度 | Vercel AI SDK | Claude Code | Codex |
|------|--------------|-------------|-------|
| Schema 定义 | Zod（TypeScript 原生） | JSON Schema | JSON Schema |
| 类型推导 | 编译时自动推导 | 无 | 无 |
| 参数校验 | Zod parse（运行时） | 手动校验 | 手动校验 |
| 工具执行 | Promise.all 并行 | 只读并行/写入串行 | 顺序执行 |
| 无 execute 工具 | 支持（停止循环） | 不适用 | 不适用 |
| Context 传递 | 泛型 context 参数 | 闭包捕获 | 闭包捕获 |

## 设计原因

- **Zod 优先**：TypeScript 生态最流行的 schema 库，类型推导最好
- **编译时安全**：工具参数和结果类型在编写代码时就能检查
- **运行时校验**：Zod parse 确保模型返回的参数符合 schema
- **无 execute 模式**：优雅支持人工审批和客户端执行场景

## 关联知识点

- [generateText 循环](/agent/generate-text-loop) — 工具在循环中的执行
- [工具审批](/tools/tool-approval) — 工具执行前的审批机制
- [工具修复](/tools/tool-repair) — 工具调用参数修复
- [TypeScript 泛型](/types/generics) — 泛型推导详解

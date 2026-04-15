# Vercel AI SDK 源码深度剖析

> 基于开源仓库 packages/ai/ 核心包，逐模块拆解实现原理

---

## 1. 状态机 Agent Loop ★★★★★

### 核心文件：`packages/ai/src/generate-text/generate-text.ts`

Vercel AI SDK 的 Agent Loop 是最简洁的实现——一个 for 循环 + maxSteps 安全阀。

### generateText 核心流程

```typescript
async function generateText({
  model, messages, tools, maxSteps = 1, ...
}) {
  const steps: StepResult[] = []
  let stepMessages = [...messages]
  
  for (let stepCount = 0; stepCount < maxSteps; stepCount++) {
    // 1. 调用模型
    const response = await model.doGenerate({
      inputFormat: 'messages',
      mode: tools ? { type: 'regular', tools } : { type: 'regular' },
      prompt: stepMessages,
      ...
    })
    
    // 2. 处理 finish reason
    if (response.finishReason === 'stop' || !response.toolCalls?.length) {
      steps.push(buildStepResult(response))
      break  // 任务完成
    }
    
    // 3. 执行工具
    const toolResults = await executeTools(response.toolCalls, tools)
    
    // 4. 追加消息
    stepMessages = [
      ...stepMessages,
      { role: 'assistant', content: response.content, toolCalls: response.toolCalls },
      ...toolResults.map(r => ({ role: 'tool', toolCallId: r.toolCallId, content: r.result })),
    ]
    
    steps.push(buildStepResult(response, toolResults))
    
    // 5. 回调
    onStepFinish?.(steps[steps.length - 1])
  }
  
  return new DefaultGenerateTextResult({ steps, ... })
}
```

### streamText 的差异

```
streamText 和 generateText 共享相同的 agent loop 逻辑，但：

1. 输出方式不同：
   generateText → 阻塞等待，一次性返回
   streamText → ReadableStream，逐 token 输出

2. 流式实现：
   - 使用 TransformStream 处理模型输出
   - 检测到 tool_call 时暂停文本流
   - 执行工具
   - 继续下一轮流式调用

3. 背压支持：
   - Web Streams API 内置背压
   - 消费者慢 → ReadableStream 自动暂停
   - 生产者（模型 API）的 HTTP 连接也暂停
```

### 工具执行

```typescript
async function executeTools(toolCalls, tools) {
  // 所有工具并行执行
  return Promise.all(
    toolCalls.map(async (toolCall) => {
      const tool = tools[toolCall.toolName]
      
      // Zod 参数校验
      const args = tool.parameters.parse(toolCall.args)
      
      // 执行
      const result = await tool.execute(args)
      
      return { toolCallId: toolCall.toolCallId, result }
    })
  )
}
```

注意：Vercel AI SDK 默认用 `Promise.all`（一个失败全部失败），不是 `Promise.allSettled`。这意味着一个工具失败会导致整个步骤失败。使用者需要在 tool.execute 内部自己处理错误。

### Provider 抽象层

```
packages/provider/ 定义了统一接口：

interface LanguageModel {
  doGenerate(options: LanguageModelInput): Promise<LanguageModelOutput>
  doStream(options: LanguageModelInput): ReadableStream<LanguageModelChunk>
}

每个 provider 实现这个接口：
  @ai-sdk/openai    → OpenAI API
  @ai-sdk/anthropic → Anthropic API
  @ai-sdk/google    → Google AI API
  ...

模型切换对上层完全透明：
  const result = await generateText({ model: openai('gpt-4o'), ... })
  const result = await generateText({ model: anthropic('claude-sonnet-4-20250514'), ... })
  // 相同的代码，不同的 model 参数
```

### 与 Claude Code 的关键差异

| 维度 | Vercel AI SDK | Claude Code |
|------|--------------|-------------|
| 循环控制 | for loop + maxSteps | while(true) + State 对象 |
| 工具并行 | Promise.all（全部并行） | 只读并行，写入串行 |
| 流式工具执行 | 无（等模型输出完再执行） | 有（StreamingToolExecutor） |
| 错误恢复 | 无内置 | 7 层防御 |
| 中途中断 | 无 | h2A 队列 |
| 模型 fallback | Provider 层支持切换 | 内置 FallbackTriggeredError |

---

## 2. 多级上下文压缩 ★★★★★

**Vercel AI SDK 不提供任何上下文压缩机制。**

这是有意的设计选择。作为框架，它不应该替使用者做这个决策。消息历史完全由使用者管理。

使用者需要自己实现压缩，或者使用社区方案。SDK 提供的是构建压缩的基础设施（token 计数、消息格式化），但不提供压缩策略。

---

## 3. 跨会话记忆系统 ★★★★

**Vercel AI SDK 不提供内置记忆系统。**

消息历史在每次调用时由使用者传入。SDK 不持久化任何状态。

---

## 4. 多级错误恢复 ★★★★

### SDK 层面的错误处理

```
Vercel AI SDK 的错误处理相对简单：

1. finishReason === 'length'（输出截断）
   - SDK 不自动处理
   - 使用者可以检查 finishReason 并决定是否续写
   - 续写需要使用者自己追加 "Please continue" 消息

2. API 错误（500、429 等）
   - SDK 直接抛出异常
   - 使用者自己 try/catch 处理
   - 无内置重试机制

3. 工具执行失败
   - Promise.all 导致一个失败全部失败
   - 使用者需要在 tool.execute 内部 try/catch
   - 或者使用 Promise.allSettled 替代

4. Provider fallback
   - SDK 不内置 fallback 链
   - 但 Provider 抽象层让切换模型很容易
   - 使用者可以自己实现 fallback 逻辑
```

### 中间件系统

```
SDK 提供中间件机制，使用者可以在 model 调用前后插入自定义逻辑：

const modelWithRetry = wrapLanguageModel({
  model: openai('gpt-4o'),
  middleware: {
    transformParams: async (params) => {
      // 调用前修改参数
      return params
    },
    wrapGenerate: async (options) => {
      // 包装 generate 调用，可以加重试逻辑
      try {
        return await options.doGenerate()
      } catch (e) {
        // 重试或 fallback
      }
    }
  }
})
```

---

## 5. Token Budget 管理 ★★★

```
SDK 提供基础的 usage 追踪：

const result = await generateText({ model, messages, tools })
console.log(result.usage)
// { promptTokens: 1234, completionTokens: 567, totalTokens: 1801 }

每个 step 都有独立的 usage：
result.steps.forEach(step => console.log(step.usage))

但 SDK 不提供：
- 预算限制
- 成本计算
- 跨压缩边界追踪
- 预算告警
```

---

## 6. 推测执行 ★★★

**Vercel AI SDK 不提供推测执行机制。**

---

## 7. 沙箱 ★★★

**Vercel AI SDK 不提供沙箱机制。**

工具执行在调用者的进程中直接运行，没有隔离。安全性完全由使用者负责。

---

## 总结：Vercel AI SDK 的价值

Vercel AI SDK 的价值不在于它实现了多少功能，而在于它提供了**正确的抽象**：

1. **Provider 抽象**：最完善的模型切换机制，让 fallback 成为可能
2. **类型安全**：Zod + TypeScript 泛型，编译时捕获工具参数错误
3. **流式 API**：streamText 的 API 设计是行业标杆
4. **中间件**：可扩展的拦截点，使用者可以加入自己的逻辑
5. **UI 集成**：useChat / useCompletion React hooks

它是构建 Agent 的积木，不是完整的 Agent 产品。Claude Code 和 Codex 是产品，Vercel AI SDK 是框架。
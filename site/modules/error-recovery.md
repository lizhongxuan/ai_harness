# 多级错误恢复 ★★★★

## 模块概述

多级错误恢复是 Agent Runtime 的"生存能力"——当 API 返回错误、模型不可用、工具执行失败、上下文溢出时，Agent 如何自动恢复而不是直接崩溃。这是从"Demo 级 Agent"进化为"生产级 Agent"的关键能力。

四个项目在错误恢复的设计上差异显著：

- **Claude Code** 实现了最完善的多级恢复链——7 层上下文压缩防御、流式错误暂扣、模型 fallback、max-output-tokens 自动升级，核心原则是"错误不应该导致 Agent 崩溃，而应该成为模型决策的输入"
- **Codex CLI** 在沙箱相关的错误处理上更精细——沙箱违规时通知用户并提供放宽选项，配合审批取消机制和自动压缩
- **Vercel AI SDK** 提供了 Provider 抽象层支持模型切换，`finishReason='length'` 时自动续写，但不内置压缩、重试或 fallback 机制
- **Hermes Agent** 实现了 fallback_model 配置、摘要失败冷却（600 秒断路器）、JSON 解析错误回填，采用"够用就好"的策略

理解错误恢复的分级策略——特别是"哪些错误可重试、哪些需要 fallback、哪些必须上报"——是面试中的高频考点。

---

## 面试题

### 基础概念题

#### Q4.1 ⭐ Agent 运行时可能遇到哪些类型的错误？请分类并说明每种错误的恢复策略。

<details>
<summary>查看答案</summary>

| 错误类型 | 来源 | 恢复策略 | 是否重试 |
|---------|------|---------|---------|
| prompt-too-long | API 返回 400 | 触发压缩管道（L1→L5） | 是，压缩后重试 |
| max-output-tokens | API 返回截断 | 增加 maxTokens 或让模型 continue | 是 |
| 模型不可用 (500/503) | API 服务端错误 | 模型 fallback 链 | 是，换模型 |
| 速率限制 (429) | API 限流 | 指数退避重试 | 是，等待后重试 |
| 认证失败 (401) | API key 问题 | 不重试，通知用户 | 否 |
| 工具执行超时 | 工具层 | AbortSignal 取消，错误回填给模型 | 由模型决定 |
| 工具执行失败 | 工具层 | 错误信息回填给模型 | 由模型决定 |
| JSON 解析失败 | 模型输出格式错误 | 要求模型重新输出 | 是，最多 2 次 |
| 网络中断 | 传输层 | 重试 + 会话状态持久化 | 是 |
| 内存溢出 | 运行时 | 紧急压缩 + 保存状态 | 否，通知用户 |

核心原则：**错误不应该导致 Agent 崩溃，而应该成为模型决策的输入**。

```typescript
// 错误处理的统一模式
try {
  result = await executeTool(toolCall);
} catch (error) {
  // 不崩溃，把错误信息回填给模型
  result = `Error: ${error.message}. Please try a different approach.`;
}
messages.push({ role: 'tool', content: result });
// 模型看到错误后自己决定怎么处理
```

</details>

#### Q4.2 解释 prompt-too-long 错误的恢复链路：从检测到恢复的完整流程。

<details>
<summary>查看答案</summary>

```
API 返回 prompt-too-long (400)
  │
  ▼
检测: isPromptTooLong(error) → true
  │
  ▼
策略 1: 触发压缩管道
  ├── L1: Tool Result Budget（截断大工具结果）
  ├── L2: Snip（删除旧消息）
  ├── L3: Micro（清理过期缓存）
  ├── L4/L5: Collapse 或 Auto-Compact
  └── 压缩后重新计算 token → 重试 API 调用
  │
  │ 如果压缩后仍然 PTL ↓
  ▼
策略 2: 激进压缩
  ├── 只保留 system prompt + 最近 5 条消息
  ├── 加载记忆文件作为上下文补充
  └── 重试
  │
  │ 如果仍然 PTL ↓
  ▼
策略 3: 最小上下文
  ├── 只保留 system prompt + 当前用户消息
  ├── 插入 "[Previous context was lost due to size limits]"
  └── 重试
  │
  │ 如果仍然 PTL（不太可能，除非 system prompt 本身太大）↓
  ▼
放弃: 通知用户，建议开始新会话
```

这个恢复链路体现了"从便宜到昂贵逐级触发"的设计原则——先尝试零成本的截断和删除，再尝试低成本的 CQRS 投影，最后才用高成本的 LLM 摘要。

</details>

#### Q4.3 什么是模型 fallback？Provider 抽象层怎么实现模型热切换？切换对上层是否透明？

<details>
<summary>查看答案</summary>

```typescript
interface ModelProvider {
  name: string;
  chat(messages: Message[], options: ChatOptions): Promise<ModelResponse>;
  streamChat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk>;
  getMaxTokens(): number;
  getPricing(): { inputPer1k: number; outputPer1k: number };
  isAvailable(): Promise<boolean>;
}

class FallbackProvider implements ModelProvider {
  constructor(private providers: ModelProvider[]) {}
  
  async chat(messages: Message[], options: ChatOptions): Promise<ModelResponse> {
    for (const provider of this.providers) {
      try {
        if (await provider.isAvailable()) {
          return await provider.chat(messages, options);
        }
      } catch (error) {
        if (isRetryable(error)) continue; // 尝试下一个
        throw error; // 不可重试的错误直接抛出
      }
    }
    throw new Error('All model providers exhausted');
  }
}
```

切换对上层是否透明？**是的**。FallbackProvider 实现了和单个 Provider 相同的接口。上层代码不知道也不需要知道当前用的是哪个模型。

唯一需要注意的是：不同模型的消息格式可能不同（比如 tool call 的 JSON 结构）。Provider 抽象层需要在内部做格式转换。

</details>

#### Q4.4 Claude Code 在流式传输期间遇到可恢复错误时会"暂扣"错误。这是什么意思？为什么这样设计？

<details>
<summary>查看答案</summary>

```
场景: Agent 正在流式输出文本，中途遇到一个可恢复的错误

普通做法: 立即把错误抛给前端 → 用户看到错误 → 体验差
Claude Code: 暂扣错误 → 尝试恢复 → 恢复成功则用户无感知

具体流程:
  1. 流式输出中遇到错误（比如网络抖动）
  2. 暂扣错误，不立即上报
  3. 尝试恢复（重连、重试）
  4. 恢复成功 → 继续流式输出，用户完全无感知
  5. 恢复失败 → 才把错误上报给用户
```

```typescript
async function* streamWithErrorWithholding(
  stream: AsyncIterable<StreamChunk>
): AsyncGenerator<StreamChunk> {
  let withheldError: Error | null = null;
  
  try {
    for await (const chunk of stream) {
      yield chunk;
    }
  } catch (error) {
    if (isRecoverable(error)) {
      withheldError = error;
      // 尝试恢复
      try {
        const recoveredStream = await reconnectStream();
        for await (const chunk of recoveredStream) {
          yield chunk;
        }
        return; // 恢复成功
      } catch {
        // 恢复失败，上报原始错误
        throw withheldError;
      }
    }
    throw error; // 不可恢复的错误直接抛出
  }
}
```

**为什么这样设计？** 流式输出的用户体验非常敏感——用户正在看 Agent 实时输出文本，突然弹出一个错误会打断思路。暂扣机制让可恢复的错误对用户完全透明，只有真正无法恢复时才上报。

</details>

### 设计题

#### Q4.5 ⭐ 设计一个多级错误恢复链，要求处理以下错误类型：prompt-too-long、max-output-tokens、模型不可用、速率限制、工具执行超时、未知错误

<details>
<summary>查看答案</summary>

```typescript
type ErrorType = 'prompt_too_long' | 'max_output_tokens' | 'model_unavailable' 
               | 'rate_limit' | 'tool_timeout' | 'unknown';

interface RecoveryStrategy {
  type: ErrorType;
  maxRetries: number;
  handler: (error: Error, context: RecoveryContext) => Promise<RecoveryAction>;
}

type RecoveryAction = 
  | { action: 'retry'; delay?: number }
  | { action: 'compress'; level: number }
  | { action: 'upgrade_tokens'; newMax: number }
  | { action: 'fallback_model' }
  | { action: 'abort'; reason: string };

const recoveryChain: RecoveryStrategy[] = [
  {
    type: 'prompt_too_long',
    maxRetries: 3,
    handler: async (error, ctx) => {
      return { action: 'compress', level: ctx.attempt + 3 }; // L3 → L4 → L5
    }
  },
  {
    type: 'max_output_tokens',
    maxRetries: 2,
    handler: async (error, ctx) => {
      const currentMax = ctx.request.maxTokens;
      const modelMax = getModelMaxTokens(ctx.model);
      if (currentMax < modelMax) {
        return { action: 'upgrade_tokens', newMax: Math.min(currentMax * 1.5, modelMax) };
      }
      return { action: 'fallback_model' }; // 当前模型已到上限，换更大的模型
    }
  },
  {
    type: 'model_unavailable',
    maxRetries: 1,
    handler: async () => ({ action: 'fallback_model' })
  },
  {
    type: 'rate_limit',
    maxRetries: 5,
    handler: async (error) => {
      const retryAfter = extractRetryAfter(error) || 1000;
      return { action: 'retry', delay: retryAfter };
    }
  },
  {
    type: 'tool_timeout',
    maxRetries: 0, // 不重试，让模型决定
    handler: async (error) => ({ action: 'abort', reason: error.message })
  },
  {
    type: 'unknown',
    maxRetries: 0,
    handler: async (error) => ({ action: 'abort', reason: `Unknown error: ${error.message}` })
  },
];
```

**设计要点：**

1. **错误分类是第一步**：不同错误类型有完全不同的恢复策略，不能一刀切
2. **重试次数有上限**：每种错误类型有独立的 maxRetries，防止无限重试
3. **恢复动作是结构化的**：不是简单的"重试/放弃"，而是有多种恢复动作（压缩、升级、fallback）
4. **工具超时不重试**：工具执行失败的信息回填给模型，让模型决定下一步

</details>

#### Q4.6 🔥 你的 Agent 在执行第 47 步时遇到 prompt-too-long。此时上下文中有 200 条消息、50 条工具结果、3 个正在进行的任务、10 分钟前的重要用户指令。请设计恢复策略。

<details>
<summary>查看答案</summary>

```
当前状态:
  - 200 条消息，50 条是工具结果
  - 3 个正在进行的任务
  - 10 分钟前的重要用户指令

恢复策略（保留关键信息）:

Step 1: 识别必须保留的内容
  ├── system prompt（永远保留）
  ├── 用户 10 分钟前的重要指令（标记为 protected）
  ├── 3 个任务的当前状态（从 TODO/Task 系统读取）
  ├── 最近 5 条消息（当前工作上下文）
  └── 最近的错误信息（如果有）

Step 2: 可以压缩/删除的内容
  ├── 50 条工具结果 → L1 截断为预览（释放大量 token）
  ├── 30 轮前的对话 → L2 Snip 删除
  ├── 中间的 assistant 推理过程 → 可以删除
  └── 已完成任务的详细过程 → 折叠为一行摘要

Step 3: 结构化摘要（如果 L1+L2 不够）
  摘要模板:
  {
    "intent": "用户要求重构 auth 模块",
    "completed_tasks": ["读取了 auth.ts", "分析了依赖关系"],
    "in_progress_tasks": ["修改 login 函数", "更新测试", "更新文档"],
    "key_files": ["src/auth.ts", "src/auth.test.ts"],
    "recent_errors": ["TypeError in line 42"],
    "user_instructions": ["10分钟前: '确保向后兼容'"]  ← 保留原文
  }

Step 4: 重建上下文
  messages = [
    system_prompt,
    { role: 'system', content: structured_summary },
    { role: 'user', content: '确保向后兼容' },  // 保留重要指令原文
    ...last_5_messages
  ]
```

**关键设计点：**
- 用户的重要指令必须保留原文，不能被摘要替代
- 结构化摘要比自由格式摘要更可靠（参考 Hermes Agent 的 Goal/Progress/Decisions 模板）
- 工具结果是最大的 token 消耗者，优先截断

</details>

#### Q4.7 设计 Provider 抽象层，支持多个模型提供商、统一接口、模型 fallback 链、token 限制和定价信息、切换模型时的上下文适配

<details>
<summary>查看答案</summary>

```typescript
interface ProviderConfig {
  name: string;
  apiKey: string;
  baseUrl: string;
  models: ModelConfig[];
  rateLimits: { requestsPerMinute: number; tokensPerMinute: number };
}

interface ModelConfig {
  id: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  pricing: { inputPer1kTokens: number; outputPer1kTokens: number };
  supportsStreaming: boolean;
  supportsToolCalling: boolean;
}

// 消息格式适配器
interface MessageAdapter {
  toProviderFormat(messages: Message[]): ProviderMessage[];
  fromProviderFormat(response: ProviderResponse): ModelResponse;
}

class UnifiedProvider {
  private providers: Map<string, { config: ProviderConfig; adapter: MessageAdapter }>;
  private fallbackOrder: string[];
  
  async chat(messages: Message[], options: ChatOptions): Promise<ModelResponse> {
    for (const providerName of this.fallbackOrder) {
      const { config, adapter } = this.providers.get(providerName)!;
      
      try {
        // 格式转换: 统一格式 → provider 特定格式
        const providerMessages = adapter.toProviderFormat(messages);
        
        // 选择能容纳当前输入的最小模型（成本优化）
        const model = this.selectModel(config, messages);
        if (!model) continue;
        
        const response = await this.callProvider(config, model, providerMessages, options);
        
        // 格式转换: provider 特定格式 → 统一格式
        return adapter.fromProviderFormat(response);
      } catch (error) {
        if (this.shouldFallback(error)) continue;
        throw error;
      }
    }
    throw new Error('All providers exhausted');
  }
  
  private selectModel(config: ProviderConfig, messages: Message[]): ModelConfig | null {
    const inputTokens = this.estimateTokens(messages);
    return config.models
      .filter(m => m.maxInputTokens >= inputTokens && m.supportsToolCalling)
      .sort((a, b) => a.pricing.inputPer1kTokens - b.pricing.inputPer1kTokens)[0] || null;
  }
}
```

**关键设计点：**
- MessageAdapter 解决了不同模型消息格式不同的问题（Anthropic 的 tool_use vs OpenAI 的 function_call）
- selectModel 自动选择能容纳当前输入的最便宜模型
- fallback 链对上层完全透明

</details>

#### Q4.8 💡 Agent 在流式输出过程中，模型突然返回了一个格式错误的 tool call JSON。怎么处理？

<details>
<summary>查看答案</summary>

```
场景: 模型输出了 {"name": "read_file", "arg  然后连接断了

处理策略:

1. 已经输出的文本部分 → 保留，已经展示给用户了
2. 不完整的 tool call → 丢弃，不尝试执行
3. 重试策略:
   a. 把已输出的文本作为 assistant 消息加入历史
   b. 追加一条 user 消息: "Your previous response was interrupted.
      Please continue."
   c. 重新调用模型
4. 消息历史:
   messages.push({ role: 'assistant', content: partialText });
   messages.push({ role: 'user', content: 'Your response was interrupted.
     Please retry the tool call.' });
```

```typescript
function handlePartialToolCall(
  partialContent: string,
  partialToolCallJson: string
): Message[] {
  // 不尝试修复不完整的 JSON
  // 把已有内容保存，让模型重新生成
  return [
    { role: 'assistant', content: partialContent },
    { role: 'user', content: 'Your previous response was cut off mid-tool-call. '
      + 'Please retry the tool call.' },
  ];
}
```

**关键原则：** 不要尝试修复不完整的 JSON——让模型重新生成比猜测缺失部分更可靠。

</details>

### 编码题

#### Q4.9 ⭐ 用 TypeScript 实现 `executeWithRecovery` 函数，包含完整的错误分类和恢复策略链。

<details>
<summary>查看答案</summary>

```typescript
function classifyError(error: unknown): { type: ErrorType; retryable: boolean } {
  if (error instanceof APIError) {
    switch (error.status) {
      case 400:
        if (error.message.includes('prompt is too long')) 
          return { type: 'prompt_too_long', retryable: true };
        if (error.message.includes('max_tokens'))
          return { type: 'max_output_tokens', retryable: true };
        return { type: 'unknown', retryable: false };
      case 401: return { type: 'unknown', retryable: false };
      case 429: return { type: 'rate_limit', retryable: true };
      case 500: case 502: case 503:
        return { type: 'model_unavailable', retryable: true };
      default: return { type: 'unknown', retryable: false };
    }
  }
  if (error instanceof TimeoutError) return { type: 'tool_timeout', retryable: false };
  return { type: 'unknown', retryable: false };
}

async function executeWithRecovery(
  fn: () => Promise<ModelResponse>,
  context: RecoveryContext
): Promise<ModelResponse> {
  const maxAttempts = 5;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const classified = classifyError(error);
      
      if (!classified.retryable) {
        throw error; // 不可重试，直接抛出
      }
      
      const strategy = recoveryChain.find(s => s.type === classified.type);
      if (!strategy || attempt >= strategy.maxRetries) {
        throw error; // 超过重试次数
      }
      
      const action = await strategy.handler(
        error as Error,
        { ...context, attempt }
      );
      
      switch (action.action) {
        case 'retry':
          if (action.delay) await sleep(action.delay);
          break;
        case 'compress':
          await context.compressor.compress(action.level);
          break;
        case 'upgrade_tokens':
          context.request.maxTokens = action.newMax;
          break;
        case 'fallback_model':
          context.model = context.fallbackModels.shift()!;
          if (!context.model) throw error;
          break;
        case 'abort':
          throw new RecoveryAbortedError(action.reason);
      }
    }
  }
  
  throw new Error('Max recovery attempts exceeded');
}
```

**关键设计点：**
- 错误分类和恢复策略分离——classifyError 只负责分类，recoveryChain 负责恢复
- 每种错误类型有独立的重试上限
- 恢复动作是结构化的，支持压缩、升级、fallback 等多种策略

</details>

#### Q4.10 实现一个 Provider 抽象层，支持模型注册、fallback 链、和统一的 chat 接口。

<details>
<summary>查看答案</summary>

```typescript
class ProviderRegistry {
  private providers = new Map<string, ModelProvider>();
  private fallbackChain: string[] = [];
  
  register(name: string, provider: ModelProvider): void {
    this.providers.set(name, provider);
  }
  
  setFallbackChain(chain: string[]): void {
    this.fallbackChain = chain;
  }
  
  async chat(messages: Message[], options: ChatOptions = {}): Promise<ModelResponse> {
    const errors: Array<{ provider: string; error: Error }> = [];
    
    for (const name of this.fallbackChain) {
      const provider = this.providers.get(name);
      if (!provider) continue;
      
      try {
        return await provider.chat(messages, options);
      } catch (error) {
        errors.push({ provider: name, error: error as Error });
        // 记录但继续尝试下一个
      }
    }
    
    throw new AggregateError(
      errors.map(e => e.error),
      `All providers failed: ${errors.map(e =>
        `${e.provider}: ${e.error.message}`).join('; ')}`
    );
  }
}

// 使用示例
const registry = new ProviderRegistry();
registry.register('anthropic', new AnthropicProvider(config));
registry.register('openai', new OpenAIProvider(config));
registry.register('google', new GoogleProvider(config));
registry.setFallbackChain(['anthropic', 'openai', 'google']);

const response = await registry.chat(messages); // 自动 fallback
```

**关键设计点：**
- 注册和使用分离——注册时提供 Provider 实例，使用时只需调用统一的 chat 接口
- AggregateError 收集所有 Provider 的错误信息，方便调试
- fallback 链的顺序决定了优先级

</details>

---

## 跨项目对比

| 维度 | Claude Code | Codex CLI | Vercel AI SDK | Hermes Agent |
|------|------------|-----------|---------------|-------------|
| **prompt-too-long 恢复** | 7 层压缩防御（[多级错误恢复策略](/claude_code_docs/agent/error-recovery)） | 自动压缩 + 截断（[错误恢复与重试](/codex_docs/agent/error-recovery)） | 无内置处理 | 触发 ContextCompressor |
| **max-output-tokens** | 暂扣错误，8K→64K 自动升级 + 多轮恢复 | 无特殊处理 | finishReason='length' 续写（[停止条件与错误处理](/vercel_ai_docs/agent/stop-condition)） | 无特殊处理 |
| **模型不可用 (500/503)** | 内置 fallback（FallbackTriggeredError） | 重试 | Provider 抽象支持切换 | fallback_model 配置 |
| **速率限制 (429)** | 重试 + 限制追踪 | 指数退避 | 无内置处理 | 重试 |
| **工具执行失败** | 错误回填 + 安全注释 | 错误回填给模型 | 错误回填给模型 | 错误回填（JSON 格式） |
| **沙箱违规** | dangerouslyDisableSandbox | 通知用户 + 放宽选项（渐进式权限升级） | N/A | N/A |
| **流式错误** | 可恢复错误暂扣（withheld errors） | 标准错误传播 | 标准错误传播 | 无流式支持（批量模式） |
| **断路器** | Auto-Compact 连续失败后停止 | 无 | 无 | 摘要失败冷却 600 秒 |
| **JSON 解析失败** | 重试 | 无 | 无 | 错误回填，继续循环 |
| **审批超时** | 权限系统处理 | 取消操作（CancellationToken） | N/A | 基础审批 |
| **设计哲学** | "错误是模型决策的输入" + 分层防御 | "沙箱违规 → 用户决定" | "留给使用者" | "够用就好" |

---

## 设计模式与权衡

### 模式 1：分级恢复链（Tiered Recovery Chain）

- **描述：** 按错误严重程度和恢复成本，从便宜到昂贵逐级触发恢复策略
- **使用项目：** Claude Code（7 层压缩防御：L1 截断 → L2 删除 → L3 清理 → L4 CQRS → L5 LLM 摘要 → L6 阻塞 → L7 最后手段）
- **权衡：** 最大化恢复成功率，但增加了系统复杂度；每一层都有独立的触发条件和退出条件，需要仔细设计互斥关系

### 模式 2：错误回填（Error Feedback to Model）

- **描述：** 工具执行失败时不崩溃，而是把错误信息作为 tool result 回填给模型，让模型自己决定下一步
- **使用项目：** Claude Code、Codex CLI、Vercel AI SDK、Hermes Agent（所有项目都采用）
- **权衡：** 利用模型的推理能力做错误恢复决策，但模型可能做出不合理的决策（如反复重试同一个失败的工具）；需要配合 maxRetries 限制

### 模式 3：流式错误暂扣（Withheld Errors）

- **描述：** 流式输出中遇到可恢复错误时暂扣错误，尝试恢复，恢复成功则用户无感知
- **使用项目：** Claude Code
- **权衡：** 极大提升用户体验（可恢复错误对用户透明），但增加了流式处理的复杂度；需要区分可恢复和不可恢复错误

### 模式 4：Provider Fallback 链（Model Fallback）

- **描述：** 当前模型不可用时自动切换到备选模型，对上层代码透明
- **使用项目：** Claude Code（内置 fallback）、Vercel AI SDK（Provider 抽象层）、Hermes Agent（fallback_model 配置）
- **权衡：** 提高了系统可用性，但不同模型的能力和消息格式可能不同；需要 MessageAdapter 做格式转换

### 模式 5：渐进式权限升级（Progressive Permission Escalation）

- **描述：** 沙箱违规时不直接失败，而是分析原因、推导最小化的放宽规则，让用户确认后重试
- **使用项目：** Codex CLI（沙箱违规 → 通知用户 → 放宽选项 → 更新 exec policy → 重试）
- **权衡：** 安全性和可用性的平衡——不会因为沙箱限制导致任务完全失败，但需要用户参与决策

### 模式 6：断路器（Circuit Breaker）

- **描述：** 某个恢复策略连续失败后停止尝试，防止无效的资源消耗
- **使用项目：** Claude Code（Auto-Compact 断路器）、Hermes Agent（摘要失败 600 秒冷却）
- **权衡：** 防止了无限重试的资源浪费，但可能在临时故障恢复后仍然处于"断开"状态；需要设计重置条件

---

## 答题策略

### 推荐答题结构

1. **先讲错误分类**（30 秒）：Agent 运行时的错误分为 API 层（PTL、429、500）、工具层（超时、执行失败）、传输层（网络中断、流式错误）三大类，每类有不同的恢复策略
2. **再讲恢复链设计**（2 分钟）：从便宜到昂贵逐级触发——先截断（零成本）→ 再删除（零成本）→ 再压缩（低成本）→ 最后 LLM 摘要（高成本）；引用 Claude Code 的 7 层防御和 Codex 的沙箱违规恢复
3. **最后讲核心原则**（1 分钟）：错误不应该导致 Agent 崩溃，而应该成为模型决策的输入；可恢复错误对用户透明（暂扣机制）

### 常见追问方向

- "prompt-too-long 恢复后，怎么确保不丢失关键信息？"
  - 回答要点：结构化摘要模板（intent/progress/files/instructions）；用户重要指令保留原文；最近 N 条消息始终保留
- "模型 fallback 时，不同模型的消息格式不同怎么办？"
  - 回答要点：Provider 抽象层 + MessageAdapter 做格式转换；对上层代码完全透明
- "断路器什么时候重置？"
  - 回答要点：可以基于时间（如 600 秒冷却后重试）或基于条件（如用户开始新会话时重置）

### 关键源码引用

- Claude Code 错误恢复：`query.ts` 中的错误处理逻辑、`services/compact/` 压缩管道
- Claude Code 流式错误暂扣：流式输出中的 withheld error 机制
- Codex 沙箱违规恢复：`codex-rs/core/src/codex_delegate.rs` 中的 `await_approval_with_cancel`
- Codex 错误分类：`codex-rs/core/src/compact.rs` 中的上下文溢出处理
- Vercel AI SDK 停止条件：`generate-text.ts` 中的 `finishReason` 处理逻辑
- Hermes Agent 断路器：`agent/context_compressor.py` 中的摘要失败冷却机制

---

## 深入阅读

### Claude Code

- [多级错误恢复策略](/claude_code_docs/agent/error-recovery) — 7 层压缩防御、流式错误暂扣、模型 fallback、max-output-tokens 自动升级的完整源码分析

### Codex CLI

- [错误恢复与重试机制](/codex_docs/agent/error-recovery) — 沙箱违规恢复、审批取消机制、自动压缩、渐进式权限升级的深度解析

### Vercel AI SDK

- [停止条件与错误处理](/vercel_ai_docs/agent/stop-condition) — finishReason 处理、maxSteps 安全阀、Provider 抽象层的错误传播机制
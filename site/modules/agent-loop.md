# 状态机 Agent Loop ★★★★★

## 模块概述

Agent Loop 是所有 Agent Runtime 的核心引擎——它定义了从用户输入到最终输出的完整执行流程。本质上，Agent Loop 实现了 ReAct（Reasoning + Acting）模式的工程化：模型思考 → 调用工具 → 观察结果 → 继续思考，直到任务完成。

四个项目在 Agent Loop 的设计上走了截然不同的路线：

- **Claude Code** 选择了极简的 `while loop` + 异步消息队列（h2A），把决策权完全交给模型
- **Codex CLI** 用 Rust 实现了事件驱动的循环架构，强调沙箱隔离和安全审批
- **Vercel AI SDK** 提供了 `generateText` / `streamText` + `maxSteps` 的框架级抽象，让开发者自由组合
- **Hermes Agent** 采用 Python 双层循环（环境级 + CLI 级），配合技能系统和并行工具执行

理解这四种设计的差异和权衡，是面试中最高频的考点。

---

## 面试题

### 基础概念题

#### Q1.1 ⭐ 请描述一个 Agent Loop 的基本执行流程。从用户输入到最终输出，中间经过哪些步骤？

<details>
<summary>查看答案</summary>

Agent Loop（通常基于 ReAct 模式）的核心是一个"思考-行动-观察"的持续循环。从用户输入到最终输出，通常经历以下几个核心步骤：

1. **接收输入与上下文组装 (Input & Context Assembly):**
   - 接收用户的初始 Prompt
   - 将 Prompt 与 System Prompt（系统指令）、可用的工具描述（Tool Schema/Definitions）以及历史对话记录（Memory/History）合并，组装成当前轮次的上下文窗口

2. **推理与决策 (Reasoning & Decision - LLM Call):**
   - 将上下文发送给大模型 (LLM)。LLM 会评估当前状态，决定下一步该怎么做
   - 如果任务未完成，LLM 会决定调用某个工具（输出 `tool_call` 请求）或进行逻辑推理

3. **解析与暂停 (Parsing & Pausing):**
   - 框架层解析 LLM 的输出。如果检测到模型要求调用工具（例如 `stop_reason == "tool_use"`），Agent Loop 会暂时挂起 LLM 的推理过程

4. **执行工具 (Tool Execution / Observation):**
   - 应用层在本地或沙盒环境中实际执行 LLM 请求的函数（例如查询数据库、执行代码、调用 API）
   - 捕获执行结果或错误信息（Observation）

5. **结果反馈与循环 (Feedback & Loop):**
   - 将工具执行的结果作为"工具响应 (Tool Message)"追加到对话历史记录中
   - 携带更新后的历史记录，**跳回第 2 步**，再次调用 LLM 让其评估结果

6. **最终输出 (Final Output):**
   - 当 LLM 判断任务已经完成，它会生成一段普通文本响应，并且不再附带任何工具调用请求。Agent Loop 检测到退出条件，将最终结果返回给用户

</details>

#### Q1.2 ⭐ Agent Loop 用 while loop 和用显式状态机有什么区别？各自的优缺点是什么？在什么场景下你会选择状态机？

<details>
<summary>查看答案</summary>

这是目前 Agent 编排层最核心的技术路线之争。

**1. `while loop`（代码级循环）**

- **实现方式：** 依赖原生代码的 `while (!isDone)` 循环，状态隐式存储在内存的变量或消息数组中
- **优点：** 极其轻量、符合直觉、开发速度快、几乎没有心智负担，非常适合简单的单点 ReAct 任务
- **缺点：** 是一个"黑盒"。极难实现原生暂停/恢复（Pause & Resume）；难以处理复杂的路由；在出现死循环或需要"人类介入 (Human-in-the-loop)"时，代码结构容易变得臃肿和脆弱

**2. 显式状态机（如 LangGraph, XState）**

- **实现方式：** 将 Agent 的运行定义为图结构（DAG 或有向有环图），节点是操作，边是条件路由。状态在节点之间显式传递
- **优点：**
  - **极佳的可观测性：** 你可以确切知道 Agent 当前停在哪个节点
  - **持久化与时间旅行：** 状态机天然支持 Checkpoint，可以在任何节点将状态保存到数据库，并在断开后随时恢复
  - **流程控制：** 完美支持复杂的 Multi-Agent 协作、并发工具调用和人工审批
- **缺点：** 学习曲线陡峭，样板代码多，对于简单任务有过度设计之嫌

**选择场景（面试回答策略）：**

- **选 `while loop`：** 针对单一场景的轻量级助手、工具调用较少、生命周期极短的单次对话请求
- **选 状态机：** 当构建企业级的复杂 Workflow、需要长时间运行的异步任务、**需要人工审核确认关键操作**（Human-in-the-loop），或者需要统筹多个 Sub-Agent 协同工作时

**Claude Code 的选择：** 虽然用 while loop，但通过异步事件总线（h2A）、显式状态日志、递归预算与强制归约等工程手段解决了"黑盒"和"不可中断"的问题。核心论点是：**模型本身就是状态机**——LLM 每次返回时已经做了"下一步该做什么"的决策，不需要在代码层面硬编码状态转移。

| 维度 | while loop | 显式状态机 |
|------|-----------|-----------|
| 状态转移决策者 | 模型（灵活、上下文感知） | 代码（硬编码、脆弱） |
| 新增能力 | 加个工具就行 | 要改状态图、加转移规则 |
| 可调试性 | 扁平消息历史，一眼看完 | 状态图复杂后难以追踪 |
| 异常处理 | 统一：工具失败 → 告诉模型 → 模型决定 | 每个状态都要写异常转移 |
| 可预测性 | 较低（模型可能做意外决策） | 较高（状态转移是确定的） |

</details>

#### Q1.3 Vercel AI SDK 的 `generateText` 和 `streamText` 在 agent loop 实现上有什么区别？`maxSteps` 参数的作用是什么？

<details>
<summary>查看答案</summary>

Vercel AI SDK 的设计非常现代化，对 Agent 开发者很友好。

**区别：**

- **`generateText` (阻塞式):** 在后台静默运行整个 Agent Loop。如果触发了工具调用，它会自动完成"请求-执行-再请求"的整个循环。但它**会阻塞并等待**，直到整个任务彻底完成，然后一次性返回最终结果和所有经过的工具调用记录。
- **`streamText` (流式):** 同样会在后台处理工具调用，但它会将大模型的思考过程、工具调用的开始事件、工具执行的结果、以及最终的文本回复，**以流（Stream）的形式实时抛给前端**。
- **实际意义：** 在 Agent 开发中，由于 Agent Loop 执行时间通常很长（几秒到几十秒），出于 UX 考虑，绝大多数情况下必须使用 `streamText`，让用户能在前端看到实时反馈。

**`maxSteps` 参数的作用：**

- `maxSteps` 是 Agent Loop 的**迭代上限安全阀**
- **启动循环：** 默认情况下，SDK 只会调用一次大模型（不开启 Loop）。要启用 Agent 的多轮工具调用能力，必须将 `maxSteps` 设置为大于 1
- **防爆垒：** LLM 有时会陷入"死循环"。`maxSteps` 防止了无限循环导致的 Token 计费爆炸和系统资源耗尽

```typescript
// Vercel AI SDK 核心循环伪代码
for (step = 0; step < maxSteps; step++) {
  response = await model.doGenerate(messages)
  if (response.finishReason === 'stop') break
  if (response.finishReason === 'length') continue  // 截断续写
  // tool_calls → 执行工具
  toolResults = await executeTools(response.toolCalls, tools)
  messages.push(assistantMessage, ...toolResultMessages)
  onStepFinish?.(stepResult)
}
```

</details>

#### Q1.4 解释 Claude Code 核心循环（代号 nO）的工作原理。为什么选择单线程而不是多线程？

<details>
<summary>查看答案</summary>

Claude Code 内部使用的核心控制环被代号为 `nO` (Master Loop)，与之配合的是 `h2A` (异步消息队列)。

**工作原理简介：**

它是一个极其克制的递归/循环模型。Agent 将所有的上下文、工具调用和系统提示词拍平为一个单一的消息历史列表。每一次循环，它只做一件事：读取这个单一列表，调用 Claude API，执行工具，将结果追加到列表末尾，然后继续。中间配合 `h2A` 队列，允许用户在命令行随时打断或注入新指令。

```typescript
while (true) {
  const response = await callModel(messages);
  if (!response.toolCalls || response.toolCalls.length === 0) {
    return response.text;  // 模型决定任务完成
  }
  for (const toolCall of response.toolCalls) {
    const result = await executeTool(toolCall);
    messages.push(toolResult(result));
  }
}
```

**为什么选择单线程？**

1. **极高的可调试性与可靠性：** 如果让多个 Agent 线程并发修改代码，状态会瞬间变得不可见且难以追踪。单线程确保了只有一个绝对的"主控制流"

2. **避免"人格分裂"与不可预测性：** Anthropic 在架构上明确排除了原生的并发 Swarm 或多个竞争人格

3. **严格的上下文窗口控制：** 单线程模型拥有一条绝对线性的消息历史，使得上下文接近极限时能非常确定地触发自动压缩逻辑

4. **有克制的并发设计：** 当确实需要并行能力时，通过工具系统（Agent Teams）将任务派发出去，但**主调度引擎 (nO) 本身依然是单线程的统筹者**

Claude Code 的 while loop 虽然简单，但外围有大量的约束和护栏：

```
while loop（核心简单）
  ├── maxTurns 限制（防止无限循环）
  ├── maxBudgetUsd 成本限制（防止烧钱）
  ├── 上下文窗口监控（92% 触发压缩）
  ├── 工具权限系统（每次工具调用前检查）
  ├── h2A 异步队列（支持用户中途介入）
  └── 断路器（压缩反复失败后停止）
```

</details>

### 设计题

#### Q1.5 ⭐ 设计一个多阶段 Phase 管道的 Agent Loop（plan → act → observe → reflect）

<details>
<summary>查看答案</summary>

**设计前的关键思考：** Phase 管道不是替代 while loop，而是在 while loop 内部增加结构。外层仍然是循环，内层是 Phase 状态机。


**四个 Phase 的职责定义：**

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Loop (外层循环)                      │
│   ┌──────┐    ┌──────┐    ┌─────────┐    ┌─────────┐       │
│   │ PLAN │───▶│ ACT  │───▶│ OBSERVE │───▶│ REFLECT │──┐    │
│   └──────┘    └──────┘    └─────────┘    └─────────┘  │    │
│       ▲                                                │    │
│       └────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

| Phase | 职责 | 工具权限 | 超时 | Token 预算 |
|-------|------|---------|------|-----------|
| PLAN | 分析任务，制定行动计划 | 只读（Read, Grep, Glob） | 30s | 15% |
| ACT | 按计划执行具体操作 | 完整权限 | 5min | 40% |
| OBSERVE | 收集结果，验证操作是否成功 | 只读 + 验证性 Bash | 60s | 20% |
| REFLECT | 评估进展，决定下一步 | 无（纯推理） | 15s | 10% |

**Phase 之间的状态转移条件：**

| 从 | 到 | 条件 |
|----|-----|------|
| PLAN | ACT | 模型输出了有效的 TaskPlan |
| ACT | OBSERVE | 所有步骤执行完毕 / ACT 超时 |
| OBSERVE | REFLECT | 验证完成 |
| REFLECT | PLAN | decision = 'replan'（需要完全重新规划） |
| REFLECT | ACT | decision = 'continue'（微调后继续执行） |
| REFLECT | END | decision = 'complete' 或 'abort' |

**每个 Phase 的异常处理路径：**

- **PLAN 超时：** 用更简单的 prompt 重试一次，再次超时则跳过规划直接进入 ACT
- **ACT 工具超时：** AbortSignal 取消该工具，记录失败，继续执行后续步骤
- **ACT 权限被拒绝：** 记录拒绝，跳过该步骤，在 REFLECT 阶段让模型调整
- **OBSERVE 超时：** 跳过未完成的验证，用已有信息生成 Observation
- **REFLECT 超时：** 默认决策 = 'continue'

**循环终止条件（优先级从高到低）：**

1. 用户主动中断（硬停止）
2. Token 预算耗尽（硬停止）
3. 时间预算耗尽（硬停止）
4. 连续失败 3 次（断路器）
5. 最大循环次数（安全阀）
6. REFLECT 决定 abort / complete（正常终止）

**面试回答策略：**

> "Claude Code 用 while loop 是因为它的场景足够通用。但如果我要设计一个需要稳定运行 8 小时的 Agent Harness，Phase 管道给了我三个 while loop 没有的东西：每个阶段独立的资源预算和超时、阶段级别的异常隔离、可审计的执行轨迹。本质上，Phase 管道是在 while loop 内部增加结构，不是替代它。"

</details>

#### Q1.6 🔥 你的 Agent 需要同时调用 3 个工具（读文件、搜索代码、执行命令）。请设计工具并行执行的策略

<details>
<summary>查看答案</summary>

**1. 哪些工具可以并行？哪些必须串行？**

判断依据是**副作用（Side Effects）+ 依赖关系**：

| 工具组合 | 策略 | 原因 |
|---------|------|------|
| Read + Grep + Glob | ✅ 全部并行 | 都是只读，无副作用，互不依赖 |
| Write + Write | ❌ 串行 | 可能写同一个文件，需要顺序保证 |
| Edit + Bash(npm test) | ❌ 串行 | 测试必须在编辑完成后执行 |
| Bash(ls) + Bash(git status) | ✅ 可以并行 | 都是只读命令 |

```typescript
function canParallelize(tools: ToolCall[]): ToolCall[][] {
  const readOnly = tools.filter(t => isReadOnly(t));
  const mutations = tools.filter(t => !isReadOnly(t));
  const batches: ToolCall[][] = [];
  if (readOnly.length > 0) batches.push(readOnly);  // 只读工具全部并行
  for (const mutation of mutations) {
    batches.push([mutation]);  // 写入工具逐个串行
  }
  return batches; // 每个 batch 内部并行，batch 之间串行
}
```

**2. 并行执行时，如果其中一个工具超时了怎么办？**

关键原则：**一个工具的失败不应该阻塞其他工具**。使用 `Promise.allSettled` 而不是 `Promise.all`：

```typescript
const results = await Promise.allSettled(
  tools.map(tool => executeWithTimeout(tool, TOOL_TIMEOUT_MS))
);
// 每个工具独立结算，超时的记录错误，不崩溃
```

**3. 工具结果怎么回填到消息历史中？顺序重要吗？**

**顺序重要，但不是执行顺序，而是模型请求的顺序。** 结果必须按 `tool_call_id` 对应回填，模型需要把每个结果和它自己发出的请求对应起来。

</details>

#### Q1.7 🔥 Claude Code 的 h2A 异步消息队列支持用户在 Agent 执行中途注入新指令。请设计一个类似的机制

<details>
<summary>查看答案</summary>

**1. 数据结构设计：**

```typescript
interface QueueMessage {
  id: string;
  type: 'user_instruction' | 'system_event' | 'abort';
  content: string;
  priority: 'high' | 'normal' | 'low';
  timestamp: number;
}

class AsyncMessageQueue {
  private buffer: QueueMessage[] = [];
  
  enqueue(msg: QueueMessage): void {
    if (msg.type === 'abort') {
      this.buffer.unshift(msg);  // abort 最高优先级
    } else {
      this.buffer.push(msg);
    }
  }
  
  async dequeue(): Promise<QueueMessage | null> {
    return this.buffer.length > 0 ? this.buffer.shift()! : null;
  }
  
  async waitForMessage(): Promise<QueueMessage> {
    if (this.buffer.length > 0) return this.buffer.shift()!;
    return new Promise(resolve => { this.waitResolve = resolve; });
  }
}
```

**2. 暂停/恢复实现：**

每轮循环开始时检查队列。收到 `abort` 立即终止；收到 `user_instruction` 追加到消息历史，如果当前在 ACT 阶段可能需要回到 PLAN 重新规划。暂停时调用 `waitForMessage()` 阻塞等待用户输入。

**3. 新指令注入后，当前正在执行的工具调用怎么处理？**

三种策略，取决于指令的优先级：

| 策略 | 行为 | 适用场景 |
|------|------|---------|
| 等待完成（默认） | 当前工具继续执行，完成后处理新指令 | 普通补充指令 |
| 优雅中断 | 当前工具继续，但跳过后续排队的工具 | 方向调整 |
| 立即中断 | AbortSignal 取消当前工具 | 紧急中断（Ctrl+C） |

</details>

#### Q1.8 设计一个子 Agent 生成和管理机制

<details>
<summary>查看答案</summary>

**核心设计原则（参考 Claude Code）：** 子 Agent 不能生成自己的子 Agent（"主从分治"模式）。

**1. 独立上下文窗口：**

```typescript
interface SubAgentConfig {
  id: string;
  task: string;
  allowedTools: string[];       // 工具白名单（受限）
  maxTurns: number;
  maxTokens: number;
  timeoutMs: number;
  canSpawnSubAgents: false;     // 硬编码为 false
}
```

子 Agent 拥有独立的消息历史，不共享主 Agent 的上下文。

**2. 防止递归生成（深度限制）：**

```typescript
async spawn(config: SubAgentConfig, depth: number = 0) {
  if (depth >= 1) throw new Error('Sub-agents cannot spawn sub-agents');
  if (this.activeSubAgents.size >= this.maxConcurrent) {
    throw new Error('Max concurrent sub-agents reached');
  }
  // ...
}
```

**3. 结果汇总回主 Agent：**

子 Agent 只返回**摘要**，不返回完整的消息历史——避免子 Agent 的详细过程污染主 Agent 的上下文窗口。

**为什么 Claude Code 选择最多 1 个子 Agent 分支：**
- Token 成本：N 个子 Agent ≈ N 倍成本
- 可预测性：多个子 Agent 并发修改代码会导致冲突
- 调试性：单线程 + 最多 1 个子 Agent = 清晰的执行轨迹

</details>

### 编码题

#### Q1.9 ⭐ 用 TypeScript 实现一个简化版的 Agent Loop

<details>
<summary>查看答案</summary>

```typescript
import { z } from 'zod';

interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (args: any) => Promise<string>;
}

async function agentLoop(
  userPrompt: string,
  tools: ToolDefinition[],
  options: { maxSteps?: number; systemPrompt?: string } = {}
): Promise<{ result: string; steps: number; totalTokens: number }> {
  const { maxSteps = 10, systemPrompt = 'You are a helpful assistant.' } = options;
  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  let totalTokens = 0;

  for (let step = 0; step < maxSteps; step++) {
    const response = await callModel(messages, tools);
    totalTokens += response.usage.input_tokens + response.usage.output_tokens;

    // finish_reason === 'stop' → 任务完成
    if (response.finish_reason === 'stop') {
      return { result: response.content, steps: step + 1, totalTokens };
    }

    // finish_reason === 'length' → 输出被截断，续写
    if (response.finish_reason === 'length') {
      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: 'Please continue.' });
      continue;
    }

    // finish_reason === 'tool_calls' → 执行工具
    messages.push({
      role: 'assistant', content: response.content,
      tool_calls: response.tool_calls,
    });

    for (const toolCall of response.tool_calls) {
      const toolDef = tools.find(t => t.name === toolCall.name);
      let toolOutput: string;

      if (!toolDef) {
        toolOutput = `Error: Unknown tool "${toolCall.name}"`;
      } else {
        try {
          const parsed = toolDef.parameters.safeParse(toolCall.arguments);
          if (!parsed.success) {
            toolOutput = `Error: Invalid arguments: ${parsed.error.message}`;
          } else {
            toolOutput = await toolDef.execute(parsed.data);
          }
        } catch (error) {
          // 执行失败 → 错误信息回填给模型，不崩溃
          toolOutput = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
      }

      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolOutput });
    }
  }

  return { result: 'Max steps reached.', steps: maxSteps, totalTokens };
}
```

**关键设计点：**
- `finish_reason` 三种情况都处理了：stop（完成）、tool_calls（继续）、length（截断续写）
- 工具执行失败时不抛异常，而是把错误信息作为 tool result 回填给模型
- 参数用 Zod 校验，校验失败也回填错误信息

</details>

#### Q1.10 用 TypeScript 实现一个流式 Agent Loop

<details>
<summary>查看答案</summary>

```typescript
interface StreamEvent {
  type: 'text_delta' | 'tool_call_start' | 'tool_call_done' | 'step_complete' | 'done' | 'error';
  data: unknown;
}

async function* streamAgentLoop(
  userPrompt: string,
  tools: ToolDefinition[],
  maxSteps = 10
): AsyncGenerator<StreamEvent> {
  const messages: Message[] = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: userPrompt },
  ];

  for (let step = 0; step < maxSteps; step++) {
    const stream = await streamModel(messages, tools);
    let fullContent = '';
    let toolCalls: ToolCall[] = [];
    let finishReason = 'stop';

    for await (const chunk of stream) {
      if (chunk.type === 'text_delta') {
        fullContent += chunk.text;
        yield { type: 'text_delta', data: { text: chunk.text, step } };
      }
      if (chunk.type === 'tool_call_delta') {
        toolCalls = mergeToolCallDeltas(toolCalls, chunk);
      }
      if (chunk.type === 'finish') {
        finishReason = chunk.finish_reason;
      }
    }

    if (finishReason === 'stop' || toolCalls.length === 0) {
      yield { type: 'done', data: { content: fullContent, steps: step + 1 } };
      return;
    }

    // 暂停流式输出，执行工具
    messages.push({ role: 'assistant', content: fullContent, tool_calls: toolCalls });

    for (const toolCall of toolCalls) {
      yield { type: 'tool_call_start', data: { tool: toolCall.name } };
      let toolOutput: string;
      try {
        const toolDef = tools.find(t => t.name === toolCall.name);
        toolOutput = toolDef
          ? await toolDef.execute(toolCall.arguments)
          : `Error: Unknown tool "${toolCall.name}"`;
      } catch (error) {
        toolOutput = `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: toolOutput });
      yield { type: 'tool_call_done', data: { tool: toolCall.name, output: toolOutput } };
    }

    yield { type: 'step_complete', data: { step: step + 1 } };
  }

  yield { type: 'error', data: { message: 'Max steps reached' } };
}
```

**关键设计点：**
- 使用 `AsyncGenerator`（`async function*` + `yield`）实现流式输出
- 文本 token 实时 yield 给前端，工具执行时暂停文本流
- 流式输出中 tool call 是分片到达的，需要累积合并成完整的 JSON
- 每个事件都有明确的 type，前端可以根据 type 做不同的 UI 渲染

</details>

---

## 跨项目对比

| 维度 | Claude Code | Codex CLI | Vercel AI SDK | Hermes Agent |
|------|------------|-----------|---------------|-------------|
| **循环模型** | 单线程 while loop（[nO 主循环](/claude_code_docs/agent/react-loop)） | 事件驱动循环（[Rust 核心](/codex_docs/agent/event-loop)） | 线性 step 循环 + maxSteps（[generateText](/vercel_ai_docs/agent/generate-text-loop)） | Python while loop（[双层循环](/hermes_agent_docs/agent/dual-loop)） |
| **语言/运行时** | TypeScript / Bun | Rust (codex-rs) + TS (codex-cli) | TypeScript / Node | Python / asyncio |
| **决策者** | 模型全权决定下一步 | 事件 + 审批流程 | 模型决定（maxSteps 限制） | 模型决定（max_turns 限制） |
| **并行工具执行** | 只读工具可并行，写入串行（toolOrchestration.ts） | 沙箱内执行，审批控制 | 不内置并行策略 | 分析安全性，只读并行，写入串行 |
| **用户中途介入** | h2A 异步队列（实时注入指令） | 事件驱动审批（ExecApproval / PatchApproval） | 不内置 | 无内置机制 |
| **子 Agent** | 最多 1 个子 Agent 分支（Agent Teams 实验性） | Agent 注册表 + 邮箱系统 | 不内置 | 无内置 |
| **安全阀** | maxTurns + maxBudgetUsd + 上下文监控 | exec policy + 沙箱隔离 | maxSteps | max_turns |
| **流式支持** | 有（Ink/React 渲染） | 有（事件流） | 有（streamText / ReadableStream） | 无（批量模式） |
| **设计哲学** | "Do the simple thing first" | "安全优先，沙箱隔离" | "开发者体验优先" | "可扩展的技能生态" |

---

## 设计模式与权衡

### 模式 1：ReAct 循环（Reasoning + Acting）

- **描述：** 模型在每一步决定是思考还是行动，形成"思考-行动-观察"的循环
- **使用项目：** Claude Code、Vercel AI SDK、Hermes Agent、Codex CLI
- **权衡：** 简单通用，但模型可能做出意外决策；依赖模型的推理质量

### 模式 2：事件驱动架构（Event-Driven）

- **描述：** 用事件循环 + 消息传递替代简单的 while loop，支持异步审批和中断
- **使用项目：** Codex CLI（Rust 事件循环）、Claude Code（h2A 异步队列）
- **权衡：** 更好的可中断性和并发控制，但增加了架构复杂度

### 模式 3：Provider 抽象层

- **描述：** 统一的模型接口，支持模型切换透明化和 fallback 链
- **使用项目：** Vercel AI SDK（最完善）、Hermes Agent（runtime_provider）
- **权衡：** 模型切换零成本，但抽象层可能隐藏模型特有的能力

### 模式 4：主从分治（Master-Worker）

- **描述：** 主 Agent 统筹全局，子 Agent 执行具体任务，结果汇总回主 Agent
- **使用项目：** Claude Code（Agent Teams）、Codex CLI（Agent 注册表 + 邮箱）
- **权衡：** 支持复杂任务分解，但成本约 N 倍（每个子 Agent 独立上下文）

### 模式 5：约束型 While Loop

- **描述：** 核心用简单的 while loop，但外围有大量约束（maxTurns、成本限制、权限系统、断路器）
- **使用项目：** Claude Code
- **权衡：** 核心极简、易于理解和调试，复杂性转移到边界控制上；但缺乏显式状态机的可观测性

---

## 答题策略

### 推荐答题结构

1. **先讲设计哲学**（30 秒）：说明 Agent Loop 的本质是 ReAct 模式的工程化，核心是"思考-行动-观察"循环
2. **再讲具体实现**（2 分钟）：对比 while loop vs 状态机，引用 Claude Code 的 nO 循环和 Vercel AI SDK 的 maxSteps
3. **最后讲权衡**（1 分钟）：说明你在什么场景下选择哪种方案，展示工程判断力

### 常见追问方向

- "Claude Code 用 while loop，为什么你要用状态机？说服我。"
  - 回答要点：while loop 适合通用编码助手，但生产级 Agent Harness 需要阶段级资源隔离、可审计轨迹、独立超时控制
- "并行工具执行时，结果顺序重要吗？"
  - 回答要点：按 `tool_call_id` 对应回填，不是按执行完成时间
- "如何实现 Human-in-the-Loop？"
  - 回答要点：Claude Code 的三层机制——权限系统 + Actions With Care 风险分级 + Hooks 可编程拦截

### 关键源码引用

- Claude Code 核心循环：`query.ts → queryLoop()`
- Claude Code 工具编排：`toolOrchestration.ts`
- Vercel AI SDK 循环：`generate-text.ts → generateText()`
- Codex 事件循环：`codex-rs/core/src/codex_delegate.rs`
- Hermes Agent 循环：`environments/agent_loop.py → HermesAgentLoop.run()`

---

## 深入阅读

### Claude Code

- [ReAct 循环工程化实现](/claude_code_docs/agent/react-loop) — nO 主循环、h2A 异步队列、工具编排策略的完整源码分析

### Codex CLI

- [事件驱动循环架构](/codex_docs/agent/event-loop) — Rust 核心事件循环、exec policy、沙箱执行模型的深度解析

### Vercel AI SDK

- [generateText 循环控制](/vercel_ai_docs/agent/generate-text-loop) — maxSteps、finishReason 处理、streamText 流式实现的框架级分析

### Hermes Agent

- [双 Agent 循环机制](/hermes_agent_docs/agent/dual-loop) — HermesAgentLoop（环境级）与 AIAgent（CLI 级）双层循环、并行工具执行策略

# 综合面试题

本页汇集了 Agent Harness 面试中的跨模块综合题目，涵盖系统设计、TypeScript/Bun/流式处理、分布式系统模式、行为面试、跨项目对比、工具注册、Prompt Engineering、安全权限、可观测性、性能优化、模型路由、RL 训练、配置生态、MCP 协议、多 Agent 编排、Checkpoint 恢复以及设计哲学总结等方向。

标记说明：⭐ = 高频必考 | 🔥 = 深度追问 | 💡 = 加分项

---

## 七、系统设计综合题（面试高频）

#### Q7.1 ⭐⭐ 请从零设计一个 Agent Harness 架构，要求能在生产环境中稳定运行 8 小时。请涵盖：核心 Agent Loop 设计、上下文管理策略、记忆系统、错误恢复、Token 预算管理、安全和权限。

<details>
<summary>查看答案</summary>

这是最核心的面试题。用 5 分钟讲清楚整体架构，然后准备好被追问任何一个模块的细节。

**架构总览**

```
用户请求 → 入口层 → 模式分发 → 上下文组装 → Agent Loop → 输出渲染
                                      ↕
                              ┌───────┴───────┐
                              │   核心子系统    │
                              ├───────────────┤
                              │ 压缩管道 (5级) │
                              │ 记忆系统       │
                              │ 错误恢复链     │
                              │ Token Budget  │
                              │ 推测执行       │
                              │ 权限/安全      │
                              └───────────────┘
```

**6 个子系统的设计要点**

1. **Agent Loop**: Phase 管道（plan→act→observe→reflect），外层 while loop + 内层状态机。每个 Phase 有独立的工具权限、超时、token 预算。

2. **上下文管理**: 五级压缩管道（tool-budget→snip→micro→collapse→auto），从便宜到昂贵逐级触发。互斥门控（L4 和 L5），断路器（L5）。

3. **记忆系统**: Markdown 文件 + 索引（< 25KB），四种类型（user/feedback/project/reference），Dream Mode 定期整合，sideQuery 语义检索。

4. **错误恢复**: 分类（PTL/max-tokens/model-unavailable/rate-limit/tool-timeout），恢复链（compress→upgrade→fallback→retry），Provider 抽象层支持模型热切换。

5. **Token Budget**: 跨压缩边界追踪，按角色分配预算（system/memory/history/tools/output），maxBudgetUsd 硬停止，缓存感知的成本计算。

6. **推测执行**: OverlayFS 虚拟层，快照+回滚，diff 预览，用户确认后原子提交。

**8 小时稳定运行的关键保障**

1. 分层防御：不依赖单一机制，每层都有 fallback
2. 断路器：防止失败操作无限重试
3. 状态持久化：崩溃后可以从 checkpoint 恢复
4. 资源预算：token 和成本都有硬上限
5. 渐进式压缩：90% 的会话只需要零成本的 L1+L2
6. 记忆整合：Dream Mode 防止记忆无限膨胀

</details>

#### Q7.2 ⭐ Agent 运行 4 小时后，上下文窗口使用率达到 95%。请描述完整的恢复流程。

<details>
<summary>查看答案</summary>

```
95% 使用率 → 已经跳过了 L1-L3（它们在 70-85% 时已触发）

Step 1: 检查 L4 Collapse 是否启用
  是 → 追加新的 collapse commit，投影压缩视图
  否 → 进入 L5

Step 2: L5 Auto-Compact
  检查断路器 → 未触发 → 执行 LLM 摘要
  结构化摘要保留: 意图、文件、错误、任务状态、用户指令原文
  
Step 3: 如果 L5 失败（PTL）
  丢弃最旧 1/4 轮组 → 重试
  再失败 → 丢弃 1/2 → 重试
  再失败 → 断路器触发

Step 4: 断路器触发后
  暴力 Snip: 只保留 system prompt + 最近 5 条 + 记忆文件
  插入 "[Context aggressively compacted]"
  
Step 5: 如果仍然 > 98%
  L6 Blocking: 阻止新增上下文
  通知用户: "上下文已满，建议开始新会话或手动 /compact"
```

</details>

#### Q7.3 ⭐ 你的 Agent 需要同时处理 5 个用户的请求。请设计多租户架构：上下文隔离、资源分配、错误隔离。

<details>
<summary>查看答案</summary>

每个用户一个独立的 AgentSession：

```typescript
class AgentSession {
  id: string;
  userId: string;
  messages: Message[];           // 独立的消息历史
  memoryStore: MemoryStore;      // 独立的记忆
  budgetManager: TokenBudgetManager; // 独立的预算
  compressor: MultiLevelCompressor;  // 独立的压缩器
}
```

- **上下文隔离**: 每个 session 有独立的消息历史和记忆，互不可见
- **资源分配**: 每个 session 有独立的 token 预算和成本上限
- **错误隔离**: 一个 session 的错误（PTL、工具崩溃）不影响其他 session

实现方式：
- 进程级隔离：每个 session 一个 worker 进程（最安全，成本最高）
- 线程级隔离：每个 session 一个 worker thread（中等）
- 协程级隔离：每个 session 一个 async context（最轻量，但错误隔离弱）

</details>

#### Q7.4 🔥 面试官说："Claude Code 的核心就是一个 while loop，为什么你要用状态机？说服我。"

<details>
<summary>查看答案</summary>

> "你说得对，Claude Code 的核心确实是一个 while loop，而且它在生产环境中运行得很好。但我选择在 while loop 内部加入 Phase 管道，原因有三个：
>
> 第一，**资源隔离**。8 小时的长运行任务中，如果 plan 阶段的一次超时吃掉了 act 阶段的时间预算，整个任务就会失控。Phase 管道让每个阶段有独立的超时和 token 预算。
>
> 第二，**可审计性**。生产环境中，当 Agent 出问题时，我需要知道它在哪个阶段花了多少时间。while loop 只能告诉你'在循环中'，Phase 管道能告诉你'在 observe 阶段的第 3 次验证中'。
>
> 第三，**工具权限分级**。plan 阶段只需要只读工具，act 阶段需要写入权限。Phase 管道让我可以按阶段收窄工具权限，减少攻击面。
>
> 但我完全同意 Claude Code 的设计哲学：简单优先。如果场景不需要这些，while loop 就够了。Phase 管道是在 while loop 基础上的增量复杂性，不是替代。"

</details>

#### Q7.5 🔥 面试官说："你的五级压缩管道太复杂了，三级就够了。你怎么反驳？"

<details>
<summary>查看答案</summary>

> "三级确实能覆盖大部分场景。如果要精简到三级，我会保留：
>
> - L1 Tool Result Budget（零成本，必须有）
> - L2 Snip（零成本，效果好）
> - L5 Auto-Compact（最后手段）
>
> 但五级的价值在于**中间层**。L3 Micro 利用缓存 TTL 窗口做机会性清理，成本几乎为零但能延迟 L5 的触发。L4 Collapse 用 CQRS 模式避免了 LLM 调用。
>
> 实际数据：90% 的会话只需要 L1+L2，成本为零。L3+L4 让另外 8% 的会话也不需要 L5。只有 2% 的极长会话才会触发 L5。
>
> 所以五级的复杂度换来的是：98% 的会话不需要昂贵的 LLM 摘要调用。如果你的场景中会话都很短，三级确实够了。"

</details>

#### Q7.6 🔥 面试官说："Markdown 记忆太原始了，为什么不用向量数据库？"

<details>
<summary>查看答案</summary>

> "向量数据库解决的是'怎么找'的问题。但 Agent 记忆的真正难题是'怎么维护'——过期的要删、矛盾的要解决、分散的要整合。
>
> Markdown 的优势：LLM 天生擅长读写文本，零依赖，人类可读可编辑，可以 git 管理。Dream Mode 解决维护问题。
>
> 向量数据库的优势：大规模语义检索。但 Agent 的个人记忆通常不超过几百条，索引 < 25KB，关键词搜索就够了。
>
> 如果记忆量增长到数万条，或者需要跨用户的知识库检索，我会引入向量数据库作为 sideQuery 的检索后端。但存储层仍然用 Markdown——向量数据库做索引，Markdown 做存储。两者不矛盾。"

</details>

#### Q7.7 💡 对比 Vercel AI SDK、Claude Code、Codex CLI 三个 Runtime 的 Agent Loop 设计。各自的优缺点是什么？如果让你设计第四个，你会怎么做？

<details>
<summary>查看答案</summary>

设计"第四个"的思路：

取 Claude Code 的：
- 单线程主循环（简单可靠）
- 7 层上下文防御（分层防御）
- Markdown 记忆 + Dream Mode（简单有效）
- 权限系统 + Hooks（治理即架构）

取 Vercel AI SDK 的：
- Provider 抽象层（模型 fallback）
- 流式输出 API（DX 友好）

取 Codex CLI 的：
- 沙箱执行模型（推测执行的基础）

自己加的：
- Phase 管道（资源隔离 + 可审计）
- 跨压缩边界的 Token Budget 追踪
- 结构化的错误恢复链（不是 ad-hoc 的 try-catch）

</details>


---

## 八、TypeScript / Bun / 流式处理（技术栈深度题）

### TypeScript

#### Q8.1 ⭐ 用 TypeScript 的泛型和条件类型，设计一个类型安全的工具注册系统：工具有 name、parameters（Zod schema）、execute 函数。注册后，调用工具时参数类型自动推导，工具结果类型也自动推导。

<details>
<summary>查看答案</summary>

```typescript
import { z } from 'zod';

// 工具定义：name + parameters(Zod) + execute
interface Tool<TName extends string, TParams extends z.ZodType, TResult> {
  name: TName;
  description: string;
  parameters: TParams;
  execute: (args: z.infer<TParams>) => Promise<TResult>;
}

// 工具注册表：从工具数组推导出类型映射
type ToolRegistry<T extends Tool<string, z.ZodType, any>[]> = {
  [K in T[number]['name']]: Extract<T[number], { name: K }>;
};

// 类型安全的工具调用
function callTool<
  T extends Tool<string, z.ZodType, any>[],
  N extends T[number]['name']
>(
  registry: ToolRegistry<T>,
  name: N,
  args: z.infer<Extract<T[number], { name: N }>['parameters']>
): Promise<ReturnType<Extract<T[number], { name: N }>['execute']>> {
  const tool = registry[name];
  const parsed = tool.parameters.parse(args); // 运行时校验
  return tool.execute(parsed);
}

// 使用示例
const readFile = {
  name: 'read_file' as const,
  description: 'Read a file',
  parameters: z.object({ path: z.string() }),
  execute: async (args: { path: string }) => ({ content: '...' }),
};

const grep = {
  name: 'grep' as const,
  description: 'Search in files',
  parameters: z.object({ pattern: z.string(), path: z.string().optional() }),
  execute: async (args: { pattern: string; path?: string }) => ({ matches: [] }),
};

// 类型自动推导：callTool(registry, 'read_file', { path: 'x' }) ← 参数类型自动推导
```

</details>

#### Q8.2 `Promise.all` 和 `Promise.allSettled` 在并行工具执行中分别适用什么场景？为什么 Agent 的工具并行执行更适合用 `Promise.allSettled`？

<details>
<summary>查看答案</summary>

```typescript
// Promise.all: 一个失败，全部失败
const results = await Promise.all([toolA(), toolB(), toolC()]);
// 如果 toolB 抛异常 → toolA 和 toolC 的结果也丢了 ❌

// Promise.allSettled: 每个独立结算
const results = await Promise.allSettled([toolA(), toolB(), toolC()]);
// toolB 失败 → results[1].status === 'rejected'
// toolA 和 toolC 的结果正常返回 ✅

// Agent 工具并行执行必须用 allSettled
// 因为一个工具失败不应该丢弃其他工具的结果
// 失败的工具结果作为错误信息回填给模型
```

</details>

#### Q8.3 解释 TypeScript 中 `ReadableStream`、`TransformStream`、`WritableStream` 的关系。在流式 Agent Loop 中，它们分别用在哪里？

<details>
<summary>查看答案</summary>

```
ReadableStream: 数据源（模型输出的 token 流）
TransformStream: 中间处理（检测 tool call、格式转换）
WritableStream: 数据消费（前端渲染、日志记录）

在流式 Agent Loop 中:
  模型 API → ReadableStream（原始 token）
    → TransformStream（解析 tool call delta、累积 JSON）
    → TransformStream（格式化为 SSE 事件）
    → WritableStream（发送给前端）
```

</details>

### Bun

#### Q8.4 Bun 和 Node.js 的主要差异是什么？为什么 Claude Code 选择 Bun？

<details>
<summary>查看答案</summary>

| 维度 | Bun | Node.js |
|------|-----|---------|
| TS 支持 | 原生，无需编译 | 需要 tsc 或 tsx |
| 启动速度 | ~5x 更快 | 较慢 |
| 包管理 | 内置，极快 | npm/yarn/pnpm |
| Web API | 原生支持 fetch、WebSocket | 需要 polyfill 或 node 18+ |
| 生态兼容 | 大部分 npm 包兼容 | 完全兼容 |
| 宏系统 | feature() 编译时宏 | 无 |

Claude Code 选择 Bun 的原因：原生 TS、快速启动（CLI 工具需要）、feature() 宏做内部/外部版本区分。

</details>

#### Q8.5 💡 Bun 的 `feature()` 宏是什么？Claude Code 怎么用它做内部/外部版本区分？这种编译时特性开关和运行时 if/else 有什么区别？

<details>
<summary>查看答案</summary>

```typescript
// Bun 的 feature() 宏：编译时特性开关

// 源码中:
if (feature('BUDDY')) {
  // 虚拟宠物功能
  initBuddySystem();
}

// 外部构建时（BUDDY=false）:
// 整个 if 块被 AST 级别删除，不是运行时跳过
// 最终产物中完全没有 initBuddySystem 的代码

// 运行时 if/else 的区别:
if (process.env.BUDDY === 'true') {
  initBuddySystem(); // 代码仍然在 bundle 中，只是不执行
}

// feature() 的优势:
// 1. 更小的 bundle（死代码被物理删除）
// 2. 无法通过修改环境变量启用（更安全）
// 3. 内部功能不会泄露到外部版本
```

</details>

### 流式处理

#### Q8.6 ⭐ 什么是背压（backpressure）？在流式 Agent 输出中，如果消费者（前端 UI）处理速度跟不上生产者（模型输出），会发生什么？怎么处理？

<details>
<summary>查看答案</summary>

```
问题: 模型输出速度 > 前端渲染速度
  → 数据在内存中堆积
  → 内存溢出

背压机制: 消费者告诉生产者"慢一点"

在 Web Streams API 中:
  ReadableStream 有内置的背压支持
  当 WritableStream 的内部队列满了
  → ReadableStream 自动暂停读取
  → 模型 API 的 HTTP 连接也会暂停接收数据
  → 整个管道自动调节速度

实际处理:
  1. 使用 pipeTo/pipeThrough（自动背压）
  2. 设置 highWaterMark（队列大小上限）
  3. 监控队列大小，必要时丢弃非关键数据
```

</details>

#### Q8.7 设计一个流式输出系统，支持：SSE 传输、流式输出过程中检测 tool call、流式输出的取消和中断、错误在流中的传播。

<details>
<summary>查看答案</summary>

```typescript
// SSE 传输
function streamToSSE(stream: AsyncIterable<StreamEvent>): ReadableStream {
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const event of stream) {
          const sseData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(sseData));
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    }
  });
}

// 取消机制
const abortController = new AbortController();
// 用户按 Ctrl+C
process.on('SIGINT', () => abortController.abort());
// 传递给 Agent Loop
const stream = streamAgentLoop(prompt, tools, { signal: abortController.signal });
```

</details>

#### Q8.8 🔥 流式输出过程中，模型输出了一半的 JSON tool call（比如 `{"name": "read_file", "arg`），然后连接断了。怎么处理？

<details>
<summary>查看答案</summary>

核心策略：不尝试修复不完整的 JSON，保留已输出的文本，让模型重新生成 tool call。

已经输出的部分保留在消息历史中作为 assistant 消息，但标记为 incomplete。重试时，模型会看到之前的不完整输出，并重新生成完整的 tool call。不要尝试 JSON 修复——部分 JSON 的语义是不确定的，修复可能导致错误的工具调用。

</details>


---

## 九、分布式系统模式（架构深度题）

#### Q9.1 ⭐ 解释 CQRS（命令查询职责分离）模式。Claude Code 的 Context Collapse 怎么应用了这个模式？

<details>
<summary>查看答案</summary>

核心：对话历史是命令日志（source of truth），API 看到投影视图（读模型）。UI 保留完整历史，API 看到压缩版本。

CQRS 在 Context Collapse 中的应用：写入端（命令）只追加消息到完整历史，读取端（查询）通过 collapse commit 投影出压缩视图发送给 API。两个视图独立演化，互不干扰。

</details>

#### Q9.2 ⭐ 解释断路器（Circuit Breaker）模式。在 Agent Runtime 中，哪些地方需要断路器？

<details>
<summary>查看答案</summary>

需要断路器的地方：

| 位置 | 触发条件 | 断路后行为 |
|------|---------|-----------|
| Auto-Compact (L5) | 连续 3 次摘要失败 | 降级到 Snip |
| 模型 API 调用 | 连续 5 次 500 错误 | 切换到备用模型 |
| 工具执行 | 同一工具连续 3 次超时 | 标记工具为不可用 |
| 子 Agent | 子 Agent 连续 2 次失败 | 停止派生子 Agent |

</details>

#### Q9.3 什么是事件溯源（Event Sourcing）？Agent 的消息历史可以看作事件日志吗？这对压缩和恢复有什么影响？

<details>
<summary>查看答案</summary>

```
Agent 的消息历史天然就是事件日志:
  Event 1: { type: 'user_message', content: '...' }
  Event 2: { type: 'assistant_response', content: '...', tool_calls: [...] }
  Event 3: { type: 'tool_result', tool_call_id: '...', content: '...' }
  Event 4: { type: 'assistant_response', content: '...' }

事件溯源的好处:
  - 可以从任意时间点重放（replay）
  - 可以回滚到任意 checkpoint
  - 压缩 = 对事件日志做快照（snapshot）
  - 恢复 = 加载快照 + 重放快照之后的事件
```

</details>

#### Q9.4 🔥 设计一个 Agent 会话的持久化和恢复机制：会话状态包含哪些内容？怎么序列化和反序列化？崩溃后怎么恢复到最近的一致状态？恢复后，正在执行的工具调用怎么处理？

<details>
<summary>查看答案</summary>

```typescript
interface SessionState {
  id: string;
  messages: Message[];
  phase: Phase;
  iteration: number;
  tokenBudget: { total: number; used: number; costUsd: number };
  activeTasks: Task[];
  memoryIndex: MemoryIndex;
  compressorState: { collapseLog: CollapseCommit[]; circuitBreakerOpen: boolean };
  timestamp: string;
}

// 持久化: 每轮循环结束后保存
async function checkpoint(state: SessionState): Promise<void> {
  await writeFile(`sessions/${state.id}.json`, JSON.stringify(state));
}

// 恢复: 从最近的 checkpoint 加载
async function restore(sessionId: string): Promise<SessionState> {
  const state = JSON.parse(await readFile(`sessions/${sessionId}.json`));
  // 正在执行的工具调用: 标记为 failed（无法恢复中间状态）
  // 在恢复后的第一轮循环中，模型会看到工具失败的信息并决定是否重试
  return state;
}
```

</details>

#### Q9.5 💡 如果要把 Agent Runtime 从单机扩展到分布式集群，最大的挑战是什么？你会怎么设计？

<details>
<summary>查看答案</summary>

最大挑战：会话状态的一致性。

- **方案 1: 会话亲和性（Session Affinity）** — 同一个会话始终路由到同一个节点。简单，但节点故障时需要迁移。
- **方案 2: 共享状态存储** — 消息历史存在 Redis/数据库中，任何节点都可以处理任何会话。但每次 API 调用前都要加载状态，延迟增加。
- **方案 3: 事件溯源 + 快照** — 事件日志存在 Kafka/消息队列中，快照存在对象存储中，任何节点都可以从快照 + 事件重建状态。最灵活，但最复杂。

</details>


---

## 十、行为面试题 / 开放讨论题

#### Q10.1 你研究过哪些 Agent Runtime？它们的设计哲学有什么不同？你最欣赏哪个设计决策？

<details>
<summary>查看答案</summary>

> "我深入研究了三个 Runtime：
>
> Vercel AI SDK 的哲学是'开发者体验优先'——streamText 的 API 设计非常优雅，但它把复杂性留给了使用者（没有内置压缩、记忆、错误恢复）。
>
> Claude Code 的哲学是'简单优先，复杂性只在需要时添加'——核心是一个 while loop，但外围有 7 层上下文防御、43 个权限门控的工具、Dream Mode 记忆整合。
>
> Codex CLI 的哲学是'安全优先'——沙箱执行模型确保 Agent 不会破坏宿主环境。
>
> 我最欣赏 Claude Code 的'记忆即维护'决策——用 Markdown 而不是向量数据库，用 Dream Mode 做定期整合。这个洞察是：LLM 天生擅长读写文本，瓶颈不是存储，而是维护。"

</details>

#### Q10.2 如果让你从零开始设计一个 Agent Runtime，你会做的第一个设计决策是什么？为什么？

<details>
<summary>查看答案</summary>

> "我的第一个决策是：**消息历史只追加，不修改**。
>
> 这一个决策决定了后续所有的架构选择：
> - 压缩不能修改历史 → 需要 CQRS 投影视图
> - 只追加 → 最大化 prompt cache 命中率
> - 完整历史保留 → 可以回滚到任意时间点
> - UI 和 API 看到不同视图 → 需要分层
>
> Claude Code 也做了同样的选择，这不是巧合。"

</details>

#### Q10.3 "简单优先"和"为未来扩展预留"之间怎么平衡？举一个你在实际项目中做过这种权衡的例子。

<details>
<summary>查看答案</summary>

> "Claude Code 的演进路径是最好的例子：
> - v1: while loop + TODO list（最简单）
> - v2: 加入 Tasks 系统（持久化 + 依赖）
> - v3: 加入 Agent Teams（多 Agent 并行）
>
> 每一步都是在遇到真实限制后才添加复杂性。TODO list 在内存中丢失了 → 加持久化。单 Agent 太慢了 → 加 Teams。
>
> 我的原则：先用最简单的方案上线，等它在生产环境中真正遇到问题，再添加复杂性。预留接口可以，但不要预先实现。"

</details>

#### Q10.4 Agent 系统的安全性和易用性之间怎么平衡？太多确认对话框会导致"确认疲劳"，太少又不安全。你怎么设计？

<details>
<summary>查看答案</summary>

> "Claude Code 的 auto 模式是最好的平衡案例：
>
> - 不是完全放飞：有独立的分类器模型审查每次操作
> - 不是每次都问：只在高风险操作时才中断
> - 渐进式信任：default → acceptEdits → auto
> - 进入 auto 时主动收窄权限（丢弃宽泛的 allow 规则）
>
> 关键洞察：'确认疲劳'比'没有确认'更危险。如果用户每次都点'允许'，确认就失去了意义。所以要让确认只出现在真正重要的时刻。"

</details>

#### Q10.5 你认为 AI Agent Runtime 在未来 2-3 年会怎么演进？哪些是当前的技术瓶颈？

<details>
<summary>查看答案</summary>

> "三个方向：
>
> 1. **上下文窗口会继续增大，但压缩仍然重要**。即使有 1M token 窗口，8 小时的会话仍然会填满它。而且更大的窗口 = 更高的成本，压缩是成本优化。
>
> 2. **多 Agent 协作会成熟**。目前 Claude Code 的 Agent Teams 还是实验性的（5x 成本）。未来会有更高效的协调机制，可能基于共享状态而不是消息传递。
>
> 3. **安全和治理会成为核心竞争力**。随着 Agent 能力增强，企业最关心的不是'它能做什么'，而是'它不能做什么'。权限系统、审计日志、沙箱隔离会从附加功能变成核心卖点。
>
> 当前瓶颈：上下文管理（压缩的信息损失）、工具执行的可靠性（沙箱的性能开销）、多 Agent 协调的成本。"

</details>


---

## 十一、跨项目对比题（面试高频 ★★★★★）

#### Q11.1 ⭐⭐ 对比 Claude Code、Codex CLI、Vercel AI SDK、Hermes Agent 四个 Agent Runtime 的 Agent Loop 设计。各自的优缺点是什么？你会怎么设计第五个？

<details>
<summary>查看答案</summary>

| 维度 | Claude Code | Codex CLI | Vercel AI SDK | Hermes Agent |
|------|------------|-----------|---------------|-------------|
| 语言 | TypeScript (Bun) | Rust (tokio) | TypeScript (Node) | Python (asyncio) |
| 循环类型 | while(true) + State 对象 | 事件驱动 match | for loop + maxSteps | 双循环（AIAgent + HermesAgentLoop） |
| 决策者 | 模型全权决定 | 事件匹配 | 模型 + stopCondition | 模型决定 |
| 工具并行 | 只读并行，写入串行 | 串行（审批驱动） | Promise.all 全部并行 | 读写分离 + 路径重叠检测 |
| 流式工具执行 | 有（边收边执行） | 无 | 无 | 无 |
| 中途中断 | h2A 异步队列 | cancellation token | AbortSignal | _interrupt_requested |
| 子 Agent | 最多 1 个分支 | 注册表 + 邮箱 + 深度限制 | 无内置 | delegate_task + 独立 IterationBudget |
| 安全阀 | maxTurns + maxBudgetUsd + 断路器 | 事件循环自然终止 | maxSteps（默认 1） | IterationBudget（默认 90） |

**设计第五个的思路**：取 Claude Code 的 while(true) + StreamingToolExecutor，Hermes 的路径重叠检测，Codex 的三层沙箱 + Claude Code 的 Actions With Care，Vercel AI SDK 的 LanguageModelV4 接口，Hermes 的 Gateway 架构，Claude Code 的分层防御 + Hermes 的迭代摘要更新，Vercel AI SDK 的 Zod tool()。

</details>

#### Q11.2 ⭐ 四个项目的工具注册模式完全不同：Claude Code 的 `buildTool()`、Codex 的 Starlark exec policy、Vercel AI SDK 的 Zod `tool()`、Hermes 的自注册 `registry.register()`。对比它们的设计哲学和适用场景。

<details>
<summary>查看答案</summary>

| 维度 | Claude Code `buildTool()` | Codex Starlark | Vercel AI SDK `tool()` | Hermes `registry.register()` |
|------|--------------------------|----------------|----------------------|------------------------------|
| 定义方式 | 工厂函数，声明元数据 | 策略文件（.star） | Zod schema + execute | 自注册（模块导入时） |
| 类型安全 | 弱（运行时） | 无 | 强（Zod → TS 推导） | 弱（JSON Schema） |
| 动态可用性 | 无 | exec policy 评估 | 无 | check_fn 运行时检查 |
| 分组 | 无内置分组 | 无 | 无 | Toolset 组合 + 循环检测 |
| 权限集成 | 工具级 allow/deny | 命令级 Starlark 策略 | experimental_approvalRequired | 基础审批 |

**设计哲学差异**：
- Claude Code：**工具是一等公民**，每个工具有完整的元数据
- Codex：**安全是一等公民**，工具通过策略引擎控制
- Vercel AI SDK：**类型安全是一等公民**，Zod schema 让参数和结果类型在编译时可检查
- Hermes：**可扩展性是一等公民**，自注册 + toolset 组合让添加新工具零摩擦

</details>

#### Q11.3 ⭐ 对比四个项目的上下文压缩策略。Claude Code 有 7 层防御（92% 阈值），Hermes Agent 有结构化摘要（50% 阈值），Codex 只有基础截断，Vercel AI SDK 不提供。为什么会有这么大的差异？

<details>
<summary>查看答案</summary>

| 维度 | Claude Code | Hermes Agent | Codex | Vercel AI SDK |
|------|------------|-------------|-------|---------------|
| 层级数 | 7 层 | 2 层 | 1 层 | 0 层 |
| 触发阈值 | 70%/85%/92% 分级 | 50% 单一 | 自动 | N/A |
| LLM 摘要 | 有（L5 Auto-Compact） | 有（结构化 7 节模板） | 有（基础） | 无 |
| 迭代更新 | 无 | 有（_previous_summary） | 无 | N/A |
| 缓存感知 | 三分区（fresh/frozen/must-reapply） | Anthropic prompt caching | 无 | N/A |
| CQRS 分离 | 有（UI 真相 vs API 真相） | 无 | 无 | N/A |
| 断路器 | 有（连续失败停止） | 有（600 秒冷却） | 无 | N/A |

差异源于定位不同：Claude Code 是长运行编码 Agent，Hermes 是通用 Agent 平台，Codex 的设计重心在沙箱安全，Vercel AI SDK 是框架不做产品级决策。

</details>

#### Q11.4 🔥 对比四个项目的安全/权限模型。Claude Code 的 Actions With Care + Hooks、Codex 的 Starlark + Seatbelt/Landlock、Hermes 的基础审批、Vercel AI SDK 的 tool approval。哪个最适合生产环境？

<details>
<summary>查看答案</summary>

| 维度 | Claude Code | Codex | Hermes | Vercel AI SDK |
|------|------------|-------|--------|---------------|
| 权限模型 | Actions With Care | Starlark 策略 + Guardian | 基础审批 + skills_guard | tool approval |
| 沙箱 | Seatbelt/Bubblewrap（OS 级） | Landlock/Seatbelt + 网络代理 | Docker/Modal/Daytona（容器级） | 无 |
| Auto 模式 | 独立分类器审查 + 丢弃宽泛规则 | 无 | 无 | 无 |
| Prompt injection 防御 | trust verification | 命令规范化 | _scan_context_content() | 无 |
| Hook 系统 | PreToolUse/PostToolUse | 事件驱动审批 | pre/post_tool_call 插件钩子 | 无 |

最适合生产环境的是 **Codex 的模型**（OS 级沙箱 + Starlark 可编程策略 + Guardian 自动过滤），但 Claude Code 的 **Actions With Care 框架**在用户体验上更好。

</details>

#### Q11.5 🔥 对比四个项目的记忆系统。设计一个综合最佳实践的记忆系统。

<details>
<summary>查看答案</summary>

取各家之长：

1. **用户显式记忆**（来自 Claude Code 的 CLAUDE.md / Codex 的 AGENTS.md）— 用户手动编写的稳定规则，沿目录树向上查找并合并
2. **Agent 自动学习记忆**（来自 Claude Code 的 Auto Memory）— Agent 自动学习的模式和偏好，按工作树隔离
3. **插件化记忆后端**（来自 Hermes 的 MemoryManager）— 内置 Provider + 最多 1 个外部 Provider，记忆上下文围栏
4. **记忆整合循环**（来自 Claude Code 的 Dream Mode）— 空闲时自动整合：Orient → Gather → Consolidate → Prune
5. **语义检索**（来自 Claude Code 的 sideQuery）— 不污染主上下文的独立检索
6. **结构化摘要保留**（来自 Hermes 的迭代摘要更新）— 压缩时增量更新之前的摘要

</details>

#### Q11.6 💡 四个项目用了四种不同的语言/运行时。语言选择如何影响了架构设计？

<details>
<summary>查看答案</summary>

| 语言 | 项目 | 架构影响 |
|------|------|---------|
| TypeScript/Bun | Claude Code | feature() 宏做编译时特性开关；Ink/React 做终端 UI；单线程 + StreamingToolExecutor |
| Rust/tokio | Codex | 内存安全保证沙箱不被绕过；async/await + channel 做事件驱动；Landlock/seccomp 直接调用系统 API |
| TypeScript/Node | Vercel AI SDK | Web Streams API 做流式处理（Edge 兼容）；Zod + 泛型做类型安全；Monorepo + tsup 管理 50+ 包 |
| Python/asyncio | Hermes | ThreadPoolExecutor 桥接 sync/async；动态导入做工具发现；YAML 配置做技能定义 |

语言选择不是偶然的：Rust 选择了安全和性能，TypeScript/Bun 选择了开发速度和生态，Python 选择了 ML 生态兼容，TypeScript/Node 选择了 Web 兼容。

</details>


---

## 十二、工具注册与发现（★★★★）

#### Q12.1 ⭐ 设计一个工具注册系统，要求：新工具只需要在自己的文件中声明，支持动态启用/禁用，支持工具分组（toolset）。

<details>
<summary>查看答案</summary>

```python
class ToolEntry:
    name: str                    # 工具名
    toolset: str                 # 所属工具集
    schema: dict                 # JSON Schema（参数定义）
    handler: Callable            # 执行函数
    check_fn: Callable → bool    # 动态可用性检查
    is_read_only: bool           # 是否只读（并行执行判断）
    max_result_size: int         # 结果大小上限

class ToolRegistry:
    _tools: Dict[str, ToolEntry]
    
    def register(self, **kwargs):
        """自注册：每个工具模块在导入时调用"""
        entry = ToolEntry(**kwargs)
        self._tools[entry.name] = entry
    
    def get_definitions(self, tool_names: Set[str]) -> List[dict]:
        """返回可用工具的 schema（check_fn 通过的）"""
        return [
            {"type": "function", "function": entry.schema}
            for name, entry in self._tools.items()
            if name in tool_names and entry.check_fn()
        ]
    
    def dispatch(self, name: str, args: dict, **kwargs) -> str:
        """分发工具调用"""
        entry = self._tools.get(name)
        if not entry:
            return json.dumps({"error": f"Unknown tool: {name}"})
        args = coerce_args(args, entry.schema)
        return entry.handler(args, **kwargs)
```

</details>

#### Q12.2 🔥 Hermes Agent 的 `coerce_tool_args()` 会自动将 LLM 返回的字符串参数强转为 JSON Schema 声明的类型。这个设计的利弊是什么？Vercel AI SDK 用 Zod parse 做参数校验，两种方式的权衡是什么？

<details>
<summary>查看答案</summary>

| 维度 | Hermes coerce_tool_args | Vercel AI SDK Zod parse |
|------|------------------------|------------------------|
| 策略 | 宽容（"42"→42，"true"→true） | 严格（类型不匹配→抛异常） |
| 失败处理 | 静默保留原值 | 抛出 InvalidToolInputError |
| 修复机会 | 无（直接执行） | toolCallRepair 函数 |
| 类型安全 | 弱（运行时） | 强（编译时 + 运行时） |

**最佳实践**：两者结合——先 coerce（宽容），再 Zod parse（严格）。coerce 处理常见的类型偏差，Zod 捕获真正的格式错误。

</details>

#### Q12.3 设计一个工具可用性检查系统（类似 Hermes 的 `check_fn`）：工具注册时声明前置条件，运行时动态检查，不满足条件的工具不出现在模型的工具列表中。

<details>
<summary>查看答案</summary>

```python
def check_web_search():
    """web_search 需要 API key"""
    return bool(os.getenv("OPENROUTER_API_KEY") or os.getenv("OPENAI_API_KEY"))

def check_terminal():
    """terminal 需要 shell 可用"""
    return shutil.which("bash") is not None or shutil.which("sh") is not None

def check_browser():
    """browser 需要 playwright 安装"""
    try:
        import playwright
        return True
    except ImportError:
        return False

# 注册时声明 check_fn
registry.register(name="web_search", check_fn=check_web_search, ...)
registry.register(name="terminal", check_fn=check_terminal, ...)

# get_definitions 时过滤：check_fn 返回 False → 工具不出现在模型的工具列表中
# → 模型不会调用不可用的工具 → 减少幻觉
```

</details>

---

## 十三、Prompt Engineering 在 Agent 中的应用（★★★★）

#### Q13.1 ⭐ Claude Code 的系统提示词有 914 行，分为静态区和动态区。为什么要这样分？这和 Anthropic 的 prompt caching 有什么关系？

<details>
<summary>查看答案</summary>

静态区（SYSTEM_PROMPT_DYNAMIC_BOUNDARY 之前）：身份定义、安全指令、编码行为约束、工具使用规范、输出格式约束 → 所有用户相同 → 可以被 Anthropic prompt cache 缓存。

动态区（SYSTEM_PROMPT_DYNAMIC_BOUNDARY 之后）：用户语言偏好、MCP 服务器指令、环境信息、会话记忆 → 每个用户/会话不同 → 不能缓存。

为什么这样分？Anthropic prompt caching 要求发送内容的前缀必须和缓存完全一致。静态区放前面 → 前缀不变 → 缓存命中率最高。缓存命中时只付 10% 成本 → 914 行 × 每次调用 ≈ 5000 tokens → 节省巨大。

</details>

#### Q13.2 ⭐ 设计一个 Agent 的系统提示词架构，要求包含：身份定义、行为约束、工具使用指导、输出格式约束、平台适配。

<details>
<summary>查看答案</summary>

推荐的系统提示词结构（综合 Claude Code + Hermes）：

1. **身份定义**（2-3 句）— 简洁，不要长篇大论
2. **安全指令**（不可覆盖）— 放在最前面，参考 Claude Code 的 cyberRiskInstruction
3. **行为约束** — 具体、可执行的规则（"Don't add features beyond what was asked"）
4. **工具使用指导** — 参考 Hermes 的 TOOL_USE_ENFORCEMENT_GUIDANCE，防止模型"说了不做"
5. **输出格式约束** — 控制模型的输出长度，减少 token 浪费
6. **平台适配**（动态注入）— CLI/Telegram/API 不同的渲染提示

--- 静态/动态分界线 ---

7. **记忆注入**（动态）— CLAUDE.md / AGENTS.md / Auto Memory 内容
8. **环境信息**（动态）— OS、shell、工作目录、git 状态
9. **MCP 指令**（动态）— 外部工具的使用说明

</details>

#### Q13.3 🔥 Claude Code 的恢复消息注入："Resume directly — no apology, no recap. Break remaining work into smaller pieces." 为什么每个词都很重要？如果去掉 "no apology" 会怎样？

<details>
<summary>查看答案</summary>

逐词分析：

- **"Resume directly"** — 直接继续，不要从头开始。没有这个 → 模型可能重新开始整个任务
- **"no apology"** — 不要道歉。没有这个 → 模型会说 "I apologize for the interruption..." → 浪费 50-100 tokens
- **"no recap"** — 不要重复之前做了什么。没有这个 → 模型会说 "Previously, I was working on..." → 浪费 200-500 tokens → 在上下文已经很满的情况下可能触发下一次截断
- **"Break remaining work into smaller pieces"** — 把剩余工作拆小。没有这个 → 模型可能再次尝试一次性输出大量内容 → 再次被截断 → 无限循环

这条消息是 Claude Code 团队经过大量实验优化出来的。每个词都在防止一种具体的 token 浪费模式。

</details>

#### Q13.4 🔥 Hermes Agent 对不同模型注入不同的执行指导。为什么不同模型需要不同的提示词？

<details>
<summary>查看答案</summary>

- **GPT/Gemini/Grok** → TOOL_USE_ENFORCEMENT_GUIDANCE：这些模型倾向于"描述计划"而不是"执行计划" → 需要显式强制它们调用工具
- **OpenAI GPT-5/Codex** → OPENAI_MODEL_EXECUTION_GUIDANCE：GPT 模型倾向于"过早完成"和"跳过前置步骤" → 需要显式要求持续执行和验证
- **Gemini/Gemma** → GOOGLE_MODEL_OPERATIONAL_GUIDANCE：Gemini 模型有特定的失败模式（相对路径、交互式命令挂起） → 需要针对性的操作指导
- **Claude** → 不需要额外指导：Claude 模型原生支持 tool calling

</details>

#### Q13.5 💡 Claude Code 的内部版本有 "≤25 words between tool calls" 的限制。为什么要限制模型在工具调用之间的输出长度？

<details>
<summary>查看答案</summary>

1. **速度感知**：25 词的简短说明 + 立即执行工具 = 感觉很快；200 词的详细解释 + 然后执行工具 = 感觉很慢
2. **Token 节省**：50 轮循环 × 200 词/轮 = 13,000 tokens vs 50 轮循环 × 25 词/轮 = 1,600 tokens → 节省 11,400 tokens
3. **缓存效率**：更短的输出 = 更少的 cache miss

对用户体验的影响：正面是 Agent 感觉更"高效"，负面是用户可能不理解 Agent 在做什么。这就是为什么外部版本没有这个限制。

</details>

---

## 十四、安全与权限深度题（★★★★）

#### Q14.1 ⭐ 设计一个 prompt injection 防御系统。当 Agent 读取用户的代码仓库时，代码中可能包含恶意指令。怎么防御？

<details>
<summary>查看答案</summary>

综合 Hermes 的 `_scan_context_content()` 和 Claude Code 的 trust verification，四层防御：

- **Layer 1: 静态模式匹配** — 正则检测 "ignore previous instructions" 等模式。快速、零成本、但容易被绕过
- **Layer 2: 不可见字符检测** — 检测零宽字符、方向控制字符，这些字符可以隐藏恶意指令
- **Layer 3: 信任边界** — 首次打开仓库时要求用户确认信任，新的 MCP 服务器需要用户批准
- **Layer 4: 记忆围栏** — 召回的记忆用 `<memory-context>` 标签包裹，附带系统注释防止模型将记忆内容当作新指令执行

</details>

#### Q14.2 ⭐ Codex 的 Guardian 模式：在用户审批前，先让独立的 LLM 评估操作安全性。设计一个类似的系统。

<details>
<summary>查看答案</summary>

- **Guardian 模型选择**：用便宜的模型（如 GPT-4o-mini），需要快速响应，每次审查 ~100 tokens
- **判断标准**：操作是否超出任务范围？是否针对敏感路径？是否是破坏性操作？是否有数据泄露风险？
- **False Positive 处理**：通知用户，提供手动批准选项，记录到日志用于改进
- **False Negative 处理**：沙箱是最后一道防线（即使 Guardian 放行，沙箱仍然限制），这就是为什么需要纵深防御

</details>

#### Q14.3 🔥 Claude Code 进入 auto 模式时会主动丢弃宽泛的 allow 规则（如 `Bash(*)`）。为什么？

<details>
<summary>查看答案</summary>

用户之前在 default 模式下设置了 `Bash(*)` 是因为每次都要手动确认太烦了。但在 auto 模式下没有人工确认环节。如果保留 `Bash(*)`，分类器的审查就是唯一的防线，而分类器可能被 prompt injection 绕过。

`Bash(*)` + auto 模式 + prompt injection = 灾难。

丢弃宽泛规则后：分类器审查 + 窄规则 = 双重防线。即使分类器被绕过，窄规则仍然限制了可执行的命令范围。

</details>

#### Q14.4 🔥 设计一个权限升级机制（参考 Codex 的渐进式权限升级）。

<details>
<summary>查看答案</summary>

流程：
1. 命令被策略阻止：`git push origin main`
2. 分析阻止原因：策略中没有 `allow("git", "push", ...)`
3. 推导最小化规则：`allow("git", "push", "origin", "*")` — 不是 `allow("git", "*")`（太宽泛）
4. 安全检查：`prefix_rule_would_approve_all_commands()` — 如果推导出的规则会允许所有命令 → 拒绝
5. 展示给用户：选项 [本次允许] [始终允许] [拒绝]

关键安全检查：推导的规则不能包含通配符在命令名位置，不能覆盖已有的 deny 规则，必须比当前被阻止的命令更具体或等价。

</details>

#### Q14.5 💡 对比三种权限模型的表达能力：Claude Code 的 allow/deny/ask、Codex 的 Starlark、Hermes 的基础审批。哪种最适合企业级部署？

<details>
<summary>查看答案</summary>

| 维度 | Claude Code (allow/deny) | Codex (Starlark) | Hermes (基础审批) |
|------|------------------------|------------------|-----------------|
| 条件逻辑 | 不支持 | if/else/for | 不支持 |
| 正则匹配 | 通配符(*) | 完整正则 | 不支持 |
| 动态规则 | 运行时修改 settings | 运行时追加 amendment | 不支持 |
| 企业部署 | Managed Settings（组织级） | 配置层叠（系统→用户→项目） | 无 |

最适合企业级部署：**Codex 的 Starlark**（可编程 → 能表达复杂审批逻辑，命令规范化 → 防止绕过，配置层叠 → 组织级策略覆盖个人设置）。但 Claude Code 的 Managed Settings 也很重要（allowManagedHooksOnly、allowManagedMcpServersOnly）。

</details>


---

## 十五、可观测性与调试（★★★）

#### Q15.1 ⭐ 你的 Agent 在生产环境中运行了 6 小时后突然停止响应。你有哪些手段来诊断问题？

<details>
<summary>查看答案</summary>

诊断清单（按优先级）：

1. **检查 Token Budget** — maxBudgetUsd 是否耗尽？上下文窗口是否满了？
2. **检查断路器状态** — Auto-Compact 断路器是否触发？如果断路器打开 + 上下文满 → Agent 无法继续
3. **检查工具执行** — 是否有工具卡住？（超时未返回）
4. **检查 API 状态** — 模型 API 是否返回 500/503？是否触发了 rate limit？
5. **检查循环终止条件** — maxTurns/IterationBudget 是否耗尽？stopCondition 是否意外触发？
6. **检查中断状态** — 用户是否意外中断？AbortController 是否被触发？

诊断工具：Claude Code 的 queryCheckpoint()、Vercel AI SDK 的 OpenTelemetry spans、Hermes 的 logging + _last_activity_ts。

</details>

#### Q15.2 设计一个 Agent 的可观测性系统，要求追踪：每轮循环的耗时/token/工具调用、压缩事件、错误恢复、用户中断。

<details>
<summary>查看答案</summary>

```typescript
interface AgentTelemetry {
  onTurnStart(turn: number): void;
  onTurnEnd(turn: number, metrics: TurnMetrics): void;
  onToolStart(toolName: string, args: unknown): void;
  onToolEnd(toolName: string, result: string, durationMs: number): void;
  onToolError(toolName: string, error: Error): void;
  onCompressStart(level: number, usage: number): void;
  onCompressEnd(level: number, tokensSaved: number): void;
  onCircuitBreakerTriggered(level: number): void;
  onPTLRecovery(attempt: number, strategy: string): void;
  onModelFallback(from: string, to: string): void;
  onUserInterrupt(phase: string): void;
}

interface TurnMetrics {
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  toolCalls: number;
  compressionsTriggered: number;
  costUsd: number;
}
```

</details>

#### Q15.3 💡 Vercel AI SDK 的 TelemetryIntegration 接口设计：全局注册 + 调用级别注册，用 Promise.allSettled 并行执行。为什么用 allSettled 而不是 all？为什么需要两级注册？

<details>
<summary>查看答案</summary>

**为什么用 Promise.allSettled？** 一个遥测集成失败不应该影响其他集成，更不应该影响 Agent 的正常执行。

**为什么需要两级注册？**
- 全局注册（registerTelemetryIntegration）：应用启动时注册一次，用于基础设施级别的遥测（日志、监控、告警），所有调用都会触发
- 调用级别注册（experimental_telemetry.integrations）：每次调用时指定，用于业务特定的遥测（A/B 测试、用户行为追踪），只影响当前调用

两者合并执行，互不影响。

</details>

---

## 十六、性能优化（★★★）

#### Q16.1 ⭐ Claude Code 的 StreamingToolExecutor 在模型还在输出时就开始执行工具。设计这个机制的完整流程。

<details>
<summary>查看答案</summary>

```
时序图：
模型开始流式输出
  ├── text block 1 → yield 给前端
  ├── tool_use block A 完成 → StreamingToolExecutor.addTool(A)
  │                            → 立即开始执行 A（不等模型输出完）
  ├── tool_use block B 完成 → StreamingToolExecutor.addTool(B)
  │                            → 立即开始执行 B（与 A 并行）
  ├── tool A 执行完成 → 结果暂存
  模型输出完毕
  ├── 收集 A 的结果 → yield 给前端
  ├── 等待 B 完成 → yield 给前端
  继续下一轮循环
```

如果模型输出被中断（fallback）：discard() 丢弃所有待处理结果，创建新的 StreamingToolExecutor，用 fallback 模型重试。

并行策略：只读工具并行执行，写入工具串行执行，判断依据是工具的 isConcurrencySafe 和 isReadOnly 元数据。

</details>

#### Q16.2 🔥 Anthropic 的 prompt caching 可以节省 90% 的重复 token 费用。设计一个最大化缓存命中率的消息管理策略。

<details>
<summary>查看答案</summary>

三个关键策略：

1. **消息历史只追加不修改** — 前缀不变 → 缓存命中。修改中间的消息 → 前缀变了 → 缓存失效
2. **三分区管理（Claude Code）** — fresh（新结果，可修改）、frozen（已被缓存，不动即使浪费空间）、must-reapply（缓存过期，可趁机清理）。frozen 不动是因为修改 → 缓存失效 → 全价发送，保留 → 缓存命中 → 只付 10%
3. **system_and_3 策略（Hermes Agent）** — 4 个 cache_control 断点：system prompt（最稳定）+ 最后 3 条非 system 消息（滚动窗口）

</details>

#### Q16.3 💡 Hermes Agent 的两层技能缓存：进程内 LRU + 磁盘快照。为什么需要两层？什么时候磁盘快照会失效？

<details>
<summary>查看答案</summary>

- **进程内 LRU 缓存**：OrderedDict，最多 8 个条目，热路径 ~0ms。用于同一进程内的重复调用（每轮 API 调用前都要构建技能索引）
- **磁盘快照**（.skills_prompt_snapshot.json）：包含 version、manifest（mtime/size）、skills 元数据。用于进程重启后的冷启动（避免扫描 50+ 技能目录）

磁盘快照失效条件：任何 SKILL.md 或 DESCRIPTION.md 文件的 mtime 或 size 变化、新增或删除技能文件、手动删除快照文件。

</details>

---

## 十七、智能模型路由与多 Provider（★★★）

#### Q17.1 ⭐ 设计一个智能模型路由系统：简单消息用便宜模型，复杂任务用强模型。

<details>
<summary>查看答案</summary>

判断复杂度的启发式规则（参考 Hermes 的 `choose_cheap_model_route()`）：

简单消息（用便宜模型）：长度 ≤ 160 字符 AND ≤ 28 词，不包含换行、代码标记、URL、复杂关键词。

复杂消息（用主模型）：以上任何条件不满足。

为什么保守策略？路由错误的代价不对称：简单→贵模型只是多花钱但结果正确；复杂→便宜模型省钱但结果可能错误 → 用户不满 → 需要重做 → 总成本更高。所以有任何复杂信号就用主模型。

</details>

#### Q17.2 🔥 设计一个 Credential Pool（API key 轮转）系统。

<details>
<summary>查看答案</summary>

```python
class CredentialPool:
    def __init__(self, keys: List[str]):
        self._keys = keys
        self._index = 0
        self._rate_limited: Dict[str, float] = {}  # key → 解除时间
    
    def get_key(self) -> str:
        """轮转获取下一个可用的 key"""
        now = time.time()
        for _ in range(len(self._keys)):
            key = self._keys[self._index]
            self._index = (self._index + 1) % len(self._keys)
            if key in self._rate_limited:
                if now < self._rate_limited[key]:
                    continue
                else:
                    del self._rate_limited[key]
            return key
        # 所有 key 都被限流 → 等待最早解除的
        earliest = min(self._rate_limited.values())
        time.sleep(earliest - now)
        return self.get_key()
    
    def mark_rate_limited(self, key: str, retry_after: float):
        self._rate_limited[key] = time.time() + retry_after
```

</details>

#### Q17.3 💡 Vercel AI SDK 的 Provider Registry 用 `"openai:gpt-4o"` 字符串语法查找模型。这种设计的优缺点是什么？

<details>
<summary>查看答案</summary>

**优点**：配置友好（可以放在环境变量、配置文件中）、类型安全（泛型推导确保只能使用已注册的 provider）、统一入口。

**缺点**：字符串解析依赖 ":" 分隔符、运行时错误（拼写错误只在运行时发现）、不支持动态 Provider。

Hermes 的 `runtime_provider.py` 对比：更灵活（支持 provider 名称 → base_url + api_key 的动态解析）、支持 credential pool、支持 smart routing，但没有类型安全。

</details>


---

## 十八、RL 训练集成（★★）

#### Q18.1 设计一个 Agent 轨迹保存系统，用于后续的强化学习训练：保存什么数据？用什么格式？怎么处理敏感信息？

<details>
<summary>查看答案</summary>

保存的数据（ShareGPT 格式）：

```json
{
  "conversations": [
    {"from": "system", "value": "..."},
    {"from": "human", "value": "..."},
    {"from": "gpt", "value": "...", "reasoning_content": "..."},
    {"from": "tool", "value": "..."}
  ],
  "timestamp": "2026-04-14T...",
  "model": "claude-opus-4-20250514",
  "completed": true
}
```

格式选择 ShareGPT：广泛支持（Axolotl、LLaMA-Factory、TRL），简单（role + content），可以包含 reasoning_content。

敏感信息处理：API key 不保存（在 system prompt 中不包含），用户数据可选 redact 模式，文件路径和工具结果保留（训练需要）。

</details>

#### Q18.2 💡 Hermes Agent 的 TrajectoryCompressor 将轨迹压缩到目标 token 预算。压缩策略是什么？为什么要压缩训练数据？

<details>
<summary>查看答案</summary>

保护区域：首条 system/human/gpt/tool 消息 + 最后 4 条消息。压缩区域：中间的工具调用和结果。

策略：计算需要节省的 token 数 → 从可压缩区域的开头开始累积 → 累积到足够后用 LLM 生成摘要替换 → 保留剩余的中间轮次。

为什么要压缩？长轨迹（50K+ tokens）超出训练模型的上下文窗口，中间的工具调用/结果大多是重复模式，压缩后保留关键决策点和最终结果，训练效率更高。

</details>

---

## 十九、配置与技能生态（★★）

#### Q19.1 设计一个配置层叠系统（参考 Codex 的 系统→用户→项目→环境变量→CLI）。

<details>
<summary>查看答案</summary>

层叠顺序（后者覆盖前者）：
1. 内置默认值（代码中硬编码）
2. 系统级配置（/etc/agent/config.toml）
3. 用户级配置（~/.agent/config.toml）
4. 项目级配置（.agent/config.toml）— 可以 git 管理
5. 环境变量覆盖（AGENT_*）
6. 命令行参数覆盖（--model, --sandbox, ...）

冲突处理：简单值后者覆盖前者，数组值合并（项目级追加到用户级），deny 规则任何层级都生效（不可被覆盖）。

团队共享：项目级配置提交到 git，包含模型选择、工具集、编码规范，不包含 API key 和个人偏好。

</details>

#### Q19.2 💡 设计一个技能/插件生态系统（参考 Hermes 的 SKILL.md + 条件激活）。

<details>
<summary>查看答案</summary>

技能定义格式（SKILL.md）：

```yaml
---
name: "Git Workflow"
description: "Standard git commit, push, PR workflow"
platforms: [cli, telegram]
requires_tools: [terminal]
fallback_for_toolsets: []
---
```

条件激活：`requires_tools: [terminal]` → 如果 terminal 工具不可用 → 技能不出现。`fallback_for_toolsets: [browser]` → 如果 browser 可用 → 技能不出现（有更好的方案）。

防止冲突：同名技能本地优先于外部目录，同类技能通过 fallback_for 机制自动选择，platforms 字段限制技能在哪些平台可用。

</details>

---

## 二十、MCP 协议与工具扩展（★★★）

#### Q20.1 ⭐ 什么是 MCP（Model Context Protocol）？它解决了什么问题？Claude Code、Codex、Hermes Agent 分别怎么集成 MCP？

<details>
<summary>查看答案</summary>

MCP 是 Anthropic 提出的开放标准，让 AI 应用通过统一协议连接外部工具、数据源和服务。解决的问题：之前每个 Agent 自己实现工具（重复开发、不可复用），之后工具作为 MCP 服务器发布，任何 Agent 都能连接使用。

各项目集成方式：
- **Claude Code**：延迟加载（只加载工具名，按需加载完整 schema），新 MCP 服务器需要用户信任确认，MCP 工具和内置工具走同一套 Hook
- **Codex**：MCP 工具也走 exec policy 审批，也在沙箱中执行（比 Claude Code 更严格）
- **Hermes Agent**：`discover_mcp_tools()` 从配置文件发现 MCP 服务器，MCP 工具注册到 ToolRegistry 和内置工具统一管理

</details>

#### Q20.2 🔥 设计一个 MCP 工具的安全审批机制。MCP 服务器是外部的、不受信任的。

<details>
<summary>查看答案</summary>

1. **服务器级信任（Claude Code）** — 首次连接弹出信任确认，Managed Settings 可以限制只允许组织批准的 MCP 服务器
2. **工具级审批（Codex）** — MCP 工具和内置工具走同一套 exec policy，可以为特定 MCP 工具设置 allow/deny 规则
3. **沙箱隔离（Codex 独有）** — MCP 工具的执行也在 OS 级沙箱中，即使 MCP 服务器返回恶意命令，沙箱限制其影响范围
4. **上下文隔离（Claude Code）** — WebFetch 工具在独立的上下文窗口中处理，防止外部内容中的 prompt injection

</details>

#### Q20.3 💡 MCP 工具的 schema 可能很多，全部加载到上下文会消耗大量 token。Claude Code 怎么解决这个问题？

<details>
<summary>查看答案</summary>

问题：10 个 MCP 服务器 × 10 个工具 × 300 tokens = 30,000 tokens，占用上下文窗口的 15%，但大部分工具不会被使用。

Claude Code 的解决方案：
1. 初始加载：只加载工具名（不加载完整 schema）
2. 工具搜索：模型通过 ToolSearchTool 搜索需要的工具
3. 按需加载：找到需要的工具后，才加载完整 schema
4. 效果：上下文中只有实际使用的工具的 schema

这是一个典型的"延迟加载"模式——不预先加载所有资源，而是在需要时才加载。

</details>

---

## 二十一、多 Agent 编排（★★★）

#### Q21.1 ⭐ 设计一个多 Agent 编排系统。要求：协调者分解任务，工作者有独立上下文和工具权限，工作者之间不共享对话上下文。

<details>
<summary>查看答案</summary>

```
┌─────────────────────────────────────┐
│         协调者 Agent                 │
│  - 分解任务、分配给工作者、汇总结果    │
│  - 完整工具权限                       │
└──────────┬──────────┬───────────────┘
           │          │
  ┌────────▼──┐  ┌───▼────────┐
  │ 工作者 A   │  │ 工作者 B    │
  │ 只读工具   │  │ 编辑工具    │
  │ 独立上下文  │  │ 独立上下文   │
  └───────────┘  └────────────┘
```

关键设计：
- **上下文隔离**：工作者的详细过程不污染协调者的上下文，只有摘要结果返回
- **工具权限分级**：研究工作者只读，编辑工作者读写，验证工作者只读+测试
- **通信方式**：简单任务用工具调用返回值（Claude Code），复杂任务用邮箱系统（Codex）
- **深度限制**：工作者不能生成自己的工作者（防止递归爆炸）

</details>

#### Q21.2 🔥 Claude Code 的 Agent Teams 成本约 5 倍。为什么多 Agent 这么贵？有什么策略可以降低成本？

<details>
<summary>查看答案</summary>

为什么 5 倍成本？每个工作者 Agent 维护独立的上下文窗口：协调者 ~20K tokens + 工作者 A ~50K + 工作者 B ~50K = 120K vs 单 Agent 的 50K ≈ 2.4x，加上协调开销 ≈ 3-5x。

降低成本的策略：
1. 只在真正需要并行时才用多 Agent
2. 工作者用便宜的模型（如 Sonnet 而不是 Opus）
3. 工作者的上下文窗口更小（限制 maxTokens）
4. 共享 prompt cache 前缀
5. 工作者只返回摘要，不返回完整历史

</details>

#### Q21.3 💡 对比两种 Agent 间通信方式：Claude Code 的工具调用返回值（同步）vs Codex 的邮箱系统（异步）。

<details>
<summary>查看答案</summary>

| 维度 | 工具调用返回值（Claude Code） | 邮箱系统（Codex） |
|------|---------------------------|-----------------|
| 同步性 | 同步（等待返回） | 异步（发送后继续） |
| 耦合度 | 高 | 低 |
| 实现复杂度 | 低 | 中 |
| 适用场景 | 简单的委托任务 | 复杂的多 Agent 协作 |
| 错误处理 | 调用者直接处理 | 需要超时和重试机制 |
| 并行支持 | 有限（最多 1 个子 Agent） | 好（多个 Agent 并行） |

</details>

---

## 二十二、Checkpoint 与会话恢复（★★★）

#### Q22.1 ⭐ 设计一个 Agent 的 Checkpoint 系统，要求：每次文件编辑前创建快照、支持跨会话持久化、用户可以回滚到任意 checkpoint。

<details>
<summary>查看答案</summary>

每次文件编辑前：读取文件当前内容 → 保存到 checkpoint 存储（内存 + 磁盘）→ 记录文件路径、内容哈希、时间戳、关联的 tool_call_id。

回滚（/rewind）：用户选择回滚到哪个 checkpoint → 恢复所有文件到该 checkpoint 的状态 → 可选同时回滚对话历史。

跨会话持久化：checkpoint 数据保存到会话存储目录，恢复会话时自动加载。

Bash 命令的限制：Claude Code 明确说明 Bash 驱动的文件修改不被 checkpoint 追踪。原因是 Bash 可以执行任意命令，追踪所有可能的文件变更不现实。建议用户在执行危险 Bash 命令前手动 git commit。

</details>

#### Q22.2 🔥 Agent 崩溃后恢复会话。正在执行的工具调用怎么处理？

<details>
<summary>查看答案</summary>

场景：Agent 崩溃时，工具 A 已执行完（写了文件），工具 B 正在执行（运行测试）。

恢复策略：
1. 从 checkpoint 加载会话状态
2. 检查最后一轮的工具调用状态：工具 A 有结果 → 正常；工具 B 无结果 → 标记为 "interrupted"
3. 在恢复后的第一条消息中告诉模型："Session recovered from crash. Tool B (npm test) was interrupted — result unknown. Please re-run if needed."
4. 模型决定是否重新执行工具 B

关键原则：不自动重试中断的工具（可能有副作用），把中断信息作为上下文提供给模型，让模型决定下一步。

</details>

---

## 二十三、Agent 设计哲学总结题（面试收尾 ★★★★）

#### Q23.1 ⭐⭐ 总结你从四个 Agent Runtime 中学到的最重要的 5 个设计原则。每个原则用一句话描述，并举一个具体的源码例子。

<details>
<summary>查看答案</summary>

1. **"简单优先，复杂性只在需要时添加"** — Claude Code 的核心是一个 while loop，不是状态机。演进路径：TODO → Tasks → Agent Teams。
2. **"分层防御，便宜的先做"** — Claude Code 的 7 层上下文防御，90% 的会话只需要零成本的 L1+L2。Codex 的三层沙箱。
3. **"错误不应该导致崩溃，而应该成为模型决策的输入"** — 所有四个项目都把工具错误回填给模型，而不是抛异常。模型比硬编码的恢复逻辑更了解上下文。
4. **"缓存稳定性 > 空间效率"** — Claude Code 的 frozen 分区：已缓存的内容不修改，即使浪费空间。消息历史只追加不修改。
5. **"治理是架构，不是附加功能"** — 权限、Hooks、沙箱不是事后添加的，而是核心设计的一部分。Claude Code 的 43 个权限门控工具，Codex 的 Starlark 策略引擎。

</details>

#### Q23.2 ⭐ 如果你要向一个从未接触过 Agent 的工程师解释"Agent Harness 架构师"这个岗位在做什么，你会怎么说？用 3 分钟讲清楚。

<details>
<summary>查看答案</summary>

> "想象你在用一个 AI 编程助手——你说'帮我修复这个 bug'，它就会自动读代码、分析问题、修改文件、运行测试。这个助手背后有一个'引擎'在驱动它，这个引擎就是 Agent Harness。
>
> Agent Harness 架构师要解决的核心问题是：**让这个引擎能稳定运行 8 小时不崩溃**。
>
> 这比听起来难得多，因为：
> 1. AI 模型有上下文窗口限制——对话太长就装不下了，需要压缩
> 2. 工具可能失败——网络超时、文件不存在、命令报错，都要优雅处理
> 3. 安全——AI 可能被恶意代码欺骗，执行危险操作，需要沙箱隔离
> 4. 成本——每次调用 AI 都花钱，需要精细的预算管理
>
> 我研究了四个开源的 Agent 引擎（Claude Code、Codex、Vercel AI SDK、Hermes Agent），它们用不同的方式解决这些问题。我的工作就是取各家之长，设计一个更好的引擎。"

</details>

#### Q23.3 🔥 面试官问："你觉得当前 Agent Runtime 最大的技术债务是什么？如果给你 6 个月时间，你会优先解决什么？"

<details>
<summary>查看答案</summary>

最大的技术债务：**上下文压缩的信息损失**。压缩必然丢失细节，多次压缩后早期的关键决策可能被遗忘。

6 个月优先级：

- **Month 1-2: 压缩质量评估框架** — 建立自动化评估，压缩前后让模型回答同一组问题，对比准确率
- **Month 3-4: 混合压缩策略** — 结合 CQRS 投影（无损）和 LLM 摘要（有损），关键信息用无损方式保留
- **Month 5-6: 外部记忆集成** — 压缩时把关键信息写入外部记忆（类似 Dream Mode），需要时通过 sideQuery 检索回来

其他技术债务：多 Agent 协调的成本优化（5x → 2x）、工具执行的可靠性（沙箱的性能开销）、跨 Provider 的消息格式统一。

</details>
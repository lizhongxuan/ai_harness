# Agent Harness 架构师 — 面试题库

> 使用方法：把每道题复制给 AI 工具（Claude / ChatGPT / Kiro），让它给你讲解。
> 先自己想 2 分钟，再看 AI 的回答，最后对照学习计划中的源码分析验证。
> 标记：⭐ = 高频必考 | 🔥 = 深度追问 | 💡 = 加分项


## 相关项目文件:
- claude code源码[claude code/]
- Vercel AI SDK源码[ai/]
- Codex源码[codex/]
- hermes-agent源码[hermes-agent/]

## 规则:
- 回答对应的面试题后,更新答案到agent-harness-interview-ask.md文档上.

---

## 一、状态机 Agent Loop（权重 ★★★★★）

### 基础概念题

**Q1.1** ⭐ 请描述一个 Agent Loop 的基本执行流程。从用户输入到最终输出，中间经过哪些步骤？

**Q1.2** ⭐ Agent Loop 用 while loop 和用显式状态机有什么区别？各自的优缺点是什么？在什么场景下你会选择状态机？


**Q1.3** Vercel AI SDK 的 `generateText` 和 `streamText` 在 agent loop 实现上有什么区别？`maxSteps` 参数的作用是什么？

**Q1.4** 解释 Claude Code 核心循环（代号 nO）的工作原理。为什么选择单线程而不是多线程？

### 设计题

**Q1.5** ⭐ 设计一个多阶段 Phase 管道的 Agent Loop。要求包含以下阶段：plan → act → observe → reflect。请说明：
- 每个 Phase 的职责
- Phase 之间的状态转移条件
- 每个 Phase 的异常处理路径（超时、工具失败、模型拒绝）
- 什么条件下循环终止

**Q1.6** 🔥 你的 Agent 需要同时调用 3 个工具（读文件、搜索代码、执行命令）。请设计工具并行执行的策略：
- 哪些工具可以并行？哪些必须串行？判断依据是什么？
- 并行执行时，如果其中一个工具超时了怎么办？
- 工具结果怎么回填到消息历史中？顺序重要吗？

**Q1.7** 🔥 Claude Code 的 h2A 异步消息队列支持用户在 Agent 执行中途注入新指令。请设计一个类似的机制：
- 数据结构怎么设计？
- 如何实现暂停/恢复？
- 新指令注入后，当前正在执行的工具调用怎么处理？

**Q1.8** 设计一个子 Agent 生成和管理机制。要求：
- 子 Agent 有独立的上下文窗口
- 防止递归生成子 Agent（深度限制）
- 子 Agent 的结果如何汇总回主 Agent
- 参考 Claude Code 的设计：最多一个子 Agent 分支

### 编码题

**Q1.9** ⭐ 用 TypeScript 实现一个简化版的 Agent Loop，要求：
- 支持 tool calling
- 支持 maxSteps 限制
- 支持 finishReason 判断（stop / tool_calls / length）
- 工具执行失败时不崩溃，将错误信息回填给模型

**Q1.10** 用 TypeScript 实现一个流式 Agent Loop，要求：
- 使用 ReadableStream / TransformStream
- 支持流式输出 token
- 在流式输出过程中检测到 tool call 时，暂停流式输出，执行工具，然后继续

---

## 二、多级上下文压缩（权重 ★★★★★）

### 基础概念题

**Q2.1** ⭐ 解释岗位要求的五级压缩管道：tool-result-budget → snip → micro → collapse → auto。每一级做什么？为什么要分五级而不是直接用一个摘要器？

**Q2.2** ⭐ Claude Code 的上下文压缩有 7 层防御。请解释从 Layer 1 到 Layer 7 的触发条件和处理策略。为什么要从便宜到昂贵逐级触发？

**Q2.3** 解释 Claude Code 的三分区缓存策略：fresh / frozen / must-reapply。为什么要冻结已缓存的内容？这和 Anthropic 的 prompt caching 有什么关系？

**Q2.4** 什么是 Context Collapse 的 CQRS 模式？为什么要把对话历史分成"UI 真相"和"API 真相"两个视图？

### 设计题

**Q2.5** ⭐ 设计一个五级上下文压缩管道。对于每一级，请说明：
- 触发条件（什么时候启动这一级？）
- 压缩策略（具体怎么压缩？）
- 退出条件（压缩到什么程度算够了？）
- 与其他级别的交互（互斥？级联？）

**Q2.6** 🔥 你的 Auto-Compact（LLM 摘要）层在执行摘要时，摘要器自身也遇到了 prompt-too-long 错误。怎么处理？请设计完整的恢复链路。

**Q2.7** 🔥 设计互斥门控机制：当 Context Collapse（Layer 4）启用时，如何抑制 Auto-Compact（Layer 5）？为什么需要这个互斥？如果两个系统同时运行会发生什么？

**Q2.8** 设计断路器（Circuit Breaker）模式用于 Auto-Compact 层：
- 什么条件下触发断路器？
- 断路器触发后怎么办？
- 断路器什么时候重置？还是整个会话都不再尝试？

**Q2.9** 💡 一个工具返回了 50,000 token 的搜索结果。请设计 Tool Result Budget 的处理策略：
- 怎么决定保留多少？
- 截断后的预览怎么生成？
- 完整结果存在哪里？模型后续需要时怎么取回？

### 编码题

**Q2.10** ⭐ 用 TypeScript 实现一个 MultiLevelCompressor 类，包含五级压缩管道。要求：
- 每一级有明确的触发条件
- 支持互斥门控（Layer 4 和 Layer 5）
- 支持断路器模式
- 压缩后重新计算 token 数

---

## 三、跨会话记忆系统（权重 ★★★★）

### 基础概念题

**Q3.1** ⭐ Claude Code 的记忆系统用 Markdown 文件而不是向量数据库。为什么？这个设计决策的优缺点是什么？

**Q3.2** 解释 Claude Code 的四种记忆类型：user / feedback / project / reference。每种类型存什么？怎么用？

**Q3.3** 什么是 Dream Mode（梦境模式）？它的 4 个阶段分别做什么？为什么需要一个专门的记忆整合循环？

**Q3.4** CLAUDE.md 和 Auto Memory 有什么区别？谁写的？范围是什么？为什么需要两套系统？

### 设计题

**Q3.5** ⭐ 设计一个跨会话记忆系统，要求：
- 支持四种记忆类型
- 有索引机制（类似 ENTRYPOINT.md）
- 有定期整合机制（类似 Dream Mode）
- 索引大小有上限（如 25KB）
- 支持记忆过期和矛盾解决

**Q3.6** 🔥 设计 sideQuery 语义检索机制：
- 什么是 sideQuery？为什么不直接把记忆塞进主上下文？
- 检索用什么方式？（关键词 / 嵌入 / LLM）
- 检索结果怎么注入到当前对话中而不污染主上下文？
- 检索的 token 成本怎么控制？

**Q3.7** 你的记忆系统中，两条记忆互相矛盾（比如"用户偏好 tabs"和"用户偏好 spaces"）。怎么检测和解决矛盾？

**Q3.8** 💡 Dream Mode 的 Consolidate 阶段需要把相对日期转换为绝对日期（"昨天" → "2026-04-13"）。为什么这很重要？如果不做会怎样？

### 编码题

**Q3.9** 用 TypeScript 设计记忆系统的数据结构和核心接口：
- MemoryStore 类
- 四种记忆类型的 CRUD
- 索引管理（大小限制、过期清理）
- Dream Mode 的 4 阶段整合流程

---

## 四、多级错误恢复（权重 ★★★★）

### 基础概念题

**Q4.1** ⭐ Agent 运行时可能遇到哪些类型的错误？请分类并说明每种错误的恢复策略。

**Q4.2** 解释 prompt-too-long 错误的恢复链路：从检测到恢复的完整流程。

**Q4.3** 什么是模型 fallback？Provider 抽象层怎么实现模型热切换？切换对上层是否透明？

**Q4.4** Claude Code 在流式传输期间遇到可恢复错误时会"暂扣"错误。这是什么意思？为什么这样设计？

### 设计题

**Q4.5** ⭐ 设计一个多级错误恢复链，要求处理以下错误类型：
- prompt-too-long → 触发压缩
- max-output-tokens → 升级 token 限制
- 模型不可用（500/503）→ 模型 fallback
- 速率限制（429）→ 指数退避重试
- 工具执行超时 → 超时处理
- 未知错误 → 不重试，上报

**Q4.6** 🔥 你的 Agent 在执行第 47 步时遇到 prompt-too-long。此时：
- 上下文中有 200 条消息
- 其中 50 条是工具结果
- 有 3 个正在进行的任务
- 用户 10 分钟前给了一个重要指令
请设计恢复策略，确保恢复后不丢失关键信息。

**Q4.7** 设计 Provider 抽象层，支持：
- 多个模型提供商（OpenAI、Anthropic、Google）
- 统一的请求/响应接口
- 模型 fallback 链
- 每个模型的 token 限制和定价信息
- 切换模型时的上下文适配（不同模型的消息格式可能不同）

**Q4.8** 💡 Agent 在流式输出过程中，模型突然返回了一个格式错误的 tool call JSON。怎么处理？
- 已经输出的部分怎么办？
- 要不要重试？
- 重试时消息历史怎么处理？

### 编码题

**Q4.9** ⭐ 用 TypeScript 实现 `executeWithRecovery` 函数，包含完整的错误分类和恢复策略链。

**Q4.10** 实现一个 Provider 抽象层，支持模型注册、fallback 链、和统一的 chat 接口。

---

## 五、Token Budget 管理（权重 ★★★）

### 基础概念题

**Q5.1** ⭐ 什么是"跨压缩边界的预算追踪"？为什么压缩后需要重新计算 token 数？

**Q5.2** Token 预算需要在哪些部分之间分配？（system prompt / 历史消息 / 工具结果 / 输出预留）各部分的优先级是什么？

**Q5.3** Anthropic 的 prompt caching 怎么影响 token 预算管理？缓存命中时只付 10% 成本，这对预算追踪有什么影响？

### 设计题

**Q5.4** ⭐ 设计一个 Token Budget Manager，要求：
- 追踪总预算和各部分的使用量
- 每次压缩后重新计算
- 支持动态调整各部分的预算分配
- 当接近预算上限时触发警告
- 支持 maxBudgetUsd 成本硬停止

**Q5.5** 🔥 你的 Agent 运行了 3 小时，已经消耗了 80% 的 token 预算。但当前任务还需要大约 2 小时才能完成。怎么办？
- 怎么估算剩余任务的 token 需求？
- 有哪些策略可以减少后续的 token 消耗？
- 什么时候应该停止并通知用户？

**Q5.6** 压缩操作本身也消耗 token（比如 Auto-Compact 需要调用 LLM 做摘要）。怎么把压缩成本纳入预算管理？

### 编码题

**Q5.7** 用 TypeScript 实现 TokenBudgetManager 类：
- 追踪 input/output token 使用量
- 支持按美元计算成本（不同模型不同价格）
- 压缩后重新计算
- 预算告警和硬停止

---

## 六、推测执行（权重 ★★★）

### 基础概念题

**Q6.1** ⭐ 什么是推测执行（Speculative Execution）在 Agent 上下文中的含义？和 CPU 的推测执行有什么类比？

**Q6.2** Overlay 预执行是什么？为什么不直接执行然后回滚？

**Q6.3** Codex CLI 的沙箱执行模型和推测执行有什么关系？

### 设计题

**Q6.4** ⭐ 设计一个 Overlay 推测执行系统，要求：
- Agent 预测下一步操作，先在 overlay 层执行
- 用户可以预览变更（diff）
- 用户确认后提交到真实文件系统
- 用户拒绝时完整回滚
- 支持多步推测（连续预测 2-3 步）

**Q6.5** 🔥 推测执行中，Agent 预测要修改文件 A，但在 overlay 层执行时发现文件 A 已经被另一个进程修改了（并发冲突）。怎么处理？

**Q6.6** 推测执行的置信度怎么评估？什么情况下应该跳过推测直接执行？什么情况下应该强制推测？

**Q6.7** 💡 设计推测执行的快照机制：
- 快照包含哪些内容？（文件内容、git 状态、环境变量？）
- 快照存在哪里？（内存 / 磁盘 / git stash？）
- 多步推测时，快照怎么管理？（链式快照？增量快照？）

### 编码题

**Q6.8** 用 TypeScript 实现 SpeculativeExecutor 类，支持：
- 快照创建和恢复
- Overlay 层的文件操作（读/写/删除）
- Diff 生成
- 提交和回滚

---

## 七、系统设计综合题（面试高频）

**Q7.1** ⭐⭐ 请从零设计一个 Agent Harness 架构，要求能在生产环境中稳定运行 8 小时。请涵盖：
- 核心 Agent Loop 设计
- 上下文管理策略
- 记忆系统
- 错误恢复
- Token 预算管理
- 安全和权限

**Q7.2** ⭐ Agent 运行 4 小时后，上下文窗口使用率达到 95%。请描述完整的恢复流程。

**Q7.3** ⭐ 你的 Agent 需要同时处理 5 个用户的请求。请设计多租户架构：
- 上下文隔离
- 资源分配
- 错误隔离（一个用户的错误不影响其他用户）

**Q7.4** 🔥 面试官说："Claude Code 的核心就是一个 while loop，为什么你要用状态机？说服我。"

**Q7.5** 🔥 面试官说："你的五级压缩管道太复杂了，三级就够了。你怎么反驳？"

**Q7.6** 🔥 面试官说："Markdown 记忆太原始了，为什么不用向量数据库？"

**Q7.7** 💡 对比 Vercel AI SDK、Claude Code、Codex CLI 三个 Runtime 的 Agent Loop 设计。各自的优缺点是什么？如果让你设计第四个，你会怎么做？

---

## 八、TypeScript / Bun / 流式处理（技术栈深度题）

### TypeScript

**Q8.1** ⭐ 用 TypeScript 的泛型和条件类型，设计一个类型安全的工具注册系统：
- 工具有 name、parameters（Zod schema）、execute 函数
- 注册后，调用工具时参数类型自动推导
- 工具结果类型也自动推导

**Q8.2** `Promise.all` 和 `Promise.allSettled` 在并行工具执行中分别适用什么场景？为什么 Agent 的工具并行执行更适合用 `Promise.allSettled`？

**Q8.3** 解释 TypeScript 中 `ReadableStream`、`TransformStream`、`WritableStream` 的关系。在流式 Agent Loop 中，它们分别用在哪里？

### Bun

**Q8.4** Bun 和 Node.js 的主要差异是什么？为什么 Claude Code 选择 Bun？

**Q8.5** 💡 Bun 的 `feature()` 宏是什么？Claude Code 怎么用它做内部/外部版本区分？这种编译时特性开关和运行时 if/else 有什么区别？

### 流式处理

**Q8.6** ⭐ 什么是背压（backpressure）？在流式 Agent 输出中，如果消费者（前端 UI）处理速度跟不上生产者（模型输出），会发生什么？怎么处理？

**Q8.7** 设计一个流式输出系统，支持：
- SSE（Server-Sent Events）传输
- 流式输出过程中检测 tool call
- 流式输出的取消和中断（用户按 Ctrl+C）
- 错误在流中的传播

**Q8.8** 🔥 流式输出过程中，模型输出了一半的 JSON tool call（比如 `{"name": "read_file", "arg`），然后连接断了。怎么处理？

---

## 九、分布式系统模式（架构深度题）

**Q9.1** ⭐ 解释 CQRS（命令查询职责分离）模式。Claude Code 的 Context Collapse 怎么应用了这个模式？

**Q9.2** ⭐ 解释断路器（Circuit Breaker）模式。在 Agent Runtime 中，哪些地方需要断路器？

**Q9.3** 什么是事件溯源（Event Sourcing）？Agent 的消息历史可以看作事件日志吗？这对压缩和恢复有什么影响？

**Q9.4** 🔥 设计一个 Agent 会话的持久化和恢复机制：
- 会话状态包含哪些内容？
- 怎么序列化和反序列化？
- 崩溃后怎么恢复到最近的一致状态？
- 恢复后，正在执行的工具调用怎么处理？

**Q9.5** 💡 如果要把 Agent Runtime 从单机扩展到分布式集群，最大的挑战是什么？你会怎么设计？

---

## 十、行为面试题 / 开放讨论题

**Q10.1** 你研究过哪些 Agent Runtime？它们的设计哲学有什么不同？你最欣赏哪个设计决策？

**Q10.2** 如果让你从零开始设计一个 Agent Runtime，你会做的第一个设计决策是什么？为什么？

**Q10.3** "简单优先"和"为未来扩展预留"之间怎么平衡？举一个你在实际项目中做过这种权衡的例子。

**Q10.4** Agent 系统的安全性和易用性之间怎么平衡？太多确认对话框会导致"确认疲劳"，太少又不安全。你怎么设计？

**Q10.5** 你认为 AI Agent Runtime 在未来 2-3 年会怎么演进？哪些是当前的技术瓶颈？

---

## 使用建议

### 学习顺序

```
第 1 周：先做 一、二 的基础概念题（配合 Vercel AI SDK 源码）
第 2 周：做 一、二、三 的设计题（配合 Claude Code 分析）
第 3 周：做编码题 + 四、五、六（配合动手实现）
第 4 周：做 七、八、九、十 的综合题（模拟面试）
```

### 用 AI 工具学习的方法

1. 先自己想 2 分钟，写下关键点
2. 把题目复制给 AI，让它给出详细回答
3. 对比你的想法和 AI 的回答，找差距
4. 追问 AI："你说的 xxx 在 Vercel AI SDK 源码里对应哪个文件？"
5. 去源码里验证 AI 说的对不对
6. 用自己的话重新组织答案，确保面试时能流畅表达

### 模拟面试

找一个朋友或用 AI 模拟面试官，从每个模块随机抽一道设计题 + 一道追问题，限时 45 分钟回答。重点练习：
- 画架构图的能力（白板 / 纸笔）
- 从高层设计到细节实现的切换能力
- 被追问时不慌，能说"这个问题很好，让我想一下"


---

## 十一、跨项目对比题（面试高频 ★★★★★）

**Q11.1** ⭐⭐ 对比 Claude Code、Codex CLI、Vercel AI SDK、Hermes Agent 四个 Agent Runtime 的 Agent Loop 设计。各自的优缺点是什么？你会怎么设计第五个？

**Q11.2** ⭐ 四个项目的工具注册模式完全不同：Claude Code 的 `buildTool()`、Codex 的 Starlark exec policy、Vercel AI SDK 的 Zod `tool()`、Hermes 的自注册 `registry.register()`。对比它们的设计哲学和适用场景。

**Q11.3** ⭐ 对比四个项目的上下文压缩策略。Claude Code 有 7 层防御（92% 阈值），Hermes Agent 有结构化摘要（50% 阈值），Codex 只有基础截断，Vercel AI SDK 不提供。为什么会有这么大的差异？

**Q11.4** 🔥 对比四个项目的安全/权限模型。Claude Code 的 Actions With Care + Hooks、Codex 的 Starlark + Seatbelt/Landlock、Hermes 的基础审批、Vercel AI SDK 的 tool approval。哪个最适合生产环境？

**Q11.5** 🔥 对比四个项目的记忆系统。Claude Code 的 CLAUDE.md + Auto Memory + Dream Mode、Codex 的 AGENTS.md、Hermes 的 MemoryManager + 插件 Provider、Vercel AI SDK 无内置。设计一个综合最佳实践的记忆系统。

**Q11.6** 💡 四个项目用了四种不同的语言/运行时：Claude Code (TypeScript/Bun)、Codex (Rust/tokio)、Vercel AI SDK (TypeScript/Node)、Hermes (Python/asyncio)。语言选择如何影响了架构设计？

---

## 十二、工具注册与发现（缺失模块 ★★★★）

**Q12.1** ⭐ 设计一个工具注册系统，要求：
- 新工具只需要在自己的文件中声明，不需要修改中心化的注册文件
- 支持工具的动态启用/禁用（基于环境变量、API key 是否配置等）
- 支持工具分组（toolset），toolset 之间可以组合
- 参考 Hermes Agent 的自注册模式和 Vercel AI SDK 的 Zod tool()

**Q12.2** 🔥 Hermes Agent 的 `coerce_tool_args()` 会自动将 LLM 返回的字符串参数强转为 JSON Schema 声明的类型（如 `"42"` → `42`）。这个设计的利弊是什么？Vercel AI SDK 用 Zod parse 做参数校验，两种方式的权衡是什么？

**Q12.3** 设计一个工具可用性检查系统（类似 Hermes 的 `check_fn`）：
- 工具注册时声明自己的前置条件（如需要 API key、需要特定命令可用）
- 运行时动态检查，不满足条件的工具不出现在模型的工具列表中
- 避免模型调用不可用的工具（减少幻觉）

---

## 十三、Prompt Engineering 在 Agent 中的应用（缺失模块 ★★★★）

**Q13.1** ⭐ Claude Code 的系统提示词有 914 行，分为静态区和动态区。为什么要这样分？这和 Anthropic 的 prompt caching 有什么关系？

**Q13.2** ⭐ 设计一个 Agent 的系统提示词架构，要求：
- 身份定义（谁是这个 Agent）
- 行为约束（什么该做、什么不该做）
- 工具使用指导（什么时候用什么工具）
- 输出格式约束（简洁 vs 详细）
- 平台适配（CLI vs 聊天 vs API）
- 参考 Claude Code 的 prompts.ts 和 Hermes 的 prompt_builder.py

**Q13.3** 🔥 Claude Code 的恢复消息注入："Resume directly — no apology, no recap. Break remaining work into smaller pieces." 为什么每个词都很重要？如果去掉 "no apology" 会怎样？

**Q13.4** 🔥 Hermes Agent 对不同模型注入不同的执行指导（TOOL_USE_ENFORCEMENT_GUIDANCE 给 GPT/Gemini，OPENAI_MODEL_EXECUTION_GUIDANCE 给 OpenAI）。为什么不同模型需要不同的提示词？

**Q13.5** 💡 Claude Code 的内部版本有 "≤25 words between tool calls" 的限制。为什么要限制模型在工具调用之间的输出长度？这对用户体验有什么影响？

---

## 十四、安全与权限深度题（补充 ★★★★）

**Q14.1** ⭐ 设计一个 prompt injection 防御系统。当 Agent 读取用户的代码仓库时，代码中可能包含恶意指令（如 "ignore previous instructions"）。怎么防御？
- 参考 Hermes Agent 的 `_scan_context_content()` 和 Claude Code 的 trust verification

**Q14.2** ⭐ Codex 的 Guardian 模式：在用户审批前，先让独立的 LLM 评估操作安全性。设计一个类似的系统：
- Guardian 用什么模型？（便宜的还是贵的？）
- Guardian 的判断标准是什么？
- Guardian 误判（false positive/negative）怎么处理？

**Q14.3** 🔥 Claude Code 进入 auto 模式时会主动丢弃宽泛的 allow 规则（如 `Bash(*)`）。为什么？如果不丢弃会有什么风险？

**Q14.4** 🔥 设计一个权限升级机制（参考 Codex 的渐进式权限升级）：
- 命令被阻止 → 分析原因 → 推导最小化的放宽规则
- 怎么确保推导出的规则不会过于宽泛？
- 参考 Codex 的 `prefix_rule_would_approve_all_commands()` 安全检查

**Q14.5** 💡 对比三种权限模型的表达能力：
- Claude Code: `allow/deny/ask` 声明式规则
- Codex: Starlark 可编程策略
- Hermes: 基础审批 + skills_guard
- 哪种最适合企业级部署？为什么？

---

## 十五、可观测性与调试（缺失模块 ★★★）

**Q15.1** ⭐ 你的 Agent 在生产环境中运行了 6 小时后突然停止响应。你有哪些手段来诊断问题？
- 参考 Claude Code 的 queryCheckpoint、Vercel AI SDK 的 OpenTelemetry

**Q15.2** 设计一个 Agent 的可观测性系统，要求：
- 每轮循环的耗时、token 消耗、工具调用记录
- 压缩事件的追踪（什么时候触发了哪一层压缩）
- 错误恢复的追踪（PTL 恢复了几次、fallback 到了哪个模型）
- 用户中断的追踪

**Q15.3** 💡 Vercel AI SDK 的 TelemetryIntegration 接口设计：全局注册 + 调用级别注册，用 Promise.allSettled 并行执行。为什么用 allSettled 而不是 all？为什么需要两级注册？

---

## 十六、性能优化（补充 ★★★）

**Q16.1** ⭐ Claude Code 的 StreamingToolExecutor 在模型还在输出时就开始执行工具。设计这个机制的完整流程：
- 什么时候开始执行？（tool_use block 完成时 vs 模型输出完毕时）
- 如果模型输出被中断（fallback），已经开始执行的工具怎么处理？
- 多个工具的执行顺序和并行策略

**Q16.2** 🔥 Anthropic 的 prompt caching 可以节省 90% 的重复 token 费用。设计一个最大化缓存命中率的消息管理策略：
- 为什么消息历史只追加不修改？
- Claude Code 的三分区（fresh/frozen/must-reapply）怎么工作？
- Hermes Agent 的 `apply_anthropic_cache_control()` 的 system_and_3 策略是什么？

**Q16.3** 💡 Hermes Agent 的两层技能缓存：进程内 LRU + 磁盘快照（mtime/size manifest 验证）。为什么需要两层？什么时候磁盘快照会失效？

---

## 十七、智能模型路由与多 Provider（补充 ★★★）

**Q17.1** ⭐ 设计一个智能模型路由系统：简单消息用便宜模型，复杂任务用强模型。
- 怎么判断消息的复杂度？（参考 Hermes 的关键词启发式）
- 路由错误（简单消息被路由到贵模型、复杂任务被路由到便宜模型）的代价分别是什么？
- 为什么 Hermes 选择保守策略（有任何复杂信号就用主模型）？

**Q17.2** 🔥 设计一个 Credential Pool（API key 轮转）系统：
- 多个 API key 之间怎么轮转？
- 单个 key 被 rate limit 时怎么自动切换？
- 怎么追踪每个 key 的使用量和剩余配额？

**Q17.3** 💡 Vercel AI SDK 的 Provider Registry 用 `"openai:gpt-4o"` 字符串语法查找模型。这种设计的优缺点是什么？和 Hermes 的 `runtime_provider.py` 相比呢？

---

## 十八、RL 训练集成（缺失模块 ★★）

**Q18.1** 设计一个 Agent 轨迹保存系统，用于后续的强化学习训练：
- 保存什么数据？（消息历史、工具调用、reasoning、错误）
- 用什么格式？（ShareGPT、OpenAI、自定义）
- 怎么处理敏感信息？（API key、用户数据）

**Q18.2** 💡 Hermes Agent 的 TrajectoryCompressor 将轨迹压缩到目标 token 预算（如 15K tokens）。压缩策略是什么？保护哪些轮次？为什么要压缩训练数据？

---

## 十九、配置与技能生态（补充 ★★）

**Q19.1** 设计一个配置层叠系统（参考 Codex 的 系统→用户→项目→环境变量→CLI）：
- 各层的优先级是什么？
- 怎么处理冲突？
- 怎么让团队共享项目级配置？

**Q19.2** 💡 设计一个技能/插件生态系统（参考 Hermes 的 SKILL.md + 条件激活）：
- 技能的定义格式是什么？
- 怎么实现条件激活（requires_tools、fallback_for_toolsets）？
- 怎么防止技能之间的冲突？


---

## 二十、MCP 协议与工具扩展（缺失模块 ★★★）

**Q20.1** ⭐ 什么是 MCP（Model Context Protocol）？它解决了什么问题？Claude Code、Codex、Hermes Agent 分别怎么集成 MCP？

**Q20.2** 🔥 设计一个 MCP 工具的安全审批机制。MCP 服务器是外部的、不受信任的。怎么确保 MCP 工具不会执行危险操作？
- 参考 Claude Code 的 MCP server approval + Codex 的 MCP 工具也走 exec policy

**Q20.3** 💡 MCP 工具的 schema 可能很多（几十个工具），全部加载到上下文会消耗大量 token。Claude Code 怎么解决这个问题？（延迟加载 + 按需发现）

---

## 二十一、多 Agent 编排（缺失模块 ★★★）

**Q21.1** ⭐ 设计一个多 Agent 编排系统。要求：
- 协调者 Agent 分解任务，分配给工作者 Agent
- 工作者 Agent 有独立的上下文窗口和工具权限
- 工作者之间不共享对话上下文
- 参考 Claude Code 的 coordinator mode 和 Codex 的 Agent 注册表 + 邮箱

**Q21.2** 🔥 Claude Code 的 Agent Teams（实验性功能）成本约 5 倍。为什么多 Agent 这么贵？有什么策略可以降低成本？

**Q21.3** 💡 对比两种 Agent 间通信方式：
- Claude Code：工具调用返回值（同步，简单）
- Codex：邮箱系统（异步，解耦）
- 各自的适用场景是什么？

---

## 二十二、Checkpoint 与会话恢复（补充 ★★★）

**Q22.1** ⭐ 设计一个 Agent 的 Checkpoint 系统，要求：
- 每次文件编辑前创建快照
- 支持跨会话持久化
- 用户可以回滚到任意 checkpoint
- Bash 命令的文件修改怎么处理？（Claude Code 的限制：Bash 修改不被追踪）

**Q22.2** 🔥 Agent 崩溃后恢复会话。正在执行的工具调用怎么处理？
- 工具已经执行了一半（比如写了文件但还没运行测试）
- 工具结果丢失了
- 怎么让模型知道"上次崩溃了，这些工具的结果未知"？

---

## 二十三、Agent 设计哲学总结题（面试收尾 ★★★★）

**Q23.1** ⭐⭐ 总结你从四个 Agent Runtime 中学到的最重要的 5 个设计原则。每个原则用一句话描述，并举一个具体的源码例子。

**Q23.2** ⭐ 如果你要向一个从未接触过 Agent 的工程师解释"Agent Harness 架构师"这个岗位在做什么，你会怎么说？用 3 分钟讲清楚。

**Q23.3** 🔥 面试官问："你觉得当前 Agent Runtime 最大的技术债务是什么？如果给你 6 个月时间，你会优先解决什么？"
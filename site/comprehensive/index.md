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

**为什么需要这 6 个子系统？— 从问题出发理解设计**

要理解这个架构，关键是理解它要解决的问题。一个 Agent 要稳定运行 8 小时，会遇到什么？

| 运行时长 | 会遇到的问题 | 需要哪个子系统 |
|---------|------------|-------------|
| 第 1 分钟 | 模型需要调用工具完成任务 | **Agent Loop** — 驱动"思考→执行→观察"的循环 |
| 第 30 分钟 | 对话历史越来越长，快撑爆上下文窗口 | **上下文管理** — 压缩旧内容，腾出空间 |
| 第 1 小时 | 用户说"记住我喜欢用 TypeScript"，下次还要记得 | **记忆系统** — 跨会话持久化知识 |
| 第 2 小时 | API 突然返回 500，工具执行超时 | **错误恢复** — 自动重试、切换模型、压缩后重试 |
| 第 4 小时 | 已经花了 $5，老板说预算只有 $10 | **Token Budget** — 追踪消耗，到预算就停 |
| 第 6 小时 | 模型要执行 `rm -rf /`，必须拦住 | **权限/安全** — 沙箱隔离 + 权限审批 |

没有任何一个子系统是"锦上添花"——每一个都是在解决 8 小时运行中必然会遇到的真实问题。它们之间的关系是：

```
Agent Loop 是发动机 — 驱动整个系统运转
上下文管理 是油箱管理 — 防止燃料（上下文）耗尽
记忆系统 是导航仪 — 记住去过哪里、学到什么
错误恢复 是安全气囊 — 出事了不崩溃，自动恢复
Token Budget 是仪表盘 — 监控消耗，到预算就停
权限/安全 是刹车系统 — 危险操作必须能拦住
```

**6 个子系统的设计要点**

1. **Agent Loop**: Phase 管道（plan→act→observe→reflect），外层 while loop + 内层状态机。每个 Phase 有独立的工具权限、超时、token 预算。

2. **上下文管理**: 五级压缩管道（tool-budget→snip→micro→collapse→auto），从便宜到昂贵逐级触发。互斥门控（L4 和 L5），断路器（L5）。

3. **记忆系统**: Markdown 文件 + 索引（< 25KB），四种类型（user/feedback/project/reference），Dream Mode 定期整合，sideQuery 语义检索。

4. **错误恢复**: 分类（PTL/max-tokens/model-unavailable/rate-limit/tool-timeout），恢复链（compress→upgrade→fallback→retry），Provider 抽象层支持模型热切换。

5. **Token Budget**: 跨压缩边界追踪，按角色分配预算（system/memory/history/tools/output），maxBudgetUsd 硬停止，缓存感知的成本计算。

6. **推测执行**: OverlayFS 虚拟层，快照+回滚，diff 预览，用户确认后原子提交。

---

**📖 新手导读：上面 6 个子系统的大白话解释**

**① Agent Loop — "外层 while loop + 内层状态机"是什么意思？**

想象两层嵌套。外层就是 Claude Code 那种 `while(true)` 循环——不断重复直到任务完成。内层是在每一轮循环里，把"模型思考 + 执行工具 + 看结果"拆成 4 个明确的阶段：

```
外层: while (任务未完成) {
    内层: plan（只读，分析任务）→ act（执行操作）→ observe（检查结果）→ reflect（决定下一步）
}
```

为什么要拆？因为每个阶段可以有不同的约束——plan 阶段只给只读工具（不让模型还没想清楚就动手改文件），act 阶段才给完整权限。注意：这是一种理想化的设计方案，四大开源项目都没有用显式的 Phase 管道，Claude Code 用的是不分阶段的 while loop。详见 [Q1.5 的深入分析](/modules/agent-loop)。

**② 上下文管理 — "五级压缩管道"是什么意思？**

LLM 有上下文窗口限制（比如 200K tokens）。聊了 4 小时，对话历史快撑爆了，需要"压缩"。Claude Code 不是一上来就做最重的压缩，而是像水位线一样逐级升级：

| 级别 | 名字 | 做什么 | 成本 | 触发时机 |
|------|------|--------|------|---------|
| L1 | tool-budget | 工具返回结果太大？截断它，只保留预览 | 零 | 每轮都检查 |
| L2 | snip | 删掉最旧的几轮对话 | 零 | ~70% |
| L3 | micro | 利用 prompt cache 过期窗口清理旧内容 | 零 | ~85% |
| L4 | collapse | 保留完整历史，但给 API 看一个"压缩视图" | 低 | ~90% |
| L5 | auto | 调用 LLM 生成摘要，替换大段旧对话 | 高（花钱） | ~92% |

"互斥门控"：L4 和 L5 不能同时工作。如果 L4 已经把上下文压到阈值以下，L5 就不触发，防止两个机制打架。

"断路器"：L5 要调用 LLM 做摘要，如果连续失败 3 次，就像家里电闸跳闸一样——直接放弃 L5，不再尝试，防止无限重试。

**④ 错误恢复 — "分类 + 恢复链"是什么意思？**

Agent 运行中会遇到各种错误，不同错误需要不同的处理方式：

| 错误类型 | 什么意思 | 恢复策略 |
|---------|---------|---------|
| PTL (prompt-too-long) | 发给 API 的内容太长了 | → **compress**：触发压缩管道，把上下文压小，重试 |
| max-tokens | 模型输出被截断（写了一半代码就断了） | → **upgrade**：把输出上限从 8K 升到 64K，重试 |
| model-unavailable | 模型 API 挂了（500 错误） | → **fallback**：自动切换到备用模型继续工作 |
| rate-limit | 调用太频繁被限流（429） | → **retry**：等一会儿（指数退避），重试 |
| tool-timeout | 工具执行超时 | → 取消该工具，把超时信息告诉模型，让模型决定下一步 |

"Provider 抽象层支持模型热切换"：Provider 就是模型提供商（Anthropic、OpenAI 等）。抽象层让上层代码不关心底层用哪个模型——统一接口，换模型只改一个参数。"热切换"就是运行中途换模型不需要重启，这是 fallback 策略能实现的基础。

---

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

**回答思路：先认同面试官的观点（while loop 确实好用），再解释你加入状态机的具体理由，最后强调这是增量改进而不是推翻。**

---

**一、先理解面试官在考什么**

这道题的陷阱在于：面试官不是真的反对状态机，而是在测试你能不能**在压力下有理有据地为自己的设计决策辩护**，同时展示你对 Claude Code 源码的理解。

如果你直接说"while loop 不好，状态机更好"——你输了，因为 Claude Code 用 while loop 在生产环境稳定运行，你否定了一个被验证过的方案。

正确的姿态是：**认同 while loop 的价值，然后解释在特定场景下为什么需要更多结构**。

---

**二、完整回答（建议 2-3 分钟）**

> "你说得对，Claude Code 的核心确实是一个 while loop，而且它在生产环境中运行得很好。我不是要替代 while loop——Phase 管道的外层仍然是 while loop，我只是在内部加入了阶段结构。原因有三个：

**理由一：资源隔离**

> "8 小时的长运行任务中，如果 plan 阶段的一次超时吃掉了 act 阶段的时间预算，整个任务就会失控。"

用具体场景说明：

```
没有 Phase 管道（while loop）:
  第 1 轮: 模型花了 3 分钟"思考"（其实在生成冗长的分析）
  第 2 轮: 模型花了 2 分钟执行工具
  第 3 轮: 模型又花了 4 分钟"思考"
  → 9 分钟过去了，实际只执行了 1 次工具操作
  → 没有机制能限制"思考"阶段的时间

有 Phase 管道:
  Plan 阶段: 超时 30 秒，超了就用简化 prompt 重试
  Act 阶段: 超时 5 分钟，每个工具有独立超时
  → 思考和执行的资源互不侵占
```

**理由二：可审计性**

> "生产环境中，当 Agent 出问题时，我需要知道它在哪个阶段花了多少时间。"

```
while loop 的日志:
  [14:00:01] 循环第 1 轮开始
  [14:03:22] 循环第 1 轮结束
  → 3 分 21 秒花在哪了？不知道

Phase 管道的日志:
  [14:00:01] PLAN 开始
  [14:00:15] PLAN 完成 (14s, 1200 tokens)
  [14:00:15] ACT 开始 — 执行 3 个工具
  [14:02:45] ACT 完成 (2m30s, 工具: read_file ✅, edit_file ✅, bash(npm test) ✅)
  [14:02:45] OBSERVE 开始
  [14:03:10] OBSERVE 完成 (25s, 测试全部通过)
  [14:03:10] REFLECT 完成 (12s, decision=continue)
  → 每个阶段的耗时、token、结果一目了然
```

**理由三：工具权限分级**

> "plan 阶段只需要只读工具，act 阶段需要写入权限。Phase 管道让我可以按阶段收窄工具权限，减少攻击面。"

```
while loop: 模型在任何时候都能调用任何工具
  → 模型可能在"思考"阶段就开始改文件（还没想清楚就动手）
  → 如果遇到 prompt injection，攻击者可以在任何时候触发危险操作

Phase 管道:
  PLAN 阶段: 只给 Read, Grep, Glob（只读）
  ACT 阶段: 给 Read, Write, Edit, Bash（完整权限）
  OBSERVE 阶段: 只给 Read, Bash(只读命令)（验证用）
  REFLECT 阶段: 不给任何工具（纯推理）
  → 攻击面按阶段收窄
```

> "但我完全同意 Claude Code 的设计哲学：简单优先。如果场景不需要这些，while loop 就够了。Phase 管道是在 while loop 基础上的增量复杂性，不是替代。"

---

**三、重要澄清：Claude Code 真的完全没有这些能力吗？**

不是。Claude Code 通过不同的机制实现了类似效果（详见 [Q1.5 的深入分析](/modules/agent-loop)）：

| 能力 | Phase 管道的做法 | Claude Code 的做法 |
|------|---------------|------------------|
| 资源隔离 | 每个 Phase 独立预算和超时 | 全局 maxTurns + maxBudgetUsd + 工具级 AbortSignal |
| 可审计性 | 阶段级日志 | `State.transition.reason` 记录每次 continue 的原因 |
| 权限分级 | 按阶段分配工具集 | 43 个工具各自有 allow/deny 规则，不按阶段区分 |

区别是**隐式 vs 显式**：Claude Code 用局部机制分散实现，Phase 管道用结构化方式集中实现。两种都能工作，Phase 管道更容易理解和维护，while loop 更简单灵活。

---

**四、面试官可能的追问**

| 追问 | 回答方向 |
|------|---------|
| "Phase 管道的额外复杂度值得吗？" | 取决于场景。编码 Agent 可能不需要（Claude Code 证明了），但运维 Agent、金融 Agent 等高风险场景需要显式阶段控制 |
| "Claude Code 后来也加了 Tasks 和 Agent Teams，这算不算在加结构？" | 正是如此。Claude Code 的演进路径（while loop → Tasks → Agent Teams → transition reason）本质上就是在逐步增加结构，和 Phase 管道的方向一致 |
| "如果 Phase 之间的转移条件判断错了怎么办？" | 兜底策略：REFLECT 超时默认 decision='continue'，连续 3 次异常触发断路器。最坏情况退化为普通 while loop |

</details>

#### Q7.5 🔥 面试官说："你的五级压缩管道太复杂了，三级就够了。你怎么反驳？"

<details>
<summary>查看答案</summary>

**回答思路：不要硬怼面试官。先认同"三级够用"的合理性，再用数据和成本分析说明五级的价值，最后给出"如果真的只要三级"的方案，展示你的灵活性。**

---

**一、先看五级各自做了什么、花了多少钱**

这五级压缩管道来自 Claude Code 的实际实现（参考 `claude_code_docs/context/five-layers.md`），每一级的触发时机、做法和成本完全不同：

| 级别 | 名称 | 做什么 | 成本 | 触发阈值 | 实现复杂度 |
|------|------|--------|------|---------|-----------|
| L1 | Tool Result Budget | 工具返回结果太大时截断，只保留前 N 行预览 | 零（纯字符串截断） | 每轮都检查 | 极低（~20 行代码） |
| L2 | Snip | 删掉最旧的几轮对话（整轮删除） | 零（删除操作） | ~70% 使用率 | 低（~50 行代码） |
| L3 | Micro | 利用 Anthropic prompt cache 的 TTL 过期窗口，趁缓存过期时清理旧内容 | 零（搭便车） | ~85% 使用率 | 中（需要理解缓存三分区） |
| L4 | Collapse | 保留完整历史，但给 API 看一个 CQRS "压缩投影视图" | 低（无 LLM 调用） | ~90% 使用率 | 中（需要维护两个视图） |
| L5 | Auto-Compact | 调用 LLM 生成结构化摘要，替换大段旧对话 | 高（花钱调 LLM） | ~92% 使用率 | 高（LLM 调用 + 断路器） |

关键观察：**L1-L4 的成本都是零或接近零**，只有 L5 需要花钱调用 LLM。

---

**二、实际数据：90% / 8% / 2% 分布**

根据 Claude Code 的使用模式，会话长度呈长尾分布：

| 会话类型 | 占比 | 触发到哪一级 | 压缩成本 |
|---------|------|------------|---------|
| 短会话（< 30 分钟） | ~90% | L1 + L2 就够了 | **零** |
| 中等会话（30 分钟 - 2 小时） | ~8% | 需要 L3 或 L4 | **零**（L3 搭便车）或 **极低**（L4 无 LLM 调用） |
| 长会话（> 2 小时） | ~2% | 需要 L5 | **高**（LLM 摘要调用） |

五级的价值：**98% 的会话不需要昂贵的 LLM 摘要调用**。如果只有三级（L1 + L2 + L5），那 8% 的中等会话也要触发 L5 → 成本增加 4 倍。

---

**三、如果真的只要三级，保留哪三个？**

如果面试官坚持要三级，这是最优的选择：

| 保留 | 级别 | 理由 |
|------|------|------|
| ✅ | L1 Tool Result Budget | 必须有。工具返回 10MB 的文件内容不截断，一次就撑爆上下文。零成本，零复杂度 |
| ✅ | L2 Snip | 必须有。最简单有效的压缩——删旧对话。零成本，覆盖 90% 场景 |
| ✅ | L5 Auto-Compact | 必须有。最后手段，当 L1+L2 不够时用 LLM 摘要兜底 |
| ❌ | L3 Micro | 可以砍。它的价值是"搭便车"清理，没有它只是 L5 触发得更早一点 |
| ❌ | L4 Collapse | 可以砍。它的价值是用 CQRS 避免 LLM 调用，没有它直接跳到 L5 |

砍掉 L3+L4 的代价：

```
三级方案：90% 零成本 + 10% 触发 L5（花钱）
五级方案：90% 零成本 + 8% 零成本（L3/L4）+ 2% 触发 L5（花钱）

差异：8% 的会话从"免费"变成"花钱"
如果每天 1000 个会话，L5 每次 ~$0.02：
  三级：100 × $0.02 = $2/天
  五级：20 × $0.02 = $0.4/天
  年化差异：~$584
```

对于个人开发者，$584/年 可能不值得多维护两级代码。对于企业级部署（每天 10 万会话），差异是 $58,400/年——绝对值得。

---

**四、推荐回答（2 分钟版）**

> "你说得对，三级确实能覆盖大部分场景。如果要精简，我会保留 L1（工具截断）、L2（删旧对话）、L5（LLM 摘要）。
>
> 但五级的价值在于中间层。L3 利用缓存 TTL 窗口做机会性清理，成本几乎为零；L4 用 CQRS 投影避免 LLM 调用。这两级让 8% 的中等会话也不需要触发昂贵的 L5。
>
> 实际数据：90% 的会话只需要 L1+L2，8% 被 L3+L4 拦住，只有 2% 触发 L5。五级的复杂度换来的是 98% 的会话零 LLM 摘要成本。
>
> 如果你的场景中会话都很短，三级确实够了。但如果是企业级部署，中间层的成本节省是显著的。"

---

**五、面试官可能的追问**

| 追问 | 回答方向 |
|------|---------|
| "L3 的缓存 TTL 搭便车具体怎么实现？" | Anthropic prompt cache 有 5 分钟 TTL。L3 维护三分区（fresh/frozen/must-reapply），当 frozen 区的缓存过期变成 must-reapply 时，趁机清理不需要的内容，而不是重新缓存它们 |
| "L4 的 CQRS 投影和 L5 的 LLM 摘要有什么本质区别？" | L4 是无损的——完整历史保留，只是 API 看到压缩视图（两个视图可以独立演化）。L5 是有损的——用 LLM 摘要替换原始内容，信息不可逆地丢失 |
| "五级之间会不会互相冲突？" | Claude Code 用互斥门控解决：L4 和 L5 不能同时工作。如果 L4 已经把使用率压到阈值以下，L5 就不触发。另外 L5 有断路器——连续失败 3 次就停止尝试 |

</details>

#### Q7.6 🔥 面试官说："Markdown 记忆太原始了，为什么不用向量数据库？"

<details>
<summary>查看答案</summary>

**回答思路：面试官在测试你是否盲目追新技术。先承认向量数据库的优势，再解释 Claude Code 选择 Markdown 的深层原因——瓶颈不是"怎么找"而是"怎么维护"，最后给出什么时候该用向量数据库的判断标准。**

---

**一、Markdown vs 向量数据库：全维度对比**

| 维度 | Markdown 文件 | 向量数据库（如 Pinecone/Chroma） |
|------|-------------|-------------------------------|
| **存储** | 纯文本文件，< 25KB | 向量 + 元数据，需要独立服务 |
| **检索** | 关键词搜索 / sideQuery 语义检索 | 语义相似度搜索（embedding） |
| **维护** | LLM 直接读写、合并、删除 | 需要额外的 CRUD API + embedding 更新 |
| **人类可读** | ✅ 直接打开就能看 | ❌ 向量不可读，需要工具查看 |
| **LLM 兼容** | ✅ LLM 天生擅长读写 Markdown | ⚠️ 需要序列化/反序列化 |
| **版本控制** | ✅ git diff / git blame | ❌ 需要额外的版本管理 |
| **依赖** | 零（文件系统） | 需要向量数据库服务 + embedding 模型 |
| **冷启动** | 即时（读文件） | 需要加载索引 |
| **成本** | 零 | embedding 调用 + 存储费用 |

---

**二、关键洞察：瓶颈是维护，不是存储**

Claude Code 选择 Markdown 的核心原因不是"简单"，而是一个深刻的洞察：

> **Agent 记忆的真正难题不是"怎么找到记忆"，而是"怎么维护记忆"。**

记忆维护包括：
- **过期清理**：用户 3 个月前说"用 React 16"，现在项目升级到 React 19 了，旧记忆要删
- **矛盾解决**：记忆 A 说"用 tabs 缩进"，记忆 B 说"用 spaces 缩进"，要合并
- **碎片整合**：10 条零散的记忆可以合并成 1 条结构化的总结
- **优先级排序**：哪些记忆重要、哪些可以丢弃

**Dream Mode 就是解决维护问题的关键机制**：

```
Dream Mode 流程（Claude Code 空闲时自动触发）：
  Orient  → 扫描当前记忆，识别过期/矛盾/碎片
  Gather  → 收集相关上下文（最近的对话、项目状态）
  Consolidate → LLM 合并、去重、更新记忆
  Prune   → 删除过期和低优先级的记忆
```

Markdown 让 Dream Mode 的实现极其自然——LLM 直接读写文本文件，不需要任何中间层。如果用向量数据库，Dream Mode 需要：读取向量 → 反序列化 → LLM 处理 → 重新 embedding → 写回向量数据库。每一步都增加复杂度和失败点。

---

**三、什么时候该用向量数据库？**

Markdown 不是万能的。当以下条件满足时，应该引入向量数据库：

| 条件 | 阈值 | 原因 |
|------|------|------|
| 记忆条数 | > 1000 条 | 关键词搜索的召回率下降，需要语义检索 |
| 记忆总大小 | > 100KB | 全量加载到上下文太贵，需要索引 |
| 跨用户检索 | 需要 | 个人记忆用 Markdown，共享知识库用向量数据库 |
| 多模态记忆 | 需要 | 图片、音频等非文本记忆需要 embedding |

**推荐的混合架构**：

```
个人记忆层（Markdown）
  ├── user_memory.md     — 用户偏好（"喜欢 TypeScript"）
  ├── project_memory.md  — 项目知识（"用 Bun 构建"）
  └── feedback_memory.md — 反馈学习（"上次 npm test 超时了"）
  → Dream Mode 维护
  → sideQuery 语义检索（不污染主上下文）

共享知识层（向量数据库）
  ├── 团队编码规范
  ├── API 文档索引
  └── 历史问题解决方案
  → embedding + 相似度检索
  → 结果注入为 Markdown 片段
```

两者不矛盾：**向量数据库做索引，Markdown 做存储**。检索用向量数据库的语义能力，但最终呈现给 LLM 的仍然是 Markdown 文本。

---

**四、面试官可能的追问**

| 追问 | 回答方向 |
|------|---------|
| "sideQuery 的语义检索和向量数据库有什么区别？" | sideQuery 是 Claude Code 的独立检索机制——在独立的上下文窗口中用 LLM 做语义匹配，不污染主对话。它不需要 embedding，但每次检索要调用 LLM，成本比向量数据库高。适合小规模（< 1000 条），大规模时应该换向量数据库 |
| "Dream Mode 的整合会不会丢失信息？" | 会。这就是为什么 Dream Mode 有 Prune 阶段的保护——只删除明确过期的记忆（如已完成的任务），不确定的保留。另外记忆文件可以 git 管理，误删可以回滚 |
| "如果用户有 10 个项目，每个项目都有记忆文件，怎么管理？" | Claude Code 的做法是按工作树隔离——每个项目目录有自己的 `.claude/` 记忆文件，互不干扰。全局偏好放在 `~/.claude/CLAUDE.md`，沿目录树向上查找并合并 |

</details>

#### Q7.7 💡 对比 Vercel AI SDK、Claude Code、Codex CLI 三个 Runtime 的 Agent Loop 设计。各自的优缺点是什么？如果让你设计第四个，你会怎么做？

<details>
<summary>查看答案</summary>

**回答思路：先用表格对比三个项目的 Agent Loop 核心差异，再说明"第四个"不是简单拼凑，而是有明确的设计目标和取舍逻辑。**

---

**一、三个 Runtime 的 Agent Loop 对比**

| 维度 | Claude Code | Vercel AI SDK | Codex CLI |
|------|------------|---------------|-----------|
| **语言/运行时** | TypeScript / Bun | TypeScript / Node | Rust / tokio |
| **循环类型** | `while(true)` + State 对象 | `for` loop + `maxSteps` | 事件驱动 `match` |
| **决策者** | 模型全权决定下一步 | 模型 + `stopCondition` | 事件匹配 |
| **工具并行** | 只读并行，写入串行 | `Promise.all` 全部并行 | 串行（审批驱动） |
| **流式工具执行** | ✅ StreamingToolExecutor | ❌ | ❌ |
| **上下文管理** | 7 层压缩管道 | 无内置 | 基础截断 |
| **记忆系统** | Markdown + Dream Mode | 无内置 | AGENTS.md（只读） |
| **错误恢复** | 分类 + 恢复链 + 断路器 | 基础重试 | 事件循环自然终止 |
| **安全模型** | Actions With Care + Hooks | tool approval | Starlark + OS 沙箱 |

**各自的优缺点：**

| 项目 | 优点 | 缺点 |
|------|------|------|
| Claude Code | 生产级完整度最高（压缩、记忆、恢复、安全全有）；StreamingToolExecutor 边收边执行，速度快 | 复杂度高（7 层压缩、43 个工具）；和 Anthropic API 耦合较深 |
| Vercel AI SDK | API 设计优雅（`streamText` / `generateText`）；Provider 抽象层支持任意模型；类型安全（Zod） | 只是框架，不做产品级决策（无压缩、无记忆、无错误恢复）；使用者需要自己补全 |
| Codex CLI | 安全性最强（OS 级沙箱 + Starlark 策略）；Rust 内存安全保证 | 上下文管理最弱（基础截断）；生态较小；记忆系统只读 |

---

**二、从每个项目取什么、为什么**

| 取自 | 具体能力 | 为什么取这个 |
|------|---------|------------|
| Claude Code | 单线程 `while(true)` 主循环 | 经过生产验证，简单可靠，避免过度设计 |
| Claude Code | 7 层上下文防御 | 分层防御是核心竞争力，90% 会话零成本压缩 |
| Claude Code | Markdown 记忆 + Dream Mode | 维护比存储更重要，LLM 天生擅长读写文本 |
| Claude Code | 权限系统 + Hooks | 治理即架构，不是事后添加 |
| Vercel AI SDK | Provider 抽象层（LanguageModelV4） | 模型 fallback 的基础，不绑定单一 Provider |
| Vercel AI SDK | 流式输出 API + Zod tool() | DX 友好 + 类型安全，降低使用者的心智负担 |
| Codex CLI | OS 级沙箱执行模型 | 推测执行的基础——先在沙箱里跑，确认安全再提交 |

---

**三、自己加的新设计（不是拼凑）**

| 新设计 | 解决什么问题 | 为什么现有项目没有 |
|--------|------------|------------------|
| Phase 管道（plan→act→observe→reflect） | 资源隔离 + 可审计——plan 阶段只给只读工具，act 阶段才给写入权限 | Claude Code 用 while loop 足够简单，但缺少阶段级的资源隔离和审计 |
| 跨压缩边界的 Token Budget 追踪 | 压缩后 token 计数不丢失——知道"压缩前花了多少、压缩后省了多少" | Claude Code 的 budget 追踪在压缩时会重置，无法回溯历史消耗 |
| 结构化错误恢复链 | 错误分类 → 匹配恢复策略 → 执行 → 失败则升级到下一策略 | 现有项目的错误恢复是 ad-hoc 的 try-catch，没有统一的恢复链 |

---

**四、第四个 Runtime 的架构概览**

```
┌─────────────────────────────────────────────────┐
│                   入口层                         │
│  Provider 抽象 (Vercel) + Zod tool() 类型安全     │
└──────────────────┬──────────────────────────────┘
                   ▼
┌─────────────────────────────────────────────────┐
│              while(true) 主循环 (Claude Code)     │
│  ┌─────────────────────────────────────────┐    │
│  │  Phase 管道 (新设计)                      │    │
│  │  PLAN(只读) → ACT(读写) → OBSERVE → REFLECT │  │
│  └─────────────────────────────────────────┘    │
│                                                 │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │ 7层压缩   │ │ 记忆系统  │ │ 错误恢复链    │    │
│  │(Claude)  │ │(Claude)  │ │(新设计)      │    │
│  └──────────┘ └──────────┘ └──────────────┘    │
│                                                 │
│  ┌──────────┐ ┌──────────────────────────┐     │
│  │Token预算  │ │ 权限: Hooks + OS沙箱      │     │
│  │(跨压缩)  │ │ (Claude + Codex)         │     │
│  └──────────┘ └──────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

**什么是真正新的（vs 简单拼凑）**：Phase 管道在 while loop 内部加入阶段结构，这不是任何现有项目有的；跨压缩边界的 budget 追踪解决了压缩后成本不可追溯的问题；结构化错误恢复链把分散的 try-catch 统一为可配置的恢复策略。这三个新设计是围绕"8 小时稳定运行"这个目标的增量改进，不是为了不同而不同。

---

**五、面试官可能的追问**

| 追问 | 回答方向 |
|------|---------|
| "你的第四个 Runtime 和 Claude Code 的核心区别是什么？" | 三个增量改进：Phase 管道（阶段级资源隔离）、跨压缩 budget（成本可追溯）、结构化恢复链（错误处理可配置）。核心仍然是 while loop，不是推翻 |
| "Phase 管道会不会让系统变慢？" | 会增加每轮 ~10ms 的状态转换开销，但换来的是阶段级超时控制——防止模型在 plan 阶段花 5 分钟"思考"而不执行。净效果是更快，不是更慢 |
| "为什么不直接用 Claude Code？" | 如果场景匹配（编码 Agent + Anthropic 模型），直接用 Claude Code 是最优选择。第四个 Runtime 的价值在于：Provider 无关（不绑定 Anthropic）+ 阶段级控制（高风险场景需要） |

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

**回答思路：先展示问题场景（让面试官看到你理解问题的具体性），再解释为什么不修复部分 JSON（语义不确定性），然后展示恢复流程，最后对比不同项目的处理方式。**

---

**一、问题场景：断裂的 JSON 长什么样？**

```
模型流式输出过程中：

已收到的 token 流：
  {"name": "read_file", "arg    ← 连接在这里断了

可能的完整意图（我们不知道是哪个）：
  A: {"name": "read_file", "arguments": {"path": "src/index.ts"}}
  B: {"name": "read_file", "arguments": {"path": "src/index.tsx"}}
  C: {"name": "read_file", "arguments": {"path": "package.json"}}
  D: {"name": "read_file", "arguments": {"pattern": "*.ts", "recursive": true}}
                                  ↑ 甚至参数名都可能不同！
```

---

**二、为什么不尝试修复部分 JSON？**

这是面试的关键考点。很多候选人会说"用 JSON 修复库补全"，但这是错误的：

| 修复策略 | 问题 |
|---------|------|
| 补全右括号 `}]}` | 参数值不完整——`"path": "src/ind"` 补全成什么？`src/index.ts`？`src/index.tsx`？`src/india/`？ |
| 用正则提取已有字段 | 参数名可能不完整——`"arg` 是 `arguments` 还是 `args`？ |
| 用 LLM 猜测补全 | 额外的 LLM 调用成本 + 猜错的风险 → 执行错误的工具调用比不执行更危险 |

**核心原则：部分 JSON 的语义是不确定的，修复可能导致错误的工具调用。错误的工具调用（比如读错文件、写错路径）比不调用更危险。**

---

**三、正确的恢复流程**

```
连接断开
  │
  ▼
Step 1: 保留已输出的部分作为 assistant 消息
  {
    role: "assistant",
    content: [
      { type: "text", text: "Let me read the file..." },  // 文本部分保留
      { type: "tool_use", id: "tc_001",
        name: "read_file",
        input: {},           // 参数不完整 → 留空
        _incomplete: true }  // 标记为不完整
    ],
    stop_reason: "interrupted"  // 标记中断原因
  }

  │
  ▼
Step 2: 构造 tool_result 占位
  {
    role: "tool",
    tool_use_id: "tc_001",
    content: "[Tool call interrupted — connection lost before arguments were complete]",
    is_error: true
  }

  │
  ▼
Step 3: 重试时注入恢复提示
  {
    role: "user",
    content: "Connection was lost. Your previous tool call was incomplete. 
              Please re-issue the complete tool call."
  }

  │
  ▼
Step 4: 模型看到之前的不完整输出 + 错误信息
  → 重新生成完整的 tool call
  → 这次连接正常 → 正常执行
```

---

**四、各项目的处理方式对比**

| 项目 | 处理方式 | 特点 |
|------|---------|------|
| **Claude Code** | 保留不完整输出在消息历史中，标记 `stop_reason`，下一轮模型自动重试。如果是 `max_tokens` 截断，会自动升级 `maxOutputTokens`（从 8K → 16K → 64K）再重试 | 最完善——区分截断原因，针对性恢复 |
| **Vercel AI SDK** | `streamText` 的 `onError` 回调 + `AbortSignal`。不完整的 tool call 不会被执行。`toolCallRepair` 函数可以尝试修复（但默认不启用） | 提供修复钩子但不强制——把决策权留给开发者 |
| **Codex CLI** | Rust 的 `serde_json` 解析失败 → 事件循环收到错误事件 → 重试整个 API 调用 | 最简单——解析失败就重试，不尝试修复 |
| **Hermes Agent** | `_safe_json_parse()` 尝试解析，失败则记录错误，模型在下一轮看到错误信息后重试 | 和 Claude Code 类似，但没有 `maxOutputTokens` 升级机制 |

---

**五、面试官可能的追问**

| 追问 | 回答方向 |
|------|---------|
| "如果连接反复断开怎么办？" | 断路器模式——连续 3 次断开后停止重试，通知用户检查网络。同时考虑切换到非流式模式（`generateText` 而不是 `streamText`），牺牲实时性换稳定性 |
| "Vercel AI SDK 的 `toolCallRepair` 什么时候有用？" | 当 JSON 结构完整但内容有小错误时（比如多了一个逗号、缺少引号）。这种情况下修复是安全的，因为语义是确定的。但参数值不完整时不应该修复 |
| "`max_tokens` 截断和连接断开有什么区别？" | `max_tokens` 截断是可预测的（模型输出太长），可以通过升级 `maxOutputTokens` 解决。连接断开是不可预测的（网络问题），只能重试。Claude Code 区分这两种情况，用不同的恢复策略 |

</details>


---

## 九、分布式系统模式（架构深度题）

#### Q9.1 ⭐ 解释 CQRS（命令查询职责分离）模式。Claude Code 的 Context Collapse 怎么应用了这个模式？

<details>
<summary>查看答案</summary>

**回答思路：面试官可能不熟悉 CQRS，先用大白话解释概念，再映射到 Claude Code 的具体实现，最后说明为什么这个模式在 Agent 上下文管理中特别有价值。**

---

**一、CQRS 是什么？（大白话版）**

CQRS = Command Query Responsibility Segregation（命令查询职责分离）。

核心思想：**写入数据和读取数据用不同的模型**。

用银行账户类比：

```
传统方式（单一模型）：
  账户表：余额 = 1000
  存钱 → 更新余额 = 1500
  查余额 → 读余额 = 1500
  → 读和写操作的是同一张表

CQRS 方式（双模型）：
  写入端（命令）：只记录事件
    Event 1: 开户，初始 1000
    Event 2: 存入 500
    Event 3: 取出 200
    → 事件日志是 source of truth，只追加不修改

  读取端（查询）：从事件投影出视图
    余额视图：1300（从事件计算得出）
    月度报表视图：收入 500，支出 200
    → 不同的查询可以有不同的视图
```

---

**二、Claude Code 怎么把 CQRS 用在 Context Collapse 中？**

映射关系：

| CQRS 概念 | Claude Code 实现 |
|-----------|-----------------|
| **命令端（写入）** | 对话历史——只追加消息，不修改已有消息 |
| **事件日志** | 完整的 `messages[]` 数组（source of truth） |
| **查询端（读取）** | Collapse 投影视图——压缩后的消息序列 |
| **投影函数** | Collapse commit——记录"从哪到哪压缩成什么" |

具体流程：

```
写入端（UI 看到的）：                    读取端（API 看到的）：
┌──────────────────────┐              ┌──────────────────────┐
│ msg 1: 用户问题        │              │ msg 1: 用户问题        │
│ msg 2: 模型回答        │              │ [msg 2-8 已压缩]      │
│ msg 3: 工具调用        │              │ 摘要: "用户要求修复     │
│ msg 4: 工具结果        │   Collapse   │  login bug，已读取     │
│ msg 5: 模型分析        │ ──投影──→    │  3个文件，发现问题      │
│ msg 6: 工具调用        │              │  在 auth.ts 第42行"    │
│ msg 7: 工具结果        │              │ msg 9: 模型继续工作     │
│ msg 8: 模型修复        │              │ msg 10: 工具调用       │
│ msg 9: 模型继续工作     │              └──────────────────────┘
│ msg 10: 工具调用       │
└──────────────────────┘
  完整历史（不修改）                      压缩视图（发给 API）
```

---

**三、为什么这个模式在 Agent 上下文管理中特别有价值？**

| 好处 | 解释 |
|------|------|
| **UI 保留完整历史** | 用户可以滚动查看所有对话，包括被压缩的部分。不会出现"我之前说的话去哪了？" |
| **API 看到压缩版本** | 发给模型的 token 数减少 → 成本降低 + 不超出上下文窗口 |
| **可回滚** | 完整历史是 source of truth，如果压缩出了问题（摘要丢失关键信息），可以重新投影 |
| **缓存友好** | 写入端只追加 → 前缀不变 → prompt cache 命中率最高 |
| **两个视图独立演化** | 可以对同一段历史生成不同的压缩视图（比如给不同的子 Agent 看不同的摘要） |

**和直接修改消息历史的对比：**

```
直接修改（非 CQRS）：
  压缩时直接删除 msg 2-8，插入摘要
  → UI 也看不到原始内容了
  → prompt cache 前缀变了 → 缓存失效
  → 无法回滚

CQRS 投影：
  msg 2-8 仍然在完整历史中
  → UI 正常显示
  → 只是发给 API 时用压缩视图
  → 随时可以重新投影
```

---

**四、面试官可能的追问**

| 追问 | 回答方向 |
|------|---------|
| "Collapse commit 具体存了什么？" | 存了压缩范围（从 msg N 到 msg M）、压缩后的摘要内容、压缩时间戳。多次压缩会产生多个 commit，形成压缩日志 |
| "CQRS 的两个视图会不会不一致？" | 会。但这是有意为之——API 视图是"有损压缩"，UI 视图是"完整真相"。不一致的方向是确定的：API 视图 ⊂ UI 视图（API 看到的信息是 UI 的子集） |
| "这和 Event Sourcing 有什么关系？" | Event Sourcing 是 CQRS 的写入端实现——消息历史就是事件日志，只追加不修改。Collapse 投影就是从事件日志生成的物化视图。两个模式天然配合 |

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

**回答思路：面试官在考察你的技术广度和深度判断力。不要只列名字，要展示你理解每个项目的核心取舍，并且能说出"为什么欣赏"而不只是"觉得好"。**

---

**三个 Runtime 的设计哲学对比：**

| 项目 | 核心哲学 | 一句话总结 |
|------|---------|-----------|
| Vercel AI SDK | 开发者体验优先 | "我给你最好的 API，复杂性你自己处理" |
| Claude Code | 简单优先，复杂性只在需要时添加 | "核心是 while loop，但外围有 7 层防御" |
| Codex CLI | 安全优先 | "Agent 不能破坏宿主环境，哪怕牺牲便利性" |

**推荐回答：**

> "我深入研究了三个 Runtime：
>
> Vercel AI SDK 的哲学是'开发者体验优先'——streamText 的 API 设计非常优雅，但它把复杂性留给了使用者（没有内置压缩、记忆、错误恢复）。
>
> Claude Code 的哲学是'简单优先，复杂性只在需要时添加'——核心是一个 while loop，但外围有 7 层上下文防御、43 个权限门控的工具、Dream Mode 记忆整合。
>
> Codex CLI 的哲学是'安全优先'——沙箱执行模型确保 Agent 不会破坏宿主环境。
>
> 我最欣赏 Claude Code 的'记忆即维护'决策——用 Markdown 而不是向量数据库，用 Dream Mode 做定期整合。这个洞察是：LLM 天生擅长读写文本，瓶颈不是存储，而是维护。"

**为什么"记忆即维护"值得单独说？** 因为大多数人会直觉地选择向量数据库（听起来更"高级"），但 Claude Code 团队发现记忆的真正难题是过期清理、矛盾解决、碎片整合——这些 LLM 直接操作 Markdown 文件比通过向量数据库 API 更自然。

---

**面试官可能的追问**

| 追问 | 回答方向 |
|------|---------|
| "你觉得这三个项目最大的共同点是什么？" | 都把工具错误回填给模型而不是抛异常——让模型决定如何恢复，而不是硬编码恢复逻辑。这是 Agent 架构的核心范式 |
| "如果只能选一个项目深入学习，你选哪个？" | Claude Code——它是唯一一个在生产环境中解决了所有核心问题（压缩、记忆、恢复、安全）的项目，学习它等于学习完整的 Agent 架构 |
| "Hermes Agent 呢？你没提到它。" | Hermes 的独特价值在于 Gateway 架构（CLI/Telegram/API 多平台）和技能系统（SKILL.md + 条件激活）。如果面试涉及多平台 Agent 部署，Hermes 是最好的参考 |

</details>

#### Q10.2 如果让你从零开始设计一个 Agent Runtime，你会做的第一个设计决策是什么？为什么？

<details>
<summary>查看答案</summary>

**回答思路：面试官在考察你的架构思维——能不能从一个基础决策推导出整个系统的架构。好的回答不是列举功能，而是展示"一个决策如何决定后续所有选择"的因果链。**

---

**核心决策：消息历史只追加，不修改。**

这个决策看似简单，但它决定了后续所有的架构选择：

| 由"只追加"推导出的架构决策 | 推导逻辑 |
|--------------------------|---------|
| 压缩不能修改历史 → 需要 CQRS 投影视图 | 压缩时不能删除原始消息，只能生成"压缩视图"发给 API |
| 只追加 → 最大化 prompt cache 命中率 | 前缀永远不变 → Anthropic prompt cache 命中率最高 → 成本降低 90% |
| 完整历史保留 → 可以回滚到任意时间点 | 用户说"回到 5 分钟前"，直接截断历史即可 |
| UI 和 API 看到不同视图 → 需要分层 | UI 展示完整历史（用户体验），API 看压缩视图（成本控制） |

**推荐回答：**

> "我的第一个决策是：**消息历史只追加，不修改**。
>
> 这一个决策决定了后续所有的架构选择：
> - 压缩不能修改历史 → 需要 CQRS 投影视图
> - 只追加 → 最大化 prompt cache 命中率
> - 完整历史保留 → 可以回滚到任意时间点
> - UI 和 API 看到不同视图 → 需要分层
>
> Claude Code 也做了同样的选择，这不是巧合。"

**为什么不是其他决策？** 比如"先选语言"或"先设计工具系统"——这些是重要的，但不是基础性的。语言选择影响实现细节，工具系统影响功能范围，但"消息历史的数据模型"影响的是整个系统的架构骨架。

---

**面试官可能的追问**

| 追问 | 回答方向 |
|------|---------|
| "只追加不修改，那上下文窗口满了怎么办？" | 这就是为什么需要 CQRS——完整历史保留（写入端），但发给 API 的是压缩投影（读取端）。压缩不修改原始数据，只改变"怎么看"数据 |
| "如果用户要求删除某条消息呢？" | 逻辑删除而不是物理删除——标记为 deleted，投影时跳过。完整历史仍然保留，审计日志不丢失 |
| "Event Sourcing 的缺点呢？" | 存储增长——长会话的完整历史可能很大。解决方案是定期做快照（snapshot），快照之前的事件可以归档到冷存储 |

</details>

#### Q10.3 "简单优先"和"为未来扩展预留"之间怎么平衡？举一个你在实际项目中做过这种权衡的例子。

<details>
<summary>查看答案</summary>

**回答思路：面试官在考察你的工程判断力——不是"你知道什么"，而是"你怎么做决定"。用 Claude Code 的真实演进路径作为例子，展示"先简单后复杂"的渐进式设计。**

---

**Claude Code 的演进路径是最好的例子：**

| 版本 | 做了什么 | 为什么这时候加 |
|------|---------|-------------|
| v1 | while loop + TODO list（内存中） | 最简单的方案，能跑就行 |
| v2 | 加入 Tasks 系统（持久化 + 依赖） | TODO list 在内存中丢失了 → 真实痛点出现 → 加持久化 |
| v3 | 加入 Agent Teams（多 Agent 并行） | 单 Agent 处理大任务太慢了 → 真实瓶颈出现 → 加并行 |

每一步都是在遇到真实限制后才添加复杂性，而不是预先设计。

**推荐回答：**

> "Claude Code 的演进路径是最好的例子：
> - v1: while loop + TODO list（最简单）
> - v2: 加入 Tasks 系统（持久化 + 依赖）
> - v3: 加入 Agent Teams（多 Agent 并行）
>
> 每一步都是在遇到真实限制后才添加复杂性。TODO list 在内存中丢失了 → 加持久化。单 Agent 太慢了 → 加 Teams。
>
> 我的原则：先用最简单的方案上线，等它在生产环境中真正遇到问题，再添加复杂性。预留接口可以，但不要预先实现。"

**"预留接口可以，但不要预先实现"的具体含义：**

```typescript
// ✅ 预留接口（好）：定义抽象，但只实现最简单的版本
interface Compressor {
  compress(messages: Message[]): Message[];
}
class SimpleSnipCompressor implements Compressor {
  // 只实现最简单的"删旧消息"
}

// ❌ 预先实现（坏）：还没遇到问题就实现 7 层压缩
class SevenLayerCompressor implements Compressor {
  // 700 行代码，但可能永远用不到 L3-L7
}
```

---

**面试官可能的追问**

| 追问 | 回答方向 |
|------|---------|
| "怎么判断什么时候该加复杂性？" | 两个信号：① 用户反馈（"太慢了"/"丢数据了"）② 监控指标（错误率上升、成本超预算）。没有这两个信号就不加 |
| "预留接口会不会过度设计？" | 会。所以只在"几乎确定会变化"的地方预留（比如 Provider 抽象——肯定会支持多个模型），不在"可能会变化"的地方预留 |
| "Claude Code 的 Agent Teams 成本 5x，这算不算过早添加复杂性？" | 不算——它是实验性功能（experimental），默认不启用。用户主动选择使用，而且有明确的成本提示。这是"提供选项"而不是"强制复杂性" |

</details>

#### Q10.4 Agent 系统的安全性和易用性之间怎么平衡？太多确认对话框会导致"确认疲劳"，太少又不安全。你怎么设计？

<details>
<summary>查看答案</summary>

**回答思路：面试官在考察你对安全 UX 的理解。关键洞察是"确认疲劳比没有确认更危险"——如果用户每次都无脑点"允许"，确认机制就形同虚设。用 Claude Code 的 auto 模式作为正面案例。**

---

**核心矛盾和解决思路：**

| 极端 | 问题 |
|------|------|
| 每次都确认 | 确认疲劳 → 用户无脑点"允许" → 确认失去意义 → 实际上不安全 |
| 从不确认 | 没有人工防线 → 一次 prompt injection 就可能造成灾难 |
| Claude Code 的平衡 | 渐进式信任 + 风险分级确认 → 只在真正重要的时刻打断用户 |

**推荐回答：**

> "Claude Code 的 auto 模式是最好的平衡案例：
>
> - 不是完全放飞：有独立的分类器模型审查每次操作
> - 不是每次都问：只在高风险操作时才中断
> - 渐进式信任：default → acceptEdits → auto
> - 进入 auto 时主动收窄权限（丢弃宽泛的 allow 规则）
>
> 关键洞察：'确认疲劳'比'没有确认'更危险。如果用户每次都点'允许'，确认就失去了意义。所以要让确认只出现在真正重要的时刻。"

**Claude Code 的三级信任模型：**

```
default 模式：
  读取操作 → 自动允许
  写入操作 → 每次确认
  危险操作 → 每次确认 + 警告
  → 适合初次使用，建立信任

acceptEdits 模式：
  读取操作 → 自动允许
  写入操作 → 自动允许（文件编辑不再确认）
  危险操作 → 每次确认
  → 适合熟悉后，减少打断

auto 模式：
  所有操作 → 独立分类器审查
  分类器判定安全 → 自动执行
  分类器判定危险 → 中断确认
  + 主动丢弃宽泛的 allow 规则（如 Bash(*)）
  → 适合信任建立后，最大效率
```

---

**面试官可能的追问**

| 追问 | 回答方向 |
|------|---------|
| "分类器被 prompt injection 绕过了怎么办？" | 纵深防御——分类器是第一道防线，但不是唯一防线。还有：窄权限规则（即使分类器放行，`Bash(*)` 已被丢弃）、OS 级沙箱（即使命令执行，文件系统和网络受限）、Hooks（PreToolUse 可以加自定义检查） |
| "怎么衡量确认疲劳？" | 指标：确认对话框的"允许"点击率。如果 > 95% 都是"允许"，说明确认太频繁，用户已经疲劳了。应该把这些操作降级为自动允许 |
| "Codex 的方式和 Claude Code 有什么不同？" | Codex 用 Starlark 策略引擎——可编程的规则（if/else/for），比 Claude Code 的 allow/deny 更灵活，但配置门槛更高。Codex 更适合企业级（安全团队写策略），Claude Code 更适合个人开发者（渐进式信任） |

</details>

#### Q10.5 你认为 AI Agent Runtime 在未来 2-3 年会怎么演进？哪些是当前的技术瓶颈？

<details>
<summary>查看答案</summary>

**回答思路：面试官在考察你的技术视野和判断力。不要泛泛而谈"AI 会更强"，要基于四大项目的现状，指出具体的瓶颈和演进方向。每个方向都要有"为什么这么认为"的论据。**

---

**三个演进方向（基于四大项目的现状推导）：**

| 方向 | 当前现状 | 未来演进 | 论据 |
|------|---------|---------|------|
| 上下文窗口增大，但压缩仍然重要 | Claude 200K，GPT 128K | 可能到 1M+ | 即使 1M token，8 小时会话仍会填满；更大窗口 = 更高成本，压缩是成本优化 |
| 多 Agent 协作成熟 | Claude Code Agent Teams（实验性，5x 成本） | 高效协调，共享状态 | 当前基于消息传递的协调太贵，未来可能基于共享上下文或共享工具状态 |
| 安全和治理成为核心竞争力 | 各项目安全能力参差不齐 | 权限系统、审计、沙箱成为核心卖点 | 随着 Agent 能力增强，企业最关心"它不能做什么"而不是"它能做什么" |

**推荐回答：**

> "三个方向：
>
> 1. **上下文窗口会继续增大，但压缩仍然重要**。即使有 1M token 窗口，8 小时的会话仍然会填满它。而且更大的窗口 = 更高的成本，压缩是成本优化。
>
> 2. **多 Agent 协作会成熟**。目前 Claude Code 的 Agent Teams 还是实验性的（5x 成本）。未来会有更高效的协调机制，可能基于共享状态而不是消息传递。
>
> 3. **安全和治理会成为核心竞争力**。随着 Agent 能力增强，企业最关心的不是'它能做什么'，而是'它不能做什么'。权限系统、审计日志、沙箱隔离会从附加功能变成核心卖点。
>
> 当前瓶颈：上下文管理（压缩的信息损失）、工具执行的可靠性（沙箱的性能开销）、多 Agent 协调的成本。"

**当前技术瓶颈的具体分析：**

| 瓶颈 | 具体表现 | 哪个项目受影响最大 |
|------|---------|------------------|
| 压缩的信息损失 | Agent 运行 4 小时后"忘记"早期的关键决策 | Claude Code（7 层防御仍有损）、Hermes（结构化摘要模板外的信息丢失） |
| 沙箱性能开销 | Codex 的 landlock/seatbelt 启动有延迟，Docker 沙箱更重 | Codex（OS 级沙箱）、Hermes（Docker/Modal 沙箱） |
| 多 Agent 成本 | 每个子 Agent 维护独立上下文 → 总 token 消耗翻倍 | Claude Code（Agent Teams 5x 成本） |
| 跨 Provider 兼容 | 不同模型的 tool_call 格式、thinking 格式不统一 | 所有项目（切换模型时容易出 bug） |

---

**面试官可能的追问**

| 追问 | 回答方向 |
|------|---------|
| "你觉得哪个瓶颈最先被解决？" | 跨 Provider 兼容——Vercel AI SDK 的 LanguageModelV4 接口已经在做这件事，MCP 协议也在推动工具层的标准化。这是最容易通过行业协作解决的 |
| "Agent 会取代传统软件开发吗？" | 短期不会。Agent 擅长的是"理解意图 + 调用工具"，但软件开发中大量工作是"理解业务逻辑 + 做权衡决策"。Agent 会成为强大的辅助工具，但不会取代架构师的判断力 |
| "你最期待哪个技术突破？" | 压缩质量评估——当前没有任何项目在量化评估压缩后信息是否保留。如果能建立可靠的评估指标，就能系统性地优化压缩策略，而不是靠经验调参 |

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

**回答思路：先定义"技术债务"，再从四大项目中举证，最后给出有时间线的解决方案。**

---

**一、当前最大的技术债务：上下文压缩的信息损失**

这是所有 Agent Runtime 都面临的根本矛盾：

- **问题本质**：LLM 的上下文窗口是有限的（即使 200K tokens），但长任务的对话历史会无限增长。压缩是必须的，但压缩必然丢失信息。
- **为什么是"债务"**：当前所有项目都在用"先跑起来再说"的方式处理压缩——Claude Code 的 7 层防御虽然精细，但 L5 的 LLM 摘要仍然是有损的；Hermes 的结构化摘要模板虽然保留了关键字段，但模板之外的信息就丢了。
- **债务的代价**：Agent 运行 4 小时后，早期的关键决策（"用户说过不要用 React"）可能被压缩掉。模型会重复犯同样的错误，用户体验急剧下降。

**四大项目的现状对比：**

| 项目 | 压缩方式 | 信息损失程度 | 有没有评估压缩质量？ |
|------|---------|------------|-------------------|
| Claude Code | 7 层防御，L5 用 LLM 摘要 | 中（结构化摘要保留关键字段） | ❌ 没有 |
| Hermes Agent | 2 层，LLM 结构化摘要 | 中（7 节模板） | ❌ 没有 |
| Codex CLI | 基础截断 | 高（直接丢弃旧消息） | ❌ 没有 |
| Vercel AI SDK | 无内置压缩 | N/A（留给使用者） | N/A |

关键发现：**没有任何一个项目在评估压缩后信息是否真的保留了**。都是"压缩了就假设没问题"。

---

**二、其他重要的技术债务**

| 技术债务 | 影响 | 涉及项目 |
|---------|------|---------|
| 多 Agent 协调成本过高 | Claude Code 的 Agent Teams 成本约 5x，因为每个子 Agent 维护独立上下文 | Claude Code、Hermes |
| 工具执行可靠性 | 沙箱隔离有性能开销（Codex 的 landlock/seatbelt 启动延迟），工具超时处理不够优雅 | Codex、Claude Code |
| 跨 Provider 消息格式不统一 | 不同模型的 tool_call 格式、thinking 格式、错误格式都不同，切换模型时容易出 bug | 所有项目 |
| 压缩与缓存的冲突 | 压缩会修改消息历史 → prompt cache 失效 → 全价重新发送。Claude Code 用 frozen 分区缓解，但不彻底 | Claude Code |

---

**三、6 个月的解决方案（带时间线和可交付物）**

**Month 1-2：压缩质量评估框架**

- **目标**：建立自动化评估，量化压缩的信息损失
- **做法**：
  1. 在压缩前，从对话历史中提取 20 个关键事实（用户指令、关键决策、文件路径、错误信息）
  2. 压缩后，让模型基于压缩后的上下文回答这 20 个问题
  3. 对比准确率：如果低于 85%，说明压缩质量不够，需要调整策略
- **交付物**：`CompressionQualityEvaluator` 模块 + 评估报告仪表盘
- **为什么先做这个**：没有评估就没有改进方向。当前所有项目都是"盲压缩"，先建立度量才能优化

**Month 3-4：混合压缩策略**

- **目标**：关键信息零损失，非关键信息有损压缩
- **做法**：
  1. 信息分级：用户的显式指令（"不要用 React"）= 不可压缩；工具的中间输出 = 可压缩；模型的思考过程 = 可丢弃
  2. 不可压缩信息用 CQRS 投影（Claude Code L4 的思路）——完整保留，只是不发给 API
  3. 可压缩信息用 LLM 摘要（Claude Code L5 的思路）——但用 Month 1-2 的评估框架验证质量
  4. 可丢弃信息直接删除（Claude Code L2 的思路）
- **交付物**：`HybridCompressor` 模块，支持信息分级 + 混合策略
- **为什么第二做**：有了评估框架后，可以量化验证混合策略是否真的比单一策略好

**Month 5-6：外部记忆集成**

- **目标**：压缩时不丢信息，而是转移到外部记忆
- **做法**：
  1. 压缩前，把关键信息写入外部记忆存储（类似 Claude Code 的 Dream Mode，但更系统化）
  2. 需要时通过 sideQuery 检索回来（不污染主上下文）
  3. 记忆存储支持语义检索（embedding + 向量索引）和关键词检索（倒排索引）
  4. 记忆有 TTL 和优先级，定期整合和清理
- **交付物**：`ExternalMemoryStore` + `MemoryAwareCompressor`（压缩前自动备份到外部记忆）
- **为什么最后做**：这是最复杂的改造，依赖前两步的基础（评估框架验证效果，混合策略决定哪些信息转移）

---

**四、面试回答模板（3 分钟版）**

> "我认为当前 Agent Runtime 最大的技术债务是**上下文压缩的信息损失**。
>
> 我研究了四大项目的压缩实现——Claude Code 有 7 层防御，Hermes 有结构化摘要，但它们有一个共同的盲点：**没有任何一个项目在评估压缩质量**。都是压缩了就假设没问题。
>
> 如果给我 6 个月，我会分三步走：
> - 前两个月建立**压缩质量评估框架**——压缩前提取关键事实，压缩后验证是否保留，建立量化指标
> - 中间两个月实现**混合压缩策略**——用户指令零损失保留，工具输出有损压缩，模型思考可丢弃
> - 最后两个月做**外部记忆集成**——压缩时不丢信息，而是转移到外部记忆，需要时检索回来
>
> 核心思路是：先有度量，再有优化，最后做架构级改造。"

---

**五、面试官可能的追问**

| 追问 | 回答方向 |
|------|---------|
| "压缩质量评估的 20 个问题怎么选？" | 按类型分：用户指令（5 个）、关键决策（5 个）、文件/代码引用（5 个）、错误和解决方案（5 个）。用 LLM 从压缩前的历史中自动提取 |
| "混合压缩的信息分级怎么判断？" | 规则优先：用户消息 = 不可压缩，tool_result > 10K tokens = 可压缩，assistant 的 thinking = 可丢弃。边界情况用 LLM 判断 |
| "外部记忆用向量数据库还是 Markdown？" | 两者结合：Markdown 做存储（人类可读、LLM 友好），向量索引做检索（语义匹配）。类似 Claude Code 的 Dream Mode + sideQuery，但更系统化 |
| "这个方案的风险是什么？" | 最大风险是评估框架本身的准确性——如果评估问题选得不好，会给出错误的质量信号。需要人工抽检校准 |

</details>
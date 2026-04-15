# 多级上下文压缩 ★★★★★

## 模块概述

上下文压缩是 Agent Runtime 中最关键的工程挑战之一——当对话历史不断增长，如何在有限的上下文窗口中保留最重要的信息，同时控制成本和延迟？

四个项目在上下文压缩上的投入差异巨大：

- **Claude Code** 构建了业界最成熟的 7 层分级防御体系，从零成本的工具结果截断到 LLM 结构化摘要，逐级触发、互斥门控、断路器保护，配合三分区缓存策略最大化 prompt cache 命中率
- **Codex CLI** 采用基础截断策略，依赖模型自身的上下文窗口管理，没有 LLM 摘要机制
- **Vercel AI SDK** 作为框架层有意不提供压缩机制，将这个决策留给使用者
- **Hermes Agent** 实现了 2 层压缩（工具结果修剪 + LLM 结构化摘要），50% 阈值触发，配合迭代摘要更新和 600 秒失败冷却

理解这四种策略的差异和权衡，是面试中与 Agent Loop 并列的最高频考点。

---

## 面试题

### 基础概念题

#### Q2.1 ⭐ 解释岗位要求的五级压缩管道：tool-result-budget → snip → micro → collapse → auto。每一级做什么？为什么要分五级而不是直接用一个摘要器？

<details>
<summary>查看答案</summary>

**为什么要分五级而不是直接用一个摘要器？**

一句话：**便宜的本地控制优先，避免不必要的 LLM 调用**。

直接用 LLM 摘要（auto）的问题：
1. 贵 — 每次摘要本身就消耗大量 token
2. 慢 — 需要一次完整的 API 调用
3. 有损 — 摘要必然丢失细节
4. 可能失败 — 摘要器自身也可能遇到 prompt-too-long

分五级的核心思想是：**能用便宜的方式解决的，绝不用贵的方式**。

**五级管道详解：**

**Level 1: Tool Result Budget（工具结果预算）**

- 做什么：限制每个工具返回结果的大小
- 触发条件：每次工具返回结果时立即检查
- 成本：零（纯本地字符串截断）
- 示例：grep 返回了 50,000 行 → 只保留前 200 行预览 + 完整结果写入磁盘
- 策略：每个工具有 per-tool token 上限（如 4,000 tokens），超出上限 → 截断为预览 + 持久化完整结果
- 三分区：fresh（新结果）/ frozen（已缓存）/ must-reapply（缓存失效需重新应用）

**Level 2: Snip Compact（历史修剪）**

- 做什么：删除旧的消息（API 不发送，UI 保留）
- 触发条件：上下文使用率超过阈值（如 70%）
- 成本：零（纯本地操作）
- 策略：从最旧的消息开始删除，保留 system prompt、最近 N 条消息、用户的关键指令
- 关键细节：修剪后必须重新计算 token 数，否则后续层会误判

**Level 3: Micro Compact（手术式清理）**

- 做什么：利用缓存 TTL 窗口做机会性清理
- 触发条件：缓存即将过期时
- 成本：极低（利用缓存失效的时机）
- 策略：服务端缓存编辑，不拆分 tool-use / tool-result 对，只在缓存 miss 时才清理

**Level 4: Context Collapse（投影摘要 / CQRS 模式）**

- 做什么：维护一个追加式的 collapse 提交日志，每轮投影出压缩视图
- 触发条件：上下文使用率超过阈值（如 85%）
- 成本：低到中（本地投影计算，不需要 LLM）
- 策略：对话历史是 source of truth（命令日志），API 看到投影视图（读模型），UI 保留完整历史
- 关键：如果 collapse 启用，会抑制 Level 5（互斥门控）

**Level 5: Auto-Compact（LLM 摘要 + 断路器）**

- 做什么：调用 LLM 生成结构化摘要
- 触发条件：上下文使用率超过 92%（Claude Code 的阈值）
- 成本：高（需要一次完整的 LLM 调用）
- 策略：结构化摘要包含意图、关键概念、文件列表、错误记录、任务状态、用户消息原文
- PTL 重试：如果摘要器自身 prompt-too-long → 丢弃最旧的 API 轮组再试
- 断路器：连续失败 N 次后停止尝试（本会话不再 auto-compact）

</details>

#### Q2.2 ⭐ Claude Code 的上下文压缩有 7 层防御。请解释从 Layer 1 到 Layer 7 的触发条件和处理策略。为什么要从便宜到昂贵逐级触发？

<details>
<summary>查看答案</summary>

| 层 | 名称 | 触发条件 | 成本 | 关键设计 |
|----|------|---------|------|---------|
| L1 | Tool Result Budget | 每次工具返回时 | 零 | fresh/frozen/must-reapply 三分区 |
| L2 | Snip Compact | 上下文 > 70% | 零 | API 和 UI 分离 |
| L3 | Microcompact (wU2) | 缓存 TTL 到期时 | 极低 | 不拆分 tool-use/tool-result 对 |
| L4 | Context Collapse | 上下文 > 85% | 低 | CQRS 投影，互斥门控 L5 |
| L5 | Auto-Compact | 上下文 > 92% | 高 | 结构化摘要 + 断路器 |
| L6 | Blocking | 上下文 > 98% | 零 | 硬阻塞，不允许新增上下文 |
| L7 | Reactive Recovery | 413/PTL 错误 | 中 | 最后手段，排空 collapse 提交 |

**为什么从便宜到昂贵逐级触发？**

```
假设上下文使用率从 60% 增长到 100%:

60% → 什么都不做
70% → L1+L2 自动触发（零成本，可能释放 10-20%）
     → 如果够了，永远不需要 L3-L7
85% → L3+L4 触发（低成本）
     → 大多数会话在这里稳定下来
92% → L5 触发（高成本，但必要）
     → 长会话才会到这里
98% → L6 硬阻塞
100% → L7 紧急恢复

结果: 90% 的会话只需要 L1+L2，成本为零
```

核心思想：**大多数情况用最便宜的方式就能解决，只有极端情况才需要昂贵的 LLM 摘要**。这种分级设计让系统在成本和信息保留之间取得最优平衡。

</details>

#### Q2.3 解释 Claude Code 的三分区缓存策略：fresh / frozen / must-reapply。为什么要冻结已缓存的内容？这和 Anthropic 的 prompt caching 有什么关系？

<details>
<summary>查看答案</summary>

这三个状态是 Tool Result Budget（L1）中管理工具结果的核心机制：

- **fresh（新鲜）**：刚从工具返回的结果，还没有被 prompt cache 缓存，可以自由修改（截断、替换为预览）
- **frozen（冻结）**：已经被 Anthropic prompt cache 缓存的内容，修改它会导致缓存失效（cache miss），即使它占用空间也不要动它——因为缓存命中时只付 10% 成本，比重新发送便宜得多
- **must-reapply（必须重新应用）**：缓存已经过期（TTL 到期），需要重新发送给 API，此时可以趁机清理或压缩

**为什么要冻结已缓存的内容？**

```
场景: 上下文中有一段 3,000 token 的工具结果，已被缓存

选项 A: 截断它，释放 2,500 tokens
  - 缓存失效 → 下次调用要重新发送全部上下文
  - 成本: 全价发送所有 token

选项 B: 保留它（frozen）
  - 缓存命中 → 下次调用只付 10% 成本
  - 浪费了 3,000 tokens 的空间，但省了 90% 的钱

结论: 缓存稳定性 > 空间效率
```

这和 Anthropic 的 prompt caching 直接相关：
- 首次请求：全价
- 后续请求（缓存命中）：只付 10%
- 但前提是：发送的内容前缀必须和缓存的完全一致
- 如果你修改了中间的任何内容 → 缓存失效 → 回到全价

所以 Claude Code 的策略是：**只追加，不修改已缓存的部分**。这就是为什么消息历史是扁平的、只追加的。

</details>

#### Q2.4 什么是 Context Collapse 的 CQRS 模式？为什么要把对话历史分成"UI 真相"和"API 真相"两个视图？

<details>
<summary>查看答案</summary>

CQRS（Command Query Responsibility Segregation）= 命令查询职责分离。

在 Claude Code 的上下文管理中：

- **命令侧（Command / Write）= 完整的对话历史**：每条消息都保留，每个工具调用和结果都保留，这是 source of truth，UI 展示这个视图
- **查询侧（Query / Read）= 投影的压缩视图**：通过 collapse 提交日志计算出来，旧的消息被折叠成摘要，这是发送给 API 的视图

**为什么要分成两个视图？**

如果直接修改消息历史来压缩：
- 用户看不到之前的对话了（UI 丢失历史）
- 无法回滚到压缩前的状态
- 如果压缩出错，数据永久丢失

保留完整历史，只在发送给 API 时投影出压缩视图：
- UI 始终有完整历史
- 可以随时重新投影（换一种压缩策略）
- 压缩出错不影响原始数据

**Collapse 提交日志是追加式的：**

```typescript
interface CollapseCommit {
  id: string;
  timestamp: number;
  messageRange: { from: number; to: number };  // 折叠哪些消息
  summary: string;                              // 折叠后的摘要
}

// 投影函数：从完整历史 + collapse 日志 → 压缩视图
function projectView(
  fullHistory: Message[],
  collapseLog: CollapseCommit[]
): Message[] {
  let view = [...fullHistory];
  for (const commit of collapseLog) {
    view.splice(
      commit.messageRange.from,
      commit.messageRange.to - commit.messageRange.from,
      { role: 'system', content: `[Collapsed] ${commit.summary}` }
    );
  }
  return view;
}
```

</details>

### 设计题

#### Q2.5 ⭐ 设计一个五级上下文压缩管道。对于每一级，请说明触发条件、压缩策略、退出条件、与其他级别的交互

<details>
<summary>查看答案</summary>

| 级别 | 触发条件 | 压缩策略 | 退出条件 | 与其他级别的交互 |
|------|---------|---------|---------|----------------|
| L1 Tool Budget | 每次工具返回时 | 截断为预览 + 持久化完整结果 | 结果 ≤ per-tool 上限 | 独立运行，不影响其他层 |
| L2 Snip | usage > 70% | 从最旧消息开始删除（保留 system + 最近 N 条） | usage < 60% | 删除后重新计算 token，可能避免触发 L3+ |
| L3 Micro | 缓存 TTL 到期时 | 清理过期缓存块中的旧工具结果 | 无明确退出（机会性清理） | 只在缓存 miss 时触发 |
| L4 Collapse | usage > 85% | CQRS 投影：追加 collapse commit | usage < 75% | **互斥门控**：启用后抑制 L5 |
| L5 Auto | usage > 92% 且 L4 未启用 | LLM 结构化摘要 | usage < 70% | 被 L4 互斥；有断路器 |

**互斥门控的原因：** L4（投影摘要）和 L5（LLM 摘要）都在做"压缩旧消息"，如果同时运行：
- 两个系统可能压缩同一段消息，导致信息双重丢失
- L5 的 LLM 调用看到的是 L4 投影后的视图，摘要质量下降
- 资源浪费：两个系统做重复工作

</details>

#### Q2.6 🔥 你的 Auto-Compact（LLM 摘要）层在执行摘要时，摘要器自身也遇到了 prompt-too-long 错误。怎么处理？请设计完整的恢复链路

<details>
<summary>查看答案</summary>

**完整恢复链路：**

```
Auto-Compact 被触发（上下文 > 92%）
  │
  ▼
尝试 1: 用完整消息历史调用 LLM 做摘要
  │ 成功 → 用摘要替换旧消息，完成
  │ 失败（PTL）↓
  ▼
尝试 2: 丢弃最旧的 1/4 API 轮组，再试
  │ 成功 → 完成
  │ 失败（PTL）↓
  ▼
尝试 3: 丢弃最旧的 1/2 API 轮组，再试
  │ 成功 → 完成
  │ 失败（PTL）↓
  ▼
断路器触发: 停止 Auto-Compact
  │
  ▼
降级策略:
  1. 强制 Snip（L2）— 暴力删除旧消息直到 usage < 80%
  2. 保留: system prompt + 最近 5 条消息 + 记忆文件
  3. 插入系统消息: "[Context was aggressively compacted. Some history was lost.]"
  4. 本会话不再尝试 Auto-Compact（断路器保持打开）
```

```typescript
async function autoCompactWithRecovery(messages: Message[]): Promise<Message[]> {
  let messagesToSummarize = [...messages];
  const maxRetries = 3;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const summary = await callLLMForSummary(messagesToSummarize);
      return rebuildContext(summary, messages);
    } catch (error) {
      if (isPromptTooLong(error)) {
        // 每次丢弃更多旧消息
        const dropRatio = (attempt + 1) / (maxRetries + 1);
        const dropCount = Math.floor(messagesToSummarize.length * dropRatio);
        messagesToSummarize = messagesToSummarize.slice(dropCount);
      } else {
        throw error; // 非 PTL 错误不重试
      }
    }
  }

  // 断路器触发 → 降级到暴力 Snip
  this.circuitBreakerOpen = true;
  return forceSnip(messages);
}
```

</details>


#### Q2.7 🔥 设计互斥门控机制：当 Context Collapse（Layer 4）启用时，如何抑制 Auto-Compact（Layer 5）？为什么需要这个互斥？如果两个系统同时运行会发生什么？

<details>
<summary>查看答案</summary>

```typescript
class CompressionPipeline {
  private collapseEnabled = false;
  private circuitBreakerOpen = false;

  async compress(messages: Message[], usage: number): Promise<Message[]> {
    let result = messages;

    // L1: 始终运行
    result = this.toolResultBudget(result);

    // L2: usage > 70%
    if (usage > 0.70) {
      result = this.snip(result);
      usage = this.recalculateUsage(result);
    }

    // L3: 机会性（缓存 TTL 到期时）
    result = this.microCompactIfOpportunistic(result);

    // === 互斥门控 ===
    if (usage > 0.85) {
      if (this.collapseEnabled) {
        // L4 启用 → 用 Collapse，跳过 L5
        result = this.contextCollapse(result);
      } else if (!this.circuitBreakerOpen && usage > 0.92) {
        // L4 未启用 + 断路器未触发 → 用 L5
        try {
          result = await this.autoCompact(result);
        } catch {
          this.circuitBreakerOpen = true;
        }
      }
    }

    return result;
  }
}
```

**如果两个系统同时运行会发生什么？**

- **信息双重丢失**：L4 已经把消息 10-50 折叠了，L5 又在折叠后的基础上再摘要 → 两层压缩 = 细节丢失更严重
- **不一致**：L4 的投影视图和 L5 的摘要可能矛盾 → 模型看到两个不同版本的"历史"
- **浪费**：L5 的 LLM 调用消耗 token，但 L4 已经解决了问题 → 白花钱

</details>

#### Q2.8 设计断路器（Circuit Breaker）模式用于 Auto-Compact 层：什么条件下触发断路器？触发后怎么办？什么时候重置？

<details>
<summary>查看答案</summary>

```typescript
class AutoCompactCircuitBreaker {
  private failures = 0;
  private maxFailures = 3;
  private state: 'closed' | 'open' | 'half-open' = 'closed';
  private openedAt: number = 0;
  private halfOpenTimeout = 5 * 60 * 1000; // 5 分钟后尝试半开

  async execute(fn: () => Promise<Message[]>): Promise<Message[] | null> {
    if (this.state === 'open') {
      if (Date.now() - this.openedAt > this.halfOpenTimeout) {
        this.state = 'half-open';
      } else {
        return null; // 断路器打开，跳过
      }
    }

    try {
      const result = await fn();
      this.failures = 0;
      this.state = 'closed';
      return result;
    } catch (error) {
      this.failures++;
      if (this.failures >= this.maxFailures) {
        this.state = 'open';
        this.openedAt = Date.now();
      }
      throw error;
    }
  }
}
```

| 问题 | 答案 |
|------|------|
| 什么条件下触发？ | 连续 3 次 Auto-Compact 失败（PTL 或其他错误） |
| 触发后怎么办？ | 跳过 Auto-Compact，降级到 Snip（暴力删除旧消息） |
| 什么时候重置？ | 5 分钟后进入 half-open 状态，允许一次尝试。成功则关闭断路器，失败则重新打开 |

Claude Code 的选择更激进：**整个会话都不再尝试**（没有 half-open）。因为如果 Auto-Compact 连续失败 3 次，说明上下文已经严重膨胀，短时间内不太可能恢复。

</details>

#### Q2.9 💡 一个工具返回了 50,000 token 的搜索结果。请设计 Tool Result Budget 的处理策略

<details>
<summary>查看答案</summary>

**1. 怎么决定保留多少？**
- per-tool 上限：4,000 tokens（可配置）
- 保留策略：头部优先（前 N 行通常最相关）
- 特殊处理：如果是搜索结果，保留匹配行 + 上下文行

**2. 截断后的预览怎么生成？**
- 头部预览：前 100 行
- 统计信息："Total: 50,000 tokens, showing first 4,000"
- 如果是结构化数据：保留 schema + 前几条记录

**3. 完整结果存在哪里？**
- 写入临时文件：`/tmp/agent-tool-results/{tool_call_id}.txt`
- 在预览中包含文件路径
- 模型后续可以用 Read 工具读取完整结果

**4. 模型后续需要时怎么取回？**
- 预览中包含提示："Full result saved to /tmp/xxx. Use Read tool to access."
- 模型可以调用 Read 工具读取特定行范围
- 按需加载，不一次性塞进上下文

```typescript
function applyToolResultBudget(result: string, budget: number): {
  preview: string;
  fullPath: string | null;
} {
  const tokens = countTokens(result);

  if (tokens <= budget) {
    return { preview: result, fullPath: null };
  }

  // 超出预算 → 截断 + 持久化
  const fullPath = `/tmp/agent-results/${crypto.randomUUID()}.txt`;
  writeFileSync(fullPath, result);

  const preview = truncateToTokens(result, budget - 100);
  const meta = `\n\n[Truncated: ${tokens} tokens total, showing first ${budget}. Full result: ${fullPath}]`;

  return { preview: preview + meta, fullPath };
}
```

</details>

### 编码题

#### Q2.10 ⭐ 用 TypeScript 实现一个 MultiLevelCompressor 类，包含五级压缩管道

<details>
<summary>查看答案</summary>

```typescript
interface TokenBudget {
  total: number;
  used: number;
  get usage(): number;
}

class MultiLevelCompressor {
  private collapseLog: Array<{ range: [number, number]; summary: string }> = [];
  private collapseEnabled = false;
  private circuitBreaker = { failures: 0, maxFailures: 3, open: false };

  async compress(messages: Message[], budget: TokenBudget): Promise<Message[]> {
    let result = [...messages];

    // === L1: Tool Result Budget (每次都运行) ===
    result = this.applyToolBudget(result, 4000);
    budget.used = this.countTokens(result);

    if (budget.usage < 0.70) return result;

    // === L2: Snip (usage > 70%) ===
    result = this.snip(result, budget);
    budget.used = this.countTokens(result);

    if (budget.usage < 0.85) return result;

    // === L3: Micro (机会性) ===
    result = this.microCompact(result);
    budget.used = this.countTokens(result);

    if (budget.usage < 0.85) return result;

    // === L4 vs L5: 互斥门控 ===
    if (this.collapseEnabled) {
      // L4: Context Collapse
      result = this.collapse(result);
      budget.used = this.countTokens(result);
    } else if (!this.circuitBreaker.open && budget.usage > 0.92) {
      // L5: Auto-Compact
      try {
        result = await this.autoCompact(result);
        this.circuitBreaker.failures = 0;
      } catch (e) {
        this.circuitBreaker.failures++;
        if (this.circuitBreaker.failures >= this.circuitBreaker.maxFailures) {
          this.circuitBreaker.open = true;
        }
        result = this.forceSnip(result, 0.60);
      }
      budget.used = this.countTokens(result);
    }

    return result;
  }

  private applyToolBudget(messages: Message[], perToolLimit: number): Message[] {
    return messages.map(msg => {
      if (msg.role === 'tool' && this.countTokens([msg]) > perToolLimit) {
        const truncated = this.truncateToTokens(msg.content, perToolLimit - 50);
        return { ...msg, content: truncated + '\n[Truncated. Full result persisted to disk.]' };
      }
      return msg;
    });
  }

  private snip(messages: Message[], budget: TokenBudget): Message[] {
    const result = [...messages];
    const protectedTail = 10;
    let i = 1;

    while (budget.usage > 0.60 && i < result.length - protectedTail) {
      if (result[i].role === 'assistant' && result[i].tool_calls?.length) {
        result.splice(i, 1);
        while (i < result.length && result[i].role === 'tool') {
          result.splice(i, 1);
        }
      } else {
        result.splice(i, 1);
      }
      budget.used = this.countTokens(result);
    }

    return result;
  }

  private collapse(messages: Message[]): Message[] {
    const collapseEnd = messages.length - 10;
    if (collapseEnd <= 1) return messages;

    const toCollapse = messages.slice(1, collapseEnd);
    const summary = this.localSummarize(toCollapse);

    this.collapseLog.push({ range: [1, collapseEnd], summary });

    return [
      messages[0],
      { role: 'system' as const, content: `[Context collapsed]\n${summary}` },
      ...messages.slice(collapseEnd),
    ];
  }

  private async autoCompact(messages: Message[]): Promise<Message[]> {
    const summary = await callLLMForSummary(messages, {
      format: 'structured',
      preserve: ['intent', 'files', 'errors', 'tasks', 'user_messages'],
    });

    return [
      messages[0],
      { role: 'system' as const, content: summary },
      ...messages.slice(-5),
    ];
  }

  private forceSnip(messages: Message[], targetUsage: number): Message[] {
    return [
      messages[0],
      { role: 'system' as const, content: '[Context was aggressively compacted.]' },
      ...messages.slice(-5),
    ];
  }

  private countTokens(messages: Message[]): number {
    return messages.reduce((sum, m) => sum + Math.ceil(m.content.length / 4), 0);
  }

  private truncateToTokens(text: string, maxTokens: number): string {
    return text.slice(0, maxTokens * 4);
  }

  private localSummarize(messages: Message[]): string {
    const tools = messages
      .filter(m => m.tool_calls?.length)
      .map(m => m.tool_calls!.map(t => t.name))
      .flat();
    const errors = messages
      .filter(m => m.content.includes('Error'))
      .map(m => m.content.slice(0, 100));
    return `Tools used: ${[...new Set(tools)].join(', ')}\nErrors: ${errors.length > 0 ? errors.join('; ') : 'none'}`;
  }
}
```

**关键设计点：**
- 每一级有明确的触发条件（usage 阈值）
- L4 和 L5 互斥门控（`collapseEnabled` 标志）
- 断路器模式（连续失败 3 次后停止 Auto-Compact）
- 压缩后重新计算 token 数（`budget.used = this.countTokens(result)`）

</details>

---

## 跨项目对比

| 维度 | Claude Code | Codex CLI | Vercel AI SDK | Hermes Agent |
|------|------------|-----------|---------------|-------------|
| **压缩层级数** | 7 层分级防御（[五层上下文管理体系](/claude_code_docs/context/five-layers)） | 1 层（基础截断） | 无内置压缩 | 2 层（修剪 + LLM 摘要，[上下文压缩器](/hermes_agent_docs/context/compressor)） |
| **触发阈值** | 70%/85%/92% 分级触发 | 固定长度限制 | N/A | 50% 单一阈值 |
| **LLM 摘要** | 有（Layer 5，结构化摘要，[Compact 意图压缩](/claude_code_docs/context/compact-intent)） | 无 | N/A | 有（结构化模板：Goal/Progress/Decisions/Files/Next Steps） |
| **摘要模板** | 意图/概念/文件/错误/任务 | N/A | N/A | Goal/Progress/Decisions/Files/Next Steps/Critical Context |
| **迭代更新** | 未知 | 无 | N/A | 有（增量更新之前的摘要） |
| **断路器** | 有（Auto-Compact 连续失败后停止） | 无 | N/A | 有（600 秒冷却期） |
| **缓存感知** | 有（fresh/frozen/must-reapply 三分区） | 无 | N/A | 有（Anthropic prompt caching） |
| **工具结果持久化** | 有（超大结果写入磁盘） | 无 | N/A | 有（> 100K 字符写入临时文件） |
| **CQRS 分离** | 有（UI 完整历史 / API 压缩视图） | 无 | N/A | 无 |
| **互斥门控** | 有（L4 启用时抑制 L5） | N/A | N/A | 无 |
| **设计哲学** | "从便宜到昂贵逐级触发" | "简单截断够用" | "留给使用者决定" | "够用就好 + 结构化摘要" |

---

## 设计模式与权衡

### 模式 1：分级防御（Tiered Defense）

- **描述：** 从零成本的本地操作到高成本的 LLM 摘要，按成本递增逐级触发，大多数情况用最便宜的方式解决
- **使用项目：** Claude Code（7 层）、Hermes Agent（2 层）
- **权衡：** 成本最优，但系统复杂度高；需要精心设计各层的触发阈值和交互关系

### 模式 2：CQRS 投影（Command Query Responsibility Segregation）

- **描述：** 对话历史是 source of truth（命令日志），API 看到投影视图（读模型），UI 保留完整历史
- **使用项目：** Claude Code（Context Collapse）
- **权衡：** 压缩不丢失原始数据，支持回滚和重新投影；但增加了两套视图的维护成本

### 模式 3：断路器（Circuit Breaker）

- **描述：** 当压缩操作连续失败时，停止尝试并降级到更简单的策略，防止反复失败浪费资源
- **使用项目：** Claude Code（Auto-Compact 断路器）、Hermes Agent（600 秒冷却）
- **权衡：** 防止级联失败，但可能过早放弃——如果断路器触发后上下文状态改善了，需要有重置机制

### 模式 4：缓存感知压缩（Cache-Aware Compression）

- **描述：** 压缩决策考虑 prompt cache 状态，已缓存的内容即使占空间也不修改，等缓存过期后再清理
- **使用项目：** Claude Code（三分区策略）、Hermes Agent（Anthropic cache control）
- **权衡：** 最大化缓存命中率（省 90% 成本），但牺牲了空间效率；需要理解底层 API 的缓存机制

### 模式 5：结构化摘要模板（Structured Summary Template）

- **描述：** 用固定模板（Goal/Progress/Decisions/Files/Next Steps）生成摘要，比自由格式更可靠、更可预测
- **使用项目：** Hermes Agent（结构化模板 + 迭代更新）、Claude Code（意图/概念/文件/错误/任务）
- **权衡：** 摘要质量更稳定，但模板可能不适合所有场景；迭代更新避免信息丢失但增加了复杂度

---

## 答题策略

### 推荐答题结构

1. **先讲核心矛盾**（30 秒）：上下文窗口有限 vs 对话历史不断增长，压缩的本质是在信息保留和成本之间取得平衡
2. **再讲分级策略**（2 分钟）：从便宜到昂贵逐级触发，引用 Claude Code 的 7 层防御和具体阈值（70%/85%/92%）
3. **最后讲关键设计决策**（1 分钟）：CQRS 分离、互斥门控、断路器、缓存感知——展示你理解工程细节

### 常见追问方向

- "你的五级压缩管道太复杂了，三级就够了。你怎么反驳？"
  - 回答要点：90% 的会话只需要 L1+L2（零成本），复杂度在代码里但不在运行时；三级方案在长会话中会过早触发昂贵的 LLM 摘要
- "摘要器自身遇到 prompt-too-long 怎么办？"
  - 回答要点：渐进式丢弃旧轮组重试 → 断路器 → 降级到暴力 Snip
- "为什么不直接用向量数据库做上下文检索？"
  - 回答要点：上下文压缩解决的是"当前会话内"的问题，向量数据库解决的是"跨会话"的问题；当前会话的消息有严格的时序依赖，不适合打散成向量

### 关键源码引用

- Claude Code 压缩核心：`services/compact/` — 7 层防御的完整实现
- Claude Code CQRS 投影：`utils/collapseReadSearch.ts`、`utils/collapseBackgroundBashNotifications.ts`
- Claude Code 缓存策略：三分区（fresh/frozen/must-reapply）在 Tool Result Budget 中实现
- Hermes Agent 压缩器：`agent/context_compressor.py → ContextCompressor`
- Codex 上下文管理：`codex-rs/core/` — 基础截断逻辑

---

## 深入阅读

### Claude Code

- [五层上下文管理体系](/claude_code_docs/context/five-layers) — 从 Tool Result Budget 到 Auto-Compact 的完整分级防御架构
- [Compact 意图压缩策略](/claude_code_docs/context/compact-intent) — LLM 结构化摘要的模板设计、断路器机制、PTL 恢复链路

### Codex CLI

- [自动上下文压缩机制](/codex_docs/context/auto-compact) — Codex 的基础截断策略和上下文长度管理

### Hermes Agent

- [上下文压缩器设计](/hermes_agent_docs/context/compressor) — ContextCompressor 的 2 层压缩、结构化摘要模板、迭代更新机制、600 秒冷却断路器

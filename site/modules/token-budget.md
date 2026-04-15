# Token Budget 管理 ★★★

## 模块概述

Token Budget 管理是 Agent Runtime 中控制资源消耗的核心机制——它决定了上下文窗口中各部分（system prompt、历史消息、工具结果、输出预留）的 token 分配，追踪跨压缩边界的预算变化，并在接近上限时触发告警或硬停止。

四个项目在 Token Budget 管理上的投入差异巨大：

- **Claude Code** 拥有最精细的预算管理——区分 cached/uncached tokens、支持 maxBudgetUsd 成本硬停止、7 层压缩与预算追踪深度联动
- **Codex CLI** 有基础的 token 估算机制，主要用于判断何时截断消息历史
- **Vercel AI SDK** 作为框架不内置预算管理，token 追踪完全由使用者实现
- **Hermes Agent** 有 50% 阈值的压缩触发机制，但没有独立的预算管理器

理解 Token Budget 管理的关键在于：它不仅仅是"数 token"，而是要在成本控制、缓存命中率、压缩时机之间做精细的权衡。

---

## 面试题

### 基础概念题

#### Q5.1 ⭐ 什么是"跨压缩边界的预算追踪"？为什么压缩后需要重新计算 token 数？

<details>
<summary>查看答案</summary>

"跨压缩边界"的意思是：**每次压缩操作之后，token 数量会变化，预算追踪必须重新计算**。

```
压缩前: 消息历史 = 150,000 tokens
执行 L2 Snip: 删除旧消息
压缩后: 消息历史 = 95,000 tokens

问题: 如果预算追踪器还记着 "已用 150,000"
  → 会误判为"预算快用完了"
  → 触发不必要的 L5 Auto-Compact
  → 浪费 token 和时间

正确做法: 压缩后立即重新计算
  budget.used = countTokens(compressedMessages); // 重新计算
```

为什么这不是显而易见的？因为 token 计数有多个来源：

```
来源 1: API 响应中的 usage 字段（最准确，但只在 API 调用后才有）
来源 2: 本地估算（快但不精确）
来源 3: 上一次 API 调用的 usage（可能已过时）

压缩操作发生在两次 API 调用之间
  → 没有新的 API usage 数据
  → 必须用本地估算重新计算
  → 下一次 API 调用后用真实 usage 校准
```

</details>

#### Q5.2 Token 预算需要在哪些部分之间分配？各部分的优先级是什么？

<details>
<summary>查看答案</summary>

```
总预算 = 模型的 max_context_tokens（如 200,000）

分配:
  ┌─────────────────────────────────────────────┐
  │ System Prompt        │ 5-10%  │ 最高优先级   │ 不可压缩
  │ (含工具 schema)       │        │             │
  ├──────────────────────┼────────┼─────────────┤
  │ 记忆 (CLAUDE.md等)    │ 5%     │ 高优先级    │ 每次 compact 后重新加载
  ├──────────────────────┼────────┼─────────────┤
  │ 输出预留              │ 10-15% │ 高优先级    │ 必须预留给模型输出
  ├──────────────────────┼────────┼─────────────┤
  │ 历史消息              │ 50-60% │ 中优先级    │ 可压缩
  ├──────────────────────┼────────┼─────────────┤
  │ 工具结果              │ 15-20% │ 低优先级    │ 最先被压缩
  └──────────────────────┴────────┴─────────────┘

优先级（被压缩的顺序）:
  工具结果 → 旧历史消息 → 旧 assistant 输出 → 记忆 → system prompt（不压缩）
```

**关键洞察：** 输出预留（10-15%）是必须的——如果不预留，模型可能在输出到一半时被截断（触发 max-output-tokens 错误）。Claude Code 的 92% 阈值触发压缩，正是为了保证至少 8% 的空间留给输出。

</details>

#### Q5.3 Anthropic 的 prompt caching 怎么影响 token 预算管理？缓存命中时只付 10% 成本，这对预算追踪有什么影响？

<details>
<summary>查看答案</summary>

```
Anthropic prompt caching:
  - 首次请求: 全价（$3/M input tokens for Sonnet）
  - 缓存命中: 10% 价格（$0.3/M）
  - 缓存条件: 发送内容的前缀必须和缓存完全一致

对预算管理的影响:

1. 成本预算（maxBudgetUsd）不能只看 token 数
   - 同样 100K tokens，缓存命中时只花 $0.03，未命中花 $0.30
   - 预算追踪必须区分 cached vs uncached tokens

2. 压缩决策要考虑缓存影响
   - 修改已缓存的内容 → 缓存失效 → 下次全价
   - 有时候"浪费"空间保留已缓存内容，比压缩它更省钱

3. 消息历史只追加不修改
   - 这就是 Claude Code 选择扁平消息历史的原因
   - 只在末尾追加新消息 → 前缀不变 → 缓存命中率最高
```

```typescript
interface TokenCost {
  inputTokens: number;
  cachedInputTokens: number;    // 缓存命中的部分
  uncachedInputTokens: number;  // 未缓存的部分
  outputTokens: number;
  
  get totalCostUsd(): number {
    return (
      this.cachedInputTokens * CACHED_PRICE_PER_TOKEN +
      this.uncachedInputTokens * FULL_PRICE_PER_TOKEN +
      this.outputTokens * OUTPUT_PRICE_PER_TOKEN
    );
  }
}
```

</details>

### 设计题

#### Q5.4 ⭐ 设计一个 Token Budget Manager

<details>
<summary>查看答案</summary>

```typescript
class TokenBudgetManager {
  private allocations: Record<string, { budget: number; used: number }>;
  private totalBudget: number;
  private maxBudgetUsd: number;
  private totalCostUsd = 0;
  private model: ModelConfig;
  
  constructor(model: ModelConfig, maxBudgetUsd: number) {
    this.model = model;
    this.totalBudget = model.maxInputTokens;
    this.maxBudgetUsd = maxBudgetUsd;
    
    this.allocations = {
      system:   { budget: this.totalBudget * 0.10, used: 0 },
      memory:   { budget: this.totalBudget * 0.05, used: 0 },
      output:   { budget: this.totalBudget * 0.15, used: 0 }, // 预留
      history:  { budget: this.totalBudget * 0.50, used: 0 },
      tools:    { budget: this.totalBudget * 0.20, used: 0 },
    };
  }
  
  get usage(): number {
    const totalUsed = Object.values(this.allocations)
      .reduce((s, a) => s + a.used, 0);
    return totalUsed / this.totalBudget;
  }
  
  get costUsage(): number {
    return this.totalCostUsd / this.maxBudgetUsd;
  }
  
  // 每次 API 调用后更新
  updateFromApiResponse(usage: ApiUsage): void {
    this.totalCostUsd += this.calculateCost(usage);
    if (this.totalCostUsd >= this.maxBudgetUsd) {
      throw new BudgetExhaustedError(
        this.totalCostUsd, this.maxBudgetUsd
      );
    }
  }
  
  // 压缩后重新计算
  recalculateAfterCompression(messages: Message[]): void {
    this.allocations.history.used =
      this.countTokensForRole(messages, 'assistant', 'user');
    this.allocations.tools.used =
      this.countTokensForRole(messages, 'tool');
    this.allocations.system.used =
      this.countTokensForRole(messages, 'system');
  }
  
  // 检查是否需要触发压缩
  shouldCompress(): { needed: boolean; level: number } {
    const usage = this.usage;
    if (usage > 0.92) return { needed: true, level: 5 };
    if (usage > 0.85) return { needed: true, level: 4 };
    if (usage > 0.70) return { needed: true, level: 2 };
    return { needed: false, level: 0 };
  }
  
  // 动态调整分配
  reallocate(from: string, to: string, tokens: number): void {
    this.allocations[from].budget -= tokens;
    this.allocations[to].budget += tokens;
  }
  
  // 预算告警
  getWarnings(): string[] {
    const warnings: string[] = [];
    if (this.usage > 0.80)
      warnings.push(`Context usage at ${(this.usage * 100).toFixed(0)}%`);
    if (this.costUsage > 0.80)
      warnings.push(`Cost at $${this.totalCostUsd.toFixed(2)} of $${this.maxBudgetUsd} limit`);
    return warnings;
  }
}
```

**设计要点：**

- **双维度追踪：** 同时追踪 token 使用量（上下文窗口）和美元成本（maxBudgetUsd）
- **分区预算：** 5 个分区各有独立预算，支持动态调整（reallocate）
- **压缩联动：** `shouldCompress()` 返回压缩级别，与多级压缩管道对接
- **跨压缩边界：** `recalculateAfterCompression()` 在每次压缩后重新计算

</details>

#### Q5.5 🔥 你的 Agent 运行了 3 小时，已经消耗了 80% 的 token 预算。但当前任务还需要大约 2 小时才能完成。怎么办？

<details>
<summary>查看答案</summary>

```
策略 1: 估算剩余需求
  - 统计过去 1 小时的平均 token 消耗率
  - 预估: 剩余 2 小时 × 消耗率 = 预计还需 X tokens
  - 如果 X > 剩余预算 → 需要干预

策略 2: 减少后续消耗
  a. 更激进的压缩: 把 L2 Snip 阈值从 70% 降到 50%
  b. 更小的工具结果预算: per-tool 上限从 4000 降到 2000
  c. 切换到更便宜的模型: Opus → Sonnet（如果任务允许）
  d. 减少工具调用: 在 system prompt 中加入 "Be efficient with tool calls"
  e. 批量操作: 鼓励模型一次读多个文件而不是逐个读

策略 3: 什么时候停止
  - 硬停止: 剩余预算 < 单次 API 调用的最低成本
  - 软停止: 剩余预算 < 预估完成任务所需的 50%
    → 通知用户: "预算即将耗尽，建议保存进度"
  - 优雅停止: 完成当前子任务后暂停，保存状态
```

**面试回答策略：** 先讲估算（量化问题），再讲优化（减少消耗），最后讲兜底（何时停止）。展示你对成本控制的工程直觉。

</details>

#### Q5.6 压缩操作本身也消耗 token。怎么把压缩成本纳入预算管理？

<details>
<summary>查看答案</summary>

```
Auto-Compact 的成本:
  - 输入: 需要把待摘要的消息发给 LLM ≈ 当前上下文的 50-80%
  - 输出: 摘要文本 ≈ 1,000-3,000 tokens
  - 总成本: 可能是一次正常 API 调用的 50-80%

纳入预算的方式:
  1. 压缩前检查: 压缩本身的成本 < 压缩节省的成本？
     - 如果压缩能释放 50K tokens，但压缩本身花 40K tokens → 净收益只有 10K
     - 如果净收益太小，跳过 Auto-Compact，用更便宜的 Snip

  2. 压缩成本计入总预算:
     budgetManager.updateFromApiResponse(compactionUsage);
     // 压缩的 API 调用也算钱

  3. 断路器的额外价值:
     - 如果 Auto-Compact 连续失败，不仅浪费时间，还浪费钱
     - 断路器阻止了无效的 token 消耗
```

**关键洞察：** 压缩不是免费的。一个好的预算管理器必须把压缩成本也纳入追踪，否则会出现"越压缩越穷"的悖论——压缩操作本身消耗了大量预算，导致可用预算更少。

</details>

### 编码题

#### Q5.7 用 TypeScript 实现 TokenBudgetManager 类

<details>
<summary>查看答案</summary>

（核心代码已在 Q5.4 中给出，这里补充成本计算和硬停止逻辑）

```typescript
class TokenBudgetManager {
  // ... Q5.4 的基础结构 ...
  
  private calculateCost(usage: ApiUsage): number {
    const inputCost =
      (usage.cachedTokens * this.model.pricing.cachedInputPer1k / 1000)
      + (usage.uncachedTokens * this.model.pricing.inputPer1k / 1000);
    const outputCost =
      usage.outputTokens * this.model.pricing.outputPer1k / 1000;
    return inputCost + outputCost;
  }
  
  // 预估剩余任务成本
  estimateRemainingCost(estimatedTurns: number): number {
    const avgCostPerTurn = this.totalCostUsd / this.completedTurns;
    return avgCostPerTurn * estimatedTurns;
  }
  
  // 是否应该停止
  shouldStop(): { stop: boolean; reason?: string } {
    if (this.totalCostUsd >= this.maxBudgetUsd) {
      return {
        stop: true,
        reason: `Budget exhausted: $${this.totalCostUsd.toFixed(2)} >= $${this.maxBudgetUsd}`
      };
    }
    
    const remaining = this.maxBudgetUsd - this.totalCostUsd;
    const minCallCost = this.model.pricing.inputPer1k * 0.01;
    if (remaining < minCallCost) {
      return {
        stop: true,
        reason: 'Insufficient budget for even one more API call'
      };
    }
    
    return { stop: false };
  }
}
```

**关键设计点：**

- **双维度停止判断：** 既检查绝对预算（totalCostUsd >= maxBudgetUsd），也检查最小可用预算（剩余不够一次 API 调用）
- **成本估算：** `estimateRemainingCost()` 基于历史平均值预估，用于提前告警
- **缓存感知定价：** `calculateCost()` 区分 cached/uncached tokens，准确计算实际成本

</details>

---

## 跨项目对比

| 维度 | Claude Code | Codex CLI | Vercel AI SDK | Hermes Agent |
|------|------------|-----------|---------------|-------------|
| **预算管理器** | 精细的分区预算追踪（[工具调用 Token 预算](/claude_code_docs/context/tool-budget)） | 基础 token 估算（[Token 用量估算](/codex_docs/context/token-estimate)） | 无内置预算管理 | 50% 阈值触发压缩 |
| **成本追踪** | maxBudgetUsd 硬停止 + cached/uncached 区分 | 无成本追踪 | 无内置 | 无成本追踪 |
| **Token 计数方式** | API usage 字段 + 本地估算校准 | 本地 tiktoken 估算 | 依赖 Provider 返回 | 本地估算（tiktoken） |
| **预算分配** | 分区：system / memory / output / history / tools | 无显式分区 | 无 | 无显式分区 |
| **压缩触发** | 70% / 85% / 92% 分级触发（[Token 估算与计费](/claude_code_docs/api/token-estimate)） | 固定长度截断 | 无 | 50% 单一阈值 |
| **缓存感知** | 三分区缓存（fresh/frozen/must-reapply），压缩决策考虑缓存命中率 | 无 | 无 | 有（Anthropic prompt caching） |
| **输出预留** | 预留 ~8% 给模型输出（92% 阈值） | 无显式预留 | 无 | 无显式预留 |
| **工具结果预算** | per-tool token 上限，超出截断 + 持久化到磁盘 | 无 | 无 | 超过 100K 字符写入临时文件 |
| **硬停止机制** | maxBudgetUsd 成本限制 + maxTurns 轮次限制 | 无 | 无 | max_turns 轮次限制 |

---

## 设计模式与权衡

### 模式 1：分区预算分配（Partitioned Budget Allocation）

- **描述：** 将总 token 预算按角色分区（system / history / tools / output），每个分区有独立的预算上限和压缩优先级
- **使用项目：** Claude Code
- **权衡：** 精细控制各部分的资源消耗，但增加了管理复杂度；分区比例需要根据任务类型动态调整

### 模式 2：阈值分级触发（Tiered Threshold Triggering）

- **描述：** 设置多个使用率阈值（如 70% / 85% / 92%），不同阈值触发不同级别的压缩策略
- **使用项目：** Claude Code（三级阈值）、Hermes Agent（单一 50% 阈值）
- **权衡：** 分级触发避免了"要么不压缩、要么重压缩"的二元选择；但阈值的选择需要经验调优

### 模式 3：缓存感知预算管理（Cache-Aware Budget Management）

- **描述：** 在预算决策中考虑 prompt caching 的影响——保留已缓存内容可能比压缩它更省钱
- **使用项目：** Claude Code（三分区缓存 + 只追加消息历史）
- **权衡：** 最大化缓存命中率可以显著降低成本（90% 折扣），但可能导致上下文中保留了不再需要的旧内容

### 模式 4：双维度预算追踪（Dual-Dimension Budget Tracking）

- **描述：** 同时追踪 token 使用量（上下文窗口维度）和美元成本（费用维度），两个维度独立告警和停止
- **使用项目：** Claude Code（maxBudgetUsd + 上下文使用率）
- **权衡：** 更全面的资源控制，但需要维护模型定价信息；不同模型的定价差异大，切换模型时预算估算会变化

### 模式 5：压缩成本收益分析（Compression Cost-Benefit Analysis）

- **描述：** 在执行压缩前评估"压缩本身的成本 vs 压缩释放的空间"，只在净收益为正时执行
- **使用项目：** Claude Code（断路器 + 压缩成本计入预算）
- **权衡：** 避免了"越压缩越穷"的悖论，但增加了决策延迟；需要准确估算压缩成本

---

## 答题策略

### 推荐答题结构

1. **先讲预算的两个维度**（30 秒）：Token 预算管理有两个维度——上下文窗口容量（token 数）和费用成本（美元），两者需要同时追踪
2. **再讲分配和追踪**（2 分钟）：说明 5 个分区的预算分配、压缩后重新计算的必要性、缓存对成本的影响
3. **最后讲权衡**（1 分钟）：压缩成本 vs 压缩收益、缓存命中率 vs 上下文新鲜度、何时硬停止

### 常见追问方向

- "压缩后为什么要重新计算 token 数？"
  - 回答要点：压缩发生在两次 API 调用之间，没有新的 API usage 数据，必须用本地估算重新计算，下次 API 调用后用真实 usage 校准
- "prompt caching 怎么影响压缩决策？"
  - 回答要点：修改已缓存内容会导致缓存失效，有时保留旧内容比压缩更省钱；Claude Code 选择只追加不修改消息历史，最大化缓存命中率
- "预算快用完了怎么办？"
  - 回答要点：三步走——估算剩余需求、减少后续消耗（更激进压缩、切换便宜模型、批量操作）、优雅停止（完成当前子任务后暂停）

### 关键源码引用

- Claude Code Token 预算：`services/compact/` 中的预算检查逻辑
- Claude Code 成本追踪：API 调用后的 usage 更新和 maxBudgetUsd 检查
- Codex Token 估算：`codex-rs/` 中的 token 计数实现
- Hermes Agent 压缩阈值：`agent/context_compressor.py` 中的 50% 触发逻辑

---

## 深入阅读

### Claude Code

- [工具调用 Token 预算](/claude_code_docs/context/tool-budget) — per-tool token 上限、工具结果截断策略、预算分配机制的源码分析
- [Token 估算与计费](/claude_code_docs/api/token-estimate) — cached/uncached token 区分、maxBudgetUsd 硬停止、成本追踪的完整实现

### Codex CLI

- [Token 用量估算](/codex_docs/context/token-estimate) — 本地 tiktoken 估算、消息历史长度限制、截断策略的实现细节

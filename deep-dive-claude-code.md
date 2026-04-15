# Claude Code 源码深度剖析

> 基于泄露的 512K 行 TypeScript 源码，逐模块拆解实现原理

---

## 1. 状态机 Agent Loop ★★★★★

### 核心文件：`query.ts` → `queryLoop()`

Claude Code 的 Agent Loop 不是教科书式的状态机，而是一个**被严格约束的 while(true) 循环**，内部通过 `State` 对象管理跨迭代的可变状态。

### 执行流程

```
用户输入
  │
  ▼
entrypoints/cli.tsx → 模式分发
  │ interactive → TUI (Ink/React)
  │ -p "..."   → headless/print
  │ daemon     → 长运行监督者
  ▼
main.tsx → 上下文组装
  │ systemPrompt + 工具 schema + 环境信息 + git 状态
  │ + 会话记忆 + MCP 上下文 + 输出偏好
  ▼
query.ts → queryLoop() {
  // 初始化
  let state: State = { messages, toolUseContext, turnCount: 1, ... }
  const budgetTracker = createBudgetTracker()
  using pendingMemoryPrefetch = startRelevantMemoryPrefetch(messages)

  while (true) {
    // === 每轮迭代开始 ===
    
    // 1. 压缩管道（按顺序执行）
    messagesForQuery = applyToolResultBudget(messages)     // L1
    messagesForQuery = snipCompactIfNeeded(messagesForQuery) // L2
    messagesForQuery = microcompact(messagesForQuery)        // L3
    messagesForQuery = contextCollapse.apply(messagesForQuery) // L4
    messagesForQuery = autocompact(messagesForQuery)          // L5
    
    // 2. 调用模型（流式）
    for await (const message of callModel({messages, tools, ...})) {
      // 暂扣可恢复错误（PTL、max-output-tokens）
      if (isWithheldError(message)) { withheld = true; continue }
      yield message  // 流式输出给前端
      
      // 收集 tool_use blocks
      if (message has tool_use) {
        toolUseBlocks.push(...)
        needsFollowUp = true
        // 流式工具执行：工具在模型还在输出时就开始执行
        streamingToolExecutor.addTool(toolBlock)
      }
    }
    
    // 3. 错误恢复
    if (withheld PTL) → collapse drain → reactive compact → surface error
    if (withheld max-output-tokens) → escalate to 64K → multi-turn recovery
    if (model fallback triggered) → switch model, retry
    
    // 4. 如果没有 tool calls → 执行 stop hooks → 返回
    if (!needsFollowUp) {
      handleStopHooks()
      checkTokenBudget()
      return { reason: 'completed' }
    }
    
    // 5. 执行工具（流式或批量）
    for await (const result of toolExecutor.getRemainingResults()) {
      yield result.message
      toolResults.push(result)
    }
    
    // 6. 收集附件（文件变更通知、记忆预取、技能发现）
    for await (const attachment of getAttachmentMessages(...)) {
      yield attachment
      toolResults.push(attachment)
    }
    
    // 7. 检查终止条件
    if (aborted) return { reason: 'aborted' }
    if (turnCount > maxTurns) return { reason: 'max_turns' }
    
    // 8. 更新状态，继续循环
    state = { messages: [...messages, ...assistantMessages, ...toolResults], turnCount: turnCount + 1, ... }
  }
}
```

### 关键优化细节

**流式工具执行（StreamingToolExecutor）**：
- 工具不等模型输出完毕就开始执行
- 模型输出 tool_use block → 立即提交给 executor
- executor 在后台执行，结果在模型输出结束后收集
- 效果：工具执行和模型输出并行，减少总延迟

**State 对象设计**：
```typescript
interface State {
  messages: Message[]
  toolUseContext: ToolUseContext
  maxOutputTokensOverride: number | undefined  // 64K 升级
  autoCompactTracking: AutoCompactTracking     // 压缩状态追踪
  maxOutputTokensRecoveryCount: number         // 恢复尝试次数
  hasAttemptedReactiveCompact: boolean         // 防止重复压缩
  turnCount: number
  pendingToolUseSummary: Promise<...>          // 上一轮的工具摘要（异步）
  transition: { reason: string }               // 状态转移原因（调试用）
}
```

每次 `continue` 时创建新的 State 对象（不是修改），transition.reason 记录为什么要继续循环（调试用）：
- `'next_turn'` — 正常的工具执行后继续
- `'reactive_compact_retry'` — PTL 恢复后重试
- `'max_output_tokens_recovery'` — 输出截断恢复
- `'max_output_tokens_escalate'` — 升级到 64K
- `'stop_hook_blocking'` — stop hook 阻止了完成
- `'collapse_drain_retry'` — collapse 排空后重试
- `'token_budget_continuation'` — token budget 要求继续

**模型 Fallback**：
```
callModel() 抛出 FallbackTriggeredError
  → 清空当前轮的 assistantMessages 和 toolResults
  → 切换到 fallbackModel
  → 丢弃流式工具执行器的待处理结果
  → 创建新的 StreamingToolExecutor
  → 如果是内部版本，strip thinking signature blocks（不同模型的签名不兼容）
  → yield 系统消息通知用户
  → continue（重试整个请求）
```

---

## 2. 多级上下文压缩 ★★★★★

### 核心文件：`services/compact/`、`utils/collapseReadSearch.ts`、`query/tokenBudget.ts`

### 完整压缩管道（在 queryLoop 每轮迭代中按顺序执行）

```
messagesForQuery = [...getMessagesAfterCompactBoundary(messages)]

// L1: Tool Result Budget
messagesForQuery = applyToolResultBudget(messagesForQuery, contentReplacementState)

// L2: Snip Compact
if (feature('HISTORY_SNIP')) {
  snipResult = snipCompactIfNeeded(messagesForQuery)
  messagesForQuery = snipResult.messages
  snipTokensFreed = snipResult.tokensFreed
}

// L3: Microcompact
microcompactResult = microcompact(messagesForQuery, toolUseContext)
messagesForQuery = microcompactResult.messages

// L4: Context Collapse（如果启用，在 L5 之前运行）
if (feature('CONTEXT_COLLAPSE') && contextCollapse) {
  collapseResult = contextCollapse.applyCollapsesIfNeeded(messagesForQuery)
  messagesForQuery = collapseResult.messages
}

// L5: Auto-Compact
{ compactionResult, consecutiveFailures } = autocompact(messagesForQuery, ...)
if (compactionResult) {
  messagesForQuery = buildPostCompactMessages(compactionResult)
  tracking = { compacted: true, turnCounter: 0, consecutiveFailures: 0 }
}
```

### L1: Tool Result Budget — `applyToolResultBudget()`

```
原理：限制每个工具返回结果的大小

contentReplacementState 管理三分区：
  fresh    — 新结果，可以自由截断
  frozen   — 已被 prompt cache 缓存，不动（修改会导致缓存失效）
  must-reapply — 缓存过期，可以趁机清理

流程：
  1. 遍历所有 tool result 消息
  2. 检查每个结果的 token 数是否超过 per-tool 上限
  3. 超出 → 截断为预览 + 完整结果写入磁盘
  4. 记录替换到 contentReplacementState（用于跨轮次追踪）
  5. 如果 persistReplacements=true，持久化替换记录（用于会话恢复）

特殊处理：
  - 某些工具（如 LSP）的 maxResultSizeChars 是 Infinity，不截断
  - 替换记录可以持久化到 agentId 对应的文件（子 Agent 恢复用）
```

### L2: Snip Compact — `snipCompactIfNeeded()`

```
原理：删除旧消息（API 不发送，UI 保留）

流程：
  1. 计算当前 token 使用量
  2. 如果超过阈值 → 从最旧的消息开始删除
  3. 保留：system prompt + 最近 N 条消息
  4. 返回 { messages, tokensFreed, boundaryMessage }
  5. tokensFreed 传递给 L5，让 autocompact 的阈值检查考虑 snip 释放的空间

关键：snipTokensFreed 必须传递给后续层
  - tokenCountWithEstimation 读的是上一次 API 响应的 usage
  - snip 发生在两次 API 调用之间，usage 是过时的
  - 不传递 → autocompact 误判为"还是太大" → 不必要的 LLM 摘要
```

### L3: Microcompact — `microcompact()`

```
原理：利用 prompt cache TTL 窗口做机会性清理

两种模式：
  1. 普通 microcompact：清理过期的工具结果
  2. Cached microcompact（feature('CACHED_MICROCOMPACT')）：
     - 通过服务端 cache editing API 删除缓存中的旧内容
     - 不修改本地消息（保持 replay 确定性）
     - 延迟 yield boundary message 到 API 响应后
     - 用 cache_deleted_input_tokens 字段获取实际删除量

不可拆分规则：tool_use 和 tool_result 必须成对删除
```

### L4: Context Collapse — `contextCollapse.applyCollapsesIfNeeded()`

```
原理：CQRS 投影摘要

核心概念：
  - 对话历史是 source of truth（命令日志）
  - API 看到的是投影视图（读模型）
  - collapse 是追加式的 commit log
  - projectView() 在每轮迭代时重放 commit log

流程：
  1. 检查是否需要新的 collapse
  2. 如果需要 → 选择要折叠的消息范围
  3. 生成摘要（本地或 LLM）
  4. 追加 collapse commit 到日志
  5. 返回投影后的消息数组

与 L5 的互斥：
  - L4 在 L5 之前运行
  - 如果 L4 把 token 使用率降到 autocompact 阈值以下 → L5 不触发
  - 效果：用便宜的投影替代昂贵的 LLM 摘要

PTL 恢复：
  - 如果 API 返回 413（prompt-too-long）
  - 先尝试 recoverFromOverflow()：排空所有 staged collapses
  - 如果排空后仍然 413 → 降级到 reactive compact（L5）
```

### L5: Auto-Compact — `autocompact()`

```
原理：LLM 结构化摘要 + 断路器

触发条件：
  - tokenCountWithEstimation(messages) - snipTokensFreed > threshold
  - threshold ≈ 92% of context window

摘要内容：
  - 结构化格式：意图、关键概念、文件、错误、任务状态、用户消息原文
  - 恢复关键上下文：最近的文件、计划状态、待处理的工具

断路器：
  - consecutiveFailures 跨迭代传递
  - 超过阈值后停止尝试
  - tracking.consecutiveFailures 在 compactionResult 成功时重置为 0

task_budget 跨压缩边界：
  - 压缩前记录 preCompactContext（最后一次 API 响应的 context tokens）
  - taskBudgetRemaining -= preCompactContext
  - 传递给下一次 API 调用的 taskBudget.remaining
  - 这样服务端知道压缩前已经消耗了多少
```

### L6-L7: Blocking + Reactive Recovery

```
L6 Blocking（在 queryLoop 中直接检查）：
  if (isAtBlockingLimit && !compactionResult && !reactiveCompactEnabled) {
    yield PROMPT_TOO_LONG_ERROR_MESSAGE
    return { reason: 'blocking_limit' }
  }
  
  跳过条件：
  - 刚刚完成了压缩（compactionResult 存在）
  - reactive compact 启用且 auto compact 也启用
  - context collapse 启用且 auto compact 也启用
  - querySource 是 'compact' 或 'session_memory'（压缩 Agent 自身）

L7 Reactive Recovery（在 needsFollowUp=false 时检查）：
  if (isWithheld413) {
    // 先尝试 collapse drain
    if (contextCollapse && state.transition?.reason !== 'collapse_drain_retry') {
      drained = contextCollapse.recoverFromOverflow(messages)
      if (drained.committed > 0) → continue（重试）
    }
    // 再尝试 reactive compact
    if (reactiveCompact && !hasAttemptedReactiveCompact) {
      compacted = reactiveCompact.tryReactiveCompact(...)
      if (compacted) → continue（重试）
    }
    // 都失败 → surface error
    yield lastMessage
    return { reason: 'prompt_too_long' }
  }
```

---

## 3. 跨会话记忆系统 ★★★★

### 核心文件：`memdir/`、`services/SessionMemory/`、`services/autoDream/`、`services/extractMemories/`、`utils/sideQuery.ts`

### 记忆架构

```
两套独立系统：

1. CLAUDE.md（用户写的，稳定规则）
   - 沿目录树向上查找并合并
   - foo/bar/CLAUDE.md + foo/CLAUDE.md
   - 每次 compact 后重新加载
   - 不会被压缩丢弃

2. Auto Memory / memdir（Claude 学的，渐进演化）
   Memory Directory/
   ├── ENTRYPOINT.md     ← 索引（< 25KB）
   ├── user-prefs.md     ← 用户偏好
   ├── project-ctx.md    ← 项目状态
   ├── feedback.md       ← 用户纠正
   └── logs/             ← 每日日志

   四种类型：
   - user: 角色、目标、偏好
   - feedback: "不要做 X" / "继续做 Y"
   - project: 进行中的工作、截止日期
   - reference: 外部系统指针
```

### sideQuery 语义检索 — `utils/sideQuery.ts`

```
原理：在主对话之外做检索，结果注入上下文但不污染消息历史

流程：
  1. queryLoop 开始时启动 startRelevantMemoryPrefetch()
  2. 异步执行（不阻塞主循环）
  3. 在工具执行完成后检查是否 settled
  4. 如果 settled → filterDuplicateMemoryAttachments() 去重
  5. 作为 attachment 注入到下一轮的消息中

using 语法：
  using pendingMemoryPrefetch = startRelevantMemoryPrefetch(messages)
  // 自动在 generator 退出时 dispose（清理 + 遥测）

去重逻辑：
  filterDuplicateMemoryAttachments(memories, readFileState)
  - readFileState 追踪模型已经 Read/Write/Edit 过的文件
  - 如果记忆文件已经被模型读过 → 跳过（避免重复注入）
```

### Dream Mode — `services/autoDream/`

```
原理：空闲时自动整合记忆

4 阶段：
  Phase 1: Orient — ls 记忆目录，读索引
  Phase 2: Gather — 检查日志，窄范围 grep
  Phase 3: Consolidate — 合并，相对日期→绝对日期，删除矛盾
  Phase 4: Prune — 索引 < 25KB，删除过期

触发条件：Agent 空闲时（通过 cron 或 idle 检测）
```

---

## 4. 多级错误恢复 ★★★★

### 在 queryLoop 中的实现

```
错误恢复是 queryLoop 的核心复杂性来源。以下是完整的恢复链路：

=== prompt-too-long (413) ===
1. 流式输出时暂扣错误（withheld = true）
2. 流式结束后检查：
   a. 先尝试 collapse drain（排空 staged collapses）
      - 如果上一次 transition 已经是 collapse_drain_retry → 跳过
      - 成功 → continue（重试）
   b. 再尝试 reactive compact（LLM 摘要）
      - 如果 hasAttemptedReactiveCompact → 跳过（防止循环）
      - 成功 → continue（重试），设置 hasAttemptedReactiveCompact = true
   c. 都失败 → surface error，return

=== max-output-tokens ===
1. 流式输出时暂扣错误
2. 流式结束后检查：
   a. 先尝试 escalate（8K → 64K）
      - 只在 maxOutputTokensOverride === undefined 时触发（一次性）
      - continue（重试，带 maxOutputTokensOverride: 64K）
   b. 再尝试 multi-turn recovery（最多 N 次）
      - 注入恢复消息："Output token limit hit. Resume directly..."
      - maxOutputTokensRecoveryCount++
      - continue
   c. 恢复次数耗尽 → surface error

=== 模型不可用 ===
1. callModel() 抛出 FallbackTriggeredError
2. 清空当前轮的所有状态
3. 切换到 fallbackModel
4. yield 系统消息通知用户
5. continue（重试）

=== 流式中断 ===
1. 检测 abortController.signal.aborted
2. 如果有 streamingToolExecutor → 收集剩余结果（生成 synthetic tool_results）
3. 否则 → yieldMissingToolResultBlocks（为孤立的 tool_use 生成占位结果）
4. return { reason: 'aborted' }
```

---

## 5. Token Budget 管理 ★★★

### 核心文件：`query/tokenBudget.ts`、`utils/tokenBudget.ts`

```
两个层面的 budget：

1. Token Budget（feature('TOKEN_BUDGET')）
   - 用户通过 "+500k" 或 "use 2M tokens" 指定
   - budgetTracker 追踪每轮的 output tokens
   - checkTokenBudget() 在每轮结束时检查
   - 如果未达到目标 → 注入 nudge message 让模型继续
   - 如果达到目标 → 正常完成

2. Task Budget（params.taskBudget）
   - 跨压缩边界追踪
   - taskBudgetRemaining 在每次 compact 时更新：
     taskBudgetRemaining -= preCompactContext
   - 传递给 API 的 taskBudget.remaining
   - 服务端用这个值知道压缩前已经消耗了多少

3. 成本追踪（cost-tracker.ts）
   - maxBudgetUsd 硬停止
   - 区分 cached vs uncached tokens
   - 缓存命中时只付 10% 成本
```

---

## 6. 推测执行 ★★★

### Claude Code 的推测执行体现在两个地方：

**1. 流式工具执行（StreamingToolExecutor）**
```
这是一种"推测"：模型还在输出时就开始执行工具

流程：
  模型输出 tool_use block A → executor 立即开始执行 A
  模型继续输出 tool_use block B → executor 开始执行 B
  模型输出完毕 → 收集 A 和 B 的结果

效果：工具执行和模型输出并行
风险：如果模型输出被中断（fallback），需要丢弃 executor 的待处理结果
```

**2. Checkpoint 系统**
```
核心文件：utils/fileHistory.ts

每次文件编辑前创建快照：
  - 记录文件的原始内容
  - 支持跨会话持久化
  - 用户可以 /rewind 回滚到任意 checkpoint

限制：Bash 命令的文件修改不被追踪
```

---

## 7. 沙箱 ★★★

### 核心文件：`utils/sandbox/`

```
Claude Code 的沙箱基于操作系统级机制：

macOS: Seatbelt（App Sandbox）
  - sandbox-exec 命令
  - .sb 配置文件定义允许的操作
  - 文件系统和网络限制

Linux/WSL2: bubblewrap (bwrap)
  - 用户空间沙箱
  - namespace 隔离
  - 文件系统挂载限制

两种模式：
  1. auto-allow: 可沙箱的命令自动批准，不可沙箱的走权限流程
  2. regular: 所有命令都走权限流程，沙箱只是额外保护层

配置：
  sandbox.enabled: true/false
  sandbox.autoAllowBashIfSandboxed: true/false
  sandbox.allowUnsandboxedCommands: true/false（escape hatch）
  sandbox.filesystem.allowWrite: ["/tmp/build"]
  sandbox.filesystem.denyRead: ["~/.aws/credentials"]
  sandbox.network.allowedDomains: ["github.com", "*.npmjs.org"]

子进程继承：所有 Claude Code 生成的子进程继承沙箱约束

escape hatch：
  - 如果命令因沙箱限制失败
  - Claude 可以分析失败原因，用 dangerouslyDisableSandbox 重试
  - 重试仍然走权限流程
  - 如果 allowUnsandboxedCommands=false → 忽略 escape hatch
```
# Agent Harness 架构师 — 面试学习计划

> 目标：3-4 周内掌握 AI Agent Runtime 核心架构，能在面试中自信地讲出设计方案
> 技术栈：TypeScript / Bun / Vercel AI SDK / 状态机 / 分布式系统 / 流式处理

## 相关项目文件:
- claude code源码[claude code/]
- Vercel AI SDK源码[ai/]
- Codex源码[codex/]
- hermes-agent源码[hermes-agent/]

---

## 一、岗位核心能力拆解

该岗位要求设计和实现 Agent 运行时的核心引擎，代码将直接决定 Agent 能否在生产环境中稳定运行 8 小时不崩溃。

### 六大核心模块

| # | 模块 | 关键词 | 权重 |
|---|------|--------|------|
| 1 | 状态机 Agent Loop | 多阶段 Phase 管道、流式工具并行执行 | ★★★★★ |
| 2 | 多级上下文压缩 | tool-result-budget → snip → micro → collapse → auto 五级管道 | ★★★★★ |
| 3 | 跨会话记忆系统 | 四类型持久化记忆 + sideQuery 语义检索 | ★★★★ |
| 4 | 多级错误恢复 | prompt-too-long 压缩恢复、max-output-tokens 升级、模型 fallback | ★★★★ |
| 5 | Token Budget 管理 | 跨压缩边界的预算追踪 | ★★★ |
| 6 | 推测执行 | overlay 预执行 + 用户确认 | ★★★ |
| 7 | 沙盒 | 沙盒 + 执行原理 + 安全 | ★★★ |

---

## 二、学习资源排序

### 第一优先级：Vercel AI SDK（直接对口岗位要求）

- 仓库：https://github.com/vercel/ai
- 核心包：`packages/ai/` — streamText / generateText / tool calling
- Provider 抽象：`packages/provider/` — 模型 fallback 的基础
- 文档：https://sdk.vercel.ai/docs

### 第二优先级：Claude Code 源码（生产级 Agent 架构参考）

- 泄露背景：2026年3月31日，安全研究员 Chaofan Shou 发现 Claude Code npm 包中包含完整 source map（cli.js.map），暴露约 512,000 行 TypeScript 源码
- 分析资源：
  - https://clawdecode.net/ — 最完整的泄露分析，43 个工具、7 个隐藏功能、完整系统提示词重建
  - https://www.janypka.com/claude-code-internals-a-quick-deep-dive/ — 10 个核心模块快速深入
  - https://blog.promptlayer.com/claude-code-behind-the-scenes-of-the-master-agent-loop/ — 主 Agent Loop 幕后机制
  - https://docs.bswen.com/blog/2026-03-25-claude-code-architecture/ — 架构分析，TODO 到 Tasks 演进
  - https://interviewbrowser.com/blog/claude-code-context-management — 上下文管理 7 层防御
  - https://www.penligent.ai/hackinglabs/inside-claude-code-the-architecture-behind-tools-memory-hooks-and-mcp/ — 工具、记忆、Hooks、MCP 完整架构
- 社区 Fork：
  - https://github.com/Gitlawb/openclaude — OpenClaude，接入任意 LLM
  - https://github.com/yasasbanukaofficial/claude-code — 社区源码镜像

### 第三优先级：Codex Runtime（补充视角）

- 仓库：https://github.com/openai/codex
- 重点：沙箱执行模型、Agent Loop 设计

### 补充阅读

- Claude Agent SDK 官方文档：https://code.claude.com/docs/en/agent-sdk/agent-loop
- LangGraph（Python）：状态机 Agent 参考实现
- Mastra：TypeScript Agent 框架

---

## 三、学习计划（4 周）

### 第 1 周：Vercel AI SDK 深读 — 建立 Agent Loop 核心认知

#### Day 1-2：AI 辅助建立全局认知

**目标**：用 AI 快速建立 Vercel AI SDK 的架构地图

**操作**：

```bash
git clone https://github.com/vercel/ai.git
cd ai && pnpm install
```

**向 AI 提问的关键问题**（带着这些问题去理解）：

1. "streamText 从接收 prompt 到返回第一个 token，中间经过哪些函数调用？画出完整调用链"
2. "generateText 和 streamText 的 agent loop 有什么区别？maxSteps 循环里每一步 messages 数组怎么变化？"
3. "当 tool call 失败时，SDK 的重试逻辑是什么？"
4. "Provider 抽象层怎么实现模型切换？如果要做模型 fallback 该怎么扩展？"

**产出**：一张手绘架构图 + 一份疑问清单

#### Day 3-5：源码精读验证

**只需精读约 2000 行核心逻辑**：

| 文件 | 对应岗位模块 | 重点关注 |
|------|-------------|---------|
| `packages/ai/core/generate-text/generate-text.ts` | 状态机 Agent Loop | step 循环、tool roundtrip、finishReason 判断 |
| `packages/ai/core/stream-text/stream-text.ts` | 流式处理 | ReadableStream / TransformStream 使用、背压控制 |
| `packages/ai/core/tool/tool-call.ts` | 工具并行执行 | 并行 tool call 处理、结果回填 |
| `packages/provider/` 接口定义 | 模型 fallback | Provider 协议抽象、统一接口 |

**带着疑问验证**：
- "AI 说这里用了 TransformStream，真的吗？"
- "AI 说 tool call 是并行的，代码里怎么实现的？"
- "错误重试的逻辑真的是这样吗？"

**产出**：修正后的架构图 + 关键代码片段笔记

#### Day 6-7：动手实现简化版

不看源码，凭理解写一个 mini agent loop：

```typescript
// mini-agent-loop.ts — 你的面试 demo
import { generateText } from 'ai';

async function agentLoop(prompt: string, maxSteps = 10) {
  let messages: Message[] = [{ role: 'user', content: prompt }];

  for (let step = 0; step < maxSteps; step++) {
    const result = await generateText({
      model,
      messages,
      tools,
    });

    if (result.finishReason === 'stop') break;

    // 处理 tool calls
    for (const toolCall of result.toolCalls) {
      const toolResult = await executeTool(toolCall);
      messages.push(/* tool result message */);
    }

    // 关键：加入 token budget 检查和压缩逻辑
    messages = await compressIfNeeded(messages, tokenBudget);
  }
}
```

**产出**：一个能跑的 demo，面试时可以展示

---

### 第 2 周：Claude Code 源码分析 — 学习生产级 Agent 架构

#### Day 1-2：整体架构认知

**Claude Code 的本质**：不是一个 CLI 聊天工具，而是一个完整的 Agent 操作系统：
- 任务运行时（task runtime）
- 工具执行引擎（tool execution engine）
- 多 Agent 编排器（multi-agent orchestrator）
- 有状态会话系统（stateful session system）
- 带预算和护栏的受限环境（constrained environment）

**核心执行流程**（来源：泄露源码分析）：

```
用户输入 → 模式分发 → 系统提示词选择 → 上下文组装 → 模型调用
→ 流式输出 + 工具调用 → 工具执行 → 循环 → 停止 → 渲染
```

**10 个核心模块**（按重要性排序）：

1. **模式分发**（entrypoints/cli.tsx, main.tsx）
   - `claude` → 交互式 TUI（Ink/React）
   - `claude -p "..."` → 无头/打印模式
   - `claude daemon` → 长运行监督者
   - 在任何模型调用之前，系统已经知道：交互式 vs 无头、短生命周期 vs 持久、单 Agent vs 编排

2. **动态系统提示词选择**
   - 默认编码提示词
   - 协调者（多 Agent 编排）提示词
   - Agent 特定提示词
   - CLI 覆盖（--system-prompt）
   - 不是在提示一个模型，而是在选择一个角色

3. **上下文组装**（constants/prompts.ts, utils/queryContext.ts, state/AppStateStore.ts）
   - 系统提示词 + 工具 schema + 环境信息 + 工作目录 + git 状态 + 会话记忆 + 输出偏好 + MCP 上下文
   - 模型在一个严格控制的上下文中运行，不是空白画布

4. **核心循环**（query.ts）— 代号 nO
   - 发送请求 → 流式响应 → 检测工具调用 → 执行工具 → 结果回填 → 重复直到完成
   - 单线程、扁平消息历史、无复杂线程
   - 最多允许一个子 Agent 分支，防止不受控的 Agent 增殖

5. **工具编排**（tools.ts, Tool.ts, toolOrchestration.ts）
   - 只读操作可并行执行
   - 变更操作（编辑 + 验证）串行化
   - 43 个工具，每个都是权限门控的

6. **多 Agent 编排**
   - 协调者模式：分解工作为阶段 → 生成工作者 → 并行化任务
   - 工作者不共享对话上下文
   - 通过共享任务 CRUD 协调，不直接调用彼此

7. **异步消息队列 h2A**
   - 支持暂停/恢复
   - 用户可以在任务执行中途注入新指令
   - 实现真正的交互式流式对话

8. **状态和持久化**
   - 跟踪：之前的消息、会话上下文、成本和使用量、后台工作者
   - 支持：恢复会话、长运行任务、远程控制流

9. **分散式限制系统**
   - 成本/计费：maxBudgetUsd
   - Token 使用：从 API 响应提取、聚合
   - 上下文窗口：动态阈值、自动压缩、警告/阻塞状态
   - 轮次限制：maxTurns 停止递归循环
   - API 配额/速率限制
   - Token 续生预算

10. **输出渲染**
    - TUI → Ink/React 渲染
    - --print → 纯文本
    - --output-format=stream-json → 结构化事件

#### Day 3-4：上下文压缩系统深入（对应岗位五级管道）

**Claude Code 的 7 层上下文防御**（从便宜到昂贵）：

```
Layer 1: Tool Result Budget（工具结果预算）
  ├── 每轮聚合预算 + 每工具上限
  ├── 大型工具输出降级为小预览 + 持久化存储
  ├── fresh / frozen / must-reapply 三分区保护缓存稳定性
  └── 缓存优先哲学：稳定性 > 空间效率

Layer 2: Snip Compact（历史修剪）
  ├── 删除旧消息（API 不发送，UI 保留用于回滚）
  └── 必须考虑修剪释放的 token 对计数器的影响

Layer 3: Microcompact（手术式清理）— 代号 wU2
  ├── 缓存 TTL 窗口清理
  ├── 服务端缓存编辑（不重写本地消息）
  └── 不可拆分 tool-use / tool-result 对

Layer 4: Context Collapse（投影摘要）
  ├── CQRS 模式：对话是命令日志（source of truth），API 看到投影视图
  ├── 追加式 collapse 提交日志
  └── UI 保留完整历史，API 看到压缩视图

Layer 5: Auto-Compact（LLM 摘要 + 断路器）
  ├── 结构化摘要：意图、关键概念、文件、错误、任务、用户消息原文
  ├── PTL 重试策略：摘要器自身 prompt-too-long 时丢弃最旧的 API 轮组
  ├── 断路器：反复失败后停止尝试
  └── 约 92% 上下文窗口使用率时自动触发

Layer 6: Blocking（硬阻塞限制）
  └── 阻止生成更多上下文

Layer 7: Reactive Recovery（反应式恢复）
  ├── 413 / prompt-too-long 的最后手段
  ├── 先排空待处理的 collapse 提交
  └── 流式传输期间可恢复错误可被暂扣
```

**与岗位五级管道的映射**：

| 岗位要求 | Claude Code 实现 | 关键设计决策 |
|---------|-----------------|-------------|
| tool-result-budget | Layer 1: Tool Result Budget | 三分区（fresh/frozen/must-reapply）保护缓存 |
| snip | Layer 2: Snip Compact | API 和 UI 分离，修剪不影响用户体验 |
| micro | Layer 3: Microcompact (wU2) | 利用缓存 TTL 窗口做机会性清理 |
| collapse | Layer 4: Context Collapse | CQRS 模式，追加式提交日志 |
| auto | Layer 5: Auto-Compact | 结构化摘要 + 断路器防止失控重试 |

**面试关键洞察**：
- 互斥门控：collapse 启用时可以抑制 auto-summarization，避免两个系统打架
- 缓存稳定性优先：冻结已缓存内容可能浪费空间，但值得
- UI 真相 vs API 真相分离：投影视图让你压缩而不破坏历史

#### Day 5-6：记忆系统深入（对应岗位跨会话记忆）

**Claude Code 的记忆架构：Markdown 文件，不是向量数据库**

```
Memory Directory/
├── ENTRYPOINT.md     ← 索引文件（< 25KB）
├── user-prefs.md     ← 用户偏好（角色、目标、偏好）
├── project-ctx.md    ← 项目状态（进行中的工作、截止日期、决策）
├── feedback-testing.md ← 用户纠正（"不要做 X" / "继续做 Y"）
└── logs/
    └── 2026/03/
        └── 2026-03-31.md  ← 每日日志
```

**四种记忆类型**：

| 类型 | 内容 | 用途 |
|------|------|------|
| user | 角色、目标、偏好 | 根据用户身份定制行为 |
| feedback | "不要做 X" / "继续做 Y" | 规则优先，然后是为什么 + 如何应用 |
| project | 进行中的工作、截止日期、决策 | 始终将相对日期转换为绝对日期 |
| reference | 外部系统指针 — Linear、Grafana、Slack | 跨工具导航 |

**Dream Mode（梦境模式）— 记忆整合**：

当空闲时，Claude Code 进入 4 阶段梦境循环：

```
Phase 1: Orient（定向）
  └── ls 记忆目录，读 ENTRYPOINT.md 索引，浏览现有主题文件避免重复

Phase 2: Gather（收集）
  └── 检查每日日志，找到漂移的记忆，窄范围 grep JSONL 转录

Phase 3: Consolidate（整合）
  └── 合并新内容到现有文件，相对日期→绝对日期，删除矛盾事实

Phase 4: Prune（修剪）
  └── 索引保持 < 25KB，删除过期指针，解决文件间矛盾
```

**关键设计洞察**：
- 没有 RAG，没有向量嵌入，没有 Pinecone — 只是 Markdown 文件 + 索引
- LLM 天生擅长读写文本，瓶颈不是存储，而是维护
- Dream Mode 就是维护循环
- 人类可读 — 你可以手动检查和编辑记忆

**两套记忆系统的区别**（来自官方文档）：

| 系统 | 谁写的 | 范围 | 用途 |
|------|--------|------|------|
| CLAUDE.md | 用户 | 项目/用户/组织 | 稳定规则、架构笔记、工作流、编码标准 |
| Auto Memory | Claude | 每个工作树 | 学到的构建命令、调试模式、偏好、反复纠正 |

#### Day 7：工具系统和权限模型

**43 个工具分类**：

| 类别 | 工具 | 说明 |
|------|------|------|
| Core（核心） | FileRead, FileWrite, FileEdit, Glob, Grep, NotebookEdit | 文件操作 |
| Exec（执行） | Bash, PowerShell, REPL(内部) | 命令执行 |
| Agent（代理） | Agent, TeamCreate, TeamDelete, SendMessage | 多 Agent |
| Task（任务） | TaskCreate, TaskGet, TaskList, TaskUpdate, TaskStop, TaskOutput, TodoWrite | 任务管理 |
| Web（网络） | WebSearch, WebFetch | 网络访问 |
| MCP | MCPTool, McpAuth, ListMcpResources, ReadMcpResource | 协议集成 |
| IDE | LSP | 语言服务 |
| Session | Sleep, ScheduleCron, RemoteTrigger, SendUserMessage(内部) | 会话管理 |
| Nav（导航） | EnterPlanMode, ExitPlanMode, EnterWorktree, ExitWorktree | 模式切换 |
| Config | ConfigTool, SkillTool, ToolSearchTool, DiscoverSkills(内部) | 配置管理 |
| UX | AskUserQuestion, SyntheticOutput, BriefTool(内部), TodoWrite | 用户交互 |

**权限模型 — Actions With Care 框架**：

| 可逆性 × 影响范围 | 处理方式 |
|-------------------|---------|
| 可逆 + 低影响 | 自由执行 |
| 可逆 + 高影响 | 需要确认 |
| 不可逆 + 低影响 | 需要确认 |
| 不可逆 + 高影响 | 始终确认 |

**5 种权限模式**：

| 模式 | 无需询问可做的事 | 适用场景 |
|------|----------------|---------|
| default | 读文件 | 敏感工作、首次使用 |
| acceptEdits | 读和编辑文件 | 迭代编码 |
| plan | 读文件和规划 | 修改前的研究和设计 |
| auto | 所有操作（有后台安全检查） | 长运行任务 |
| bypassPermissions | 所有操作，无检查 | 仅限隔离容器和测试 VM |

---

### 第 3 周：Codex Runtime + 动手实现核心模块

#### Day 1-2：Codex Runtime 快速通读

```bash
git clone https://github.com/openai/codex.git
```

**重点关注**：
- 沙箱执行模型（与岗位"推测执行"相关）
- Agent Loop 设计（对比 Vercel AI SDK 和 Claude Code）
- 相对简单，代码量不大，适合快速通读

#### Day 3-4：实现多级上下文压缩管道

```typescript
// context-compressor.ts — 面试核心 demo

interface CompressorConfig {
  toolResultBudget: number;    // Layer 1: 每工具结果 token 上限
  snipThreshold: number;       // Layer 2: 触发历史修剪的 token 阈值
  microTTL: number;            // Layer 3: 缓存 TTL 窗口（毫秒）
  collapseEnabled: boolean;    // Layer 4: 是否启用投影摘要
  autoCompactThreshold: number; // Layer 5: 触发自动摘要的上下文使用率（如 0.92）
  circuitBreakerMaxRetries: number; // 断路器最大重试次数
}

type MessageState = 'fresh' | 'frozen' | 'must-reapply';

class MultiLevelCompressor {
  private collapseLog: CollapseCommit[] = []; // CQRS 命令日志
  private circuitBreakerFailures = 0;

  async compress(messages: Message[], budget: TokenBudget): Promise<Message[]> {
    let result = messages;

    // Layer 1: Tool Result Budget
    result = this.applyToolResultBudget(result);

    if (budget.usage < this.config.snipThreshold) return result;

    // Layer 2: Snip — 删除旧消息（保留 UI 副本）
    result = this.snipOldMessages(result);

    if (budget.usage < this.config.autoCompactThreshold) return result;

    // Layer 3: Micro — 利用缓存 TTL 窗口清理
    result = this.microCompact(result);

    // Layer 4: Collapse — 投影摘要（如果启用，抑制 Layer 5）
    if (this.config.collapseEnabled) {
      result = this.projectCollapsedView(result);
      return result; // 互斥门控：collapse 启用时跳过 auto
    }

    // Layer 5: Auto-Compact — LLM 摘要 + 断路器
    if (this.circuitBreakerFailures < this.config.circuitBreakerMaxRetries) {
      try {
        result = await this.autoCompact(result);
      } catch (e) {
        this.circuitBreakerFailures++;
        // 断路器触发后本会话不再尝试
      }
    }

    return result;
  }

  private applyToolResultBudget(messages: Message[]): Message[] {
    return messages.map(msg => {
      if (msg.role === 'tool' && this.tokenCount(msg) > this.config.toolResultBudget) {
        // 保留头部预览，完整结果写入磁盘
        return { ...msg, content: this.truncateWithPreview(msg.content) };
      }
      return msg;
    });
  }

  private projectCollapsedView(messages: Message[]): Message[] {
    // CQRS: 对话是 source of truth，API 看到投影视图
    const collapsed = this.collapseLog.reduce(
      (view, commit) => this.applyCollapse(view, commit),
      messages
    );
    return collapsed;
  }
}
```

#### Day 5-6：实现模型 Fallback 和错误恢复

```typescript
// error-recovery.ts — 多级错误恢复

interface FallbackChain {
  models: ModelConfig[];      // 按优先级排序
  maxRetries: number;
  strategies: RecoveryStrategy[];
}

type RecoveryStrategy =
  | { type: 'compress'; level: 1 | 2 | 3 | 4 | 5 }  // 触发压缩
  | { type: 'upgrade-tokens'; multiplier: number }     // 增加 max-output-tokens
  | { type: 'model-fallback' }                         // 切换模型
  | { type: 'retry'; delay: number }                   // 简单重试

async function executeWithRecovery(
  request: AgentRequest,
  chain: FallbackChain
): Promise<AgentResponse> {
  let currentModelIndex = 0;

  for (let attempt = 0; attempt < chain.maxRetries; attempt++) {
    try {
      return await callModel(chain.models[currentModelIndex], request);
    } catch (error) {
      const strategy = classifyError(error);

      switch (strategy.type) {
        case 'compress':
          // prompt-too-long → 触发对应级别的压缩
          request.messages = await compressor.compress(
            request.messages,
            strategy.level
          );
          break;

        case 'upgrade-tokens':
          // max-output-tokens → 增加输出 token 限制
          request.maxTokens = Math.min(
            request.maxTokens * strategy.multiplier,
            getModelMaxTokens(chain.models[currentModelIndex])
          );
          break;

        case 'model-fallback':
          // 模型不可用 → 切换到下一个模型
          currentModelIndex++;
          if (currentModelIndex >= chain.models.length) {
            throw new Error('All models exhausted');
          }
          break;

        case 'retry':
          await sleep(strategy.delay);
          break;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

function classifyError(error: unknown): RecoveryStrategy {
  if (isPromptTooLong(error)) return { type: 'compress', level: 5 };
  if (isMaxOutputTokens(error)) return { type: 'upgrade-tokens', multiplier: 1.5 };
  if (isModelUnavailable(error)) return { type: 'model-fallback' };
  if (isRateLimit(error)) return { type: 'retry', delay: extractRetryAfter(error) };
  throw error; // 未知错误不重试
}
```

#### Day 7：实现推测执行

```typescript
// speculative-execution.ts — overlay 预执行 + 用户确认

interface OverlayLayer {
  pendingChanges: FileChange[];  // 待确认的文件变更
  pendingCommands: Command[];    // 待确认的命令
  snapshot: FileSnapshot;        // 执行前的快照（用于回滚）
}

class SpeculativeExecutor {
  private overlay: OverlayLayer;

  // Agent 预测下一步操作，先在 overlay 层执行
  async speculativeExecute(action: AgentAction): Promise<OverlayResult> {
    // 1. 创建快照
    this.overlay.snapshot = await this.captureSnapshot(action.affectedFiles);

    // 2. 在 overlay 层执行（不影响真实文件系统）
    const result = await this.executeInOverlay(action);

    // 3. 记录待确认的变更
    this.overlay.pendingChanges.push(...result.changes);

    return {
      preview: result.diff,       // 展示给用户的 diff
      confidence: result.score,   // 预测置信度
      rollback: () => this.rollback(), // 回滚函数
    };
  }

  // 用户确认后提交
  async commit(): Promise<void> {
    for (const change of this.overlay.pendingChanges) {
      await this.applyToRealFS(change);
    }
    this.overlay = this.createFreshOverlay();
  }

  // 用户拒绝时回滚
  async rollback(): Promise<void> {
    await this.restoreSnapshot(this.overlay.snapshot);
    this.overlay = this.createFreshOverlay();
  }
}
```

---

### 第 4 周：系统设计整合 + 模拟面试

#### Day 1-2：画出完整系统架构图

将三个 Runtime 的学习成果整合为你自己的 Agent Harness 设计方案：

```
┌─────────────────────────────────────────────────────────────────┐
│                     Agent Harness Architecture                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────────────┐  │
│  │ 入口层    │───▶│ 模式分发      │───▶│ 系统提示词选择         │  │
│  │ CLI/IDE  │    │ interactive/ │    │ default/coordinator/  │  │
│  │ /API     │    │ headless/    │    │ agent-specific        │  │
│  │          │    │ daemon       │    │                       │  │
│  └──────────┘    └──────────────┘    └───────────┬───────────┘  │
│                                                   │              │
│  ┌────────────────────────────────────────────────▼───────────┐  │
│  │              状态机 Agent Loop (核心循环)                    │  │
│  │  ┌─────────────────────────────────────────────────────┐   │  │
│  │  │  Phase Pipeline:                                     │   │  │
│  │  │  plan → act → observe → reflect → (loop/stop)       │   │  │
│  │  │                                                      │   │  │
│  │  │  每个 Phase:                                         │   │  │
│  │  │  - 状态转移条件                                       │   │  │
│  │  │  - 异常处理路径（超时/工具失败/模型拒绝）               │   │  │
│  │  │  - 流式工具并行执行                                    │   │  │
│  │  └─────────────────────────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │ 工具引擎  │  │ 子Agent  │  │ h2A 队列  │  │ 任务管理  │  │  │
│  │  │ 并行/串行 │  │ 上下文隔离│  │ 异步消息  │  │ DAG 依赖  │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              多级上下文压缩管道                              │  │
│  │  L1:ToolBudget → L2:Snip → L3:Micro → L4:Collapse → L5:Auto│  │
│  │  (互斥门控: L4 启用时抑制 L5)                               │  │
│  │  (断路器: L5 反复失败后停止尝试)                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Token Budget  │  │ 错误恢复链    │  │ 推测执行              │  │
│  │ 跨压缩边界    │  │ compress →   │  │ overlay 预执行        │  │
│  │ 预算追踪      │  │ upgrade →    │  │ + 用户确认            │  │
│  │              │  │ fallback     │  │ + 快照回滚            │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              跨会话记忆系统                                  │  │
│  │  Markdown 文件 + 索引（< 25KB）                             │  │
│  │  4 类型: user / feedback / project / reference              │  │
│  │  Dream Mode: orient → gather → consolidate → prune         │  │
│  │  sideQuery: 不污染主上下文的语义检索                         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │              安全和治理层                                    │  │
│  │  权限模式 / Hooks / 沙箱 / 信任验证 / 托管设置              │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### Day 3-4：准备故障场景问答

面试官大概率会问"如果 xxx 挂了怎么办"，准备以下场景：

**场景 1：Agent 运行 4 小时后上下文窗口满了**
```
触发: 上下文使用率 > 92%
恢复链:
  1. Layer 1-3 自动触发（便宜的本地控制）
  2. 如果不够 → Layer 4 Context Collapse（CQRS 投影）
  3. 如果还不够 → Layer 5 Auto-Compact（LLM 摘要）
  4. 如果摘要器自身 PTL → 丢弃最旧轮组重试
  5. 断路器触发 → 停止尝试，通知用户
关键: 每一层都有明确的触发条件和退出条件，不会无限重试
```

**场景 2：主模型 API 返回 500**
```
恢复链:
  1. 指数退避重试（最多 3 次）
  2. 切换到备用模型（Provider 抽象层支持热切换）
  3. 如果所有模型都不可用 → 保存会话状态 → 通知用户
关键: Provider 抽象层让模型切换对上层透明
```

**场景 3：工具执行超时**
```
恢复链:
  1. AbortSignal 超时取消
  2. 将超时信息作为工具结果回填给模型
  3. 模型决定是否重试或换一种方式
关键: 工具失败不应该导致整个 Agent Loop 崩溃
```

**场景 4：prompt-too-long 错误**
```
恢复链:
  1. 立即触发 Layer 5 Auto-Compact
  2. 如果摘要后仍然太长 → 丢弃最旧的 API 轮组
  3. 如果反复失败 → 断路器触发
  4. 最后手段: 只保留系统提示词 + 最近 N 条消息 + 记忆文件
关键: 结构化摘要保留关键信息（意图、文件、错误、任务状态）
```

**场景 5：Token 预算耗尽**
```
恢复链:
  1. maxBudgetUsd 硬停止
  2. 保存当前会话状态和任务进度
  3. 通知用户，提供恢复选项
关键: 预算追踪必须跨压缩边界准确——压缩后重新计算 token 数
```

**场景 6：子 Agent 失控（递归生成子 Agent）**
```
防御:
  1. 深度限制: 子 Agent 不能生成自己的子 Agent
  2. maxTurns 限制递归循环
  3. 最多一个子 Agent 分支（Claude Code 的设计选择）
关键: 防止不受控的 Agent 增殖
```

#### Day 5-6：准备技术栈深度问题

**TypeScript 重点**：
- 异步控制流: async/await、Promise.allSettled（并行工具执行）
- 类型体操: 泛型约束、条件类型（工具类型推导）
- ReadableStream / TransformStream / WritableStream（流式处理）

**Bun 重点**：
- 与 Node.js 的差异: 原生 TS 支持、更快的启动时间
- Bun 的 feature() 宏: 编译时特性开关（Claude Code 用它做内部/外部版本区分）
- 为什么选 Bun 而不是 Node.js（性能、DX）

**流式处理重点**：
- 背压控制（backpressure）
- SSE / WebSocket 传输
- 错误在流中的传播
- 流式输出的取消和中断

**分布式系统重点**：
- 状态机设计模式
- CQRS（命令查询职责分离）— Claude Code 的 Context Collapse 就是这个模式
- 断路器模式（Circuit Breaker）
- 事件溯源（Event Sourcing）

#### Day 7：模拟面试

准备一个 5 分钟的系统设计演讲：

> "我深入研究了三个不同的 Agent Runtime。
>
> Vercel AI SDK 的 streamText 用线性 step 循环，优点是简单可靠，
> 但缺乏状态机的灵活性——没有显式的 Phase 管道，异常状态处理不够细粒度。
>
> Claude Code 是目前最成熟的生产级实现。它的核心是一个单线程主循环（代号 nO），
> 配合异步消息队列（h2A）实现实时转向。上下文压缩用了 7 层防御，
> 从便宜到昂贵逐级触发，关键设计是互斥门控和断路器。
> 记忆系统选择了 Markdown 文件而不是向量数据库，
> 用 Dream Mode 做定期整合——洞察是 LLM 天生擅长读写文本，瓶颈是维护而不是存储。
>
> Codex 的沙箱预执行模型给了我推测执行的灵感。
>
> 基于这些，我的设计方案是：
> 1. 状态机 Agent Loop，显式 Phase 管道，每个 Phase 有明确的进入/退出/异常条件
> 2. 五级压缩管道，借鉴 Claude Code 的分层防御，加入互斥门控和断路器
> 3. Markdown 记忆 + Dream Mode 整合，sideQuery 用嵌入做语义检索但不污染主上下文
> 4. 多级错误恢复链：compress → upgrade-tokens → model-fallback
> 5. 跨压缩边界的 Token Budget 追踪，每次压缩后重新计算
> 6. Overlay 推测执行，类似 Git staging area，用户确认后才提交"

---

## 四、三个 Runtime 横向对比（面试核心素材）

### Agent Loop 对比

| 维度 | Vercel AI SDK | Claude Code | Codex CLI |
|------|--------------|-------------|-----------|
| 循环模型 | 线性 step 循环（maxSteps） | 单线程主循环 nO + 异步队列 h2A | while loop + 沙箱 |
| 状态管理 | 扁平消息数组，只追加 | 扁平消息历史 + 状态存储 | 简单消息列表 |
| 工具并行 | 支持并行 tool call | 只读并行，变更串行 | 串行执行 |
| 子 Agent | 不内置 | 内置，深度限制，最多 1 个分支 | 不内置 |
| 中途转向 | 不支持 | h2A 队列支持用户中途注入指令 | 不支持 |
| 缓存优化 | 无特殊处理 | 扁平历史最大化 prompt caching | 无特殊处理 |

### 上下文管理对比

| 维度 | Vercel AI SDK | Claude Code | Codex CLI |
|------|--------------|-------------|-----------|
| 压缩层级 | 无内置压缩 | 7 层防御（tool-budget → auto-compact） | 基础截断 |
| 缓存策略 | 无 | fresh/frozen/must-reapply 三分区 | 无 |
| CQRS 分离 | 无 | UI 真相 vs API 真相分离 | 无 |
| 断路器 | 无 | Auto-Compact 有断路器 | 无 |

### 记忆系统对比

| 维度 | Vercel AI SDK | Claude Code | Codex CLI |
|------|--------------|-------------|-----------|
| 跨会话记忆 | 无内置 | CLAUDE.md + Auto Memory + Dream Mode | 无 |
| 存储方式 | N/A | Markdown 文件 + 索引 | N/A |
| 记忆整合 | N/A | 4 阶段 Dream Mode | N/A |
| 语义检索 | N/A | sideQuery | N/A |

### 错误恢复对比

| 维度 | Vercel AI SDK | Claude Code | Codex CLI |
|------|--------------|-------------|-----------|
| prompt-too-long | 无内置处理 | 触发压缩 → PTL 重试 → 断路器 | 截断 |
| 模型 fallback | Provider 抽象支持切换 | 内置 fallback 链 | 无 |
| 工具失败 | 返回错误给模型 | 返回错误 + 安全注释 | 返回错误 |
| 流式错误 | 标准错误传播 | 可恢复错误暂扣，恢复失败才上报 | 标准错误 |

---

## 五、Claude Code 隐藏功能（面试加分项/谈资）

泄露源码中发现的有趣功能，展示你对生产级 Agent 的深入了解：

### 1. Buddy System（虚拟宠物）
- 18 个物种、5 个稀有度等级、ASCII 动画精灵
- 每个伙伴有 CompanionBones（物种、眼睛、帽子、闪亮、属性）和 CompanionSoul（名字、性格）
- 物种名用 String.fromCharCode() 编码，因为 "Capybara" 会触发内部模型代号扫描器
- BUDDY 特性标志门控

### 2. Undercover Mode（卧底模式）
- Anthropic 员工在公开仓库使用 Claude Code 时自动进入隐身模式
- 禁止在 commit 消息中包含：内部模型代号、未发布版本号、内部仓库名、"Claude Code" 字样
- 没有强制关闭开关——如果系统不确定是否在内部仓库，卧底模式保持开启
- 证明 Anthropic 日常使用 Claude Code 贡献开源项目

### 3. Dream Mode（梦境模式）
- 空闲时进入 4 阶段记忆整合循环
- 关键洞察：不用向量数据库，用 Markdown + 定期整合
- "你是在执行一个梦——对记忆文件的反思性遍历"

### 4. KAIROS（未发布的主动持久助手）
- 全主动持久助手系统
- 包含 cron 调度、远程触发 API
- 部分功能（BriefTool、SendUserMessage）已在内部版本启用

### 5. 内部 vs 外部版本差异
- 通过 Bun 的 feature() 宏在 AST 级别做死代码消除
- 内部版本：工具调用间 ≤25 词、最终响应 ≤100 词、默认不写注释、3+ 文件编辑强制验证 Agent
- 外部版本：这些限制被编译时剥离

### 6. 系统提示词架构
- 914 行，分 10 个 section
- 静态/动态分界：静态部分（规则、工具、风格）全用户相同 → 全局可缓存
- 动态部分（记忆、环境、MCP）每轮变化
- 利用 Anthropic 的 prompt caching，大部分提示词首次调用后免费

### 7. 内部模型代号
- Capybara、Tengu、Numbat — 动物主题代号
- 未发布版本：claude-opus-4-7、claude-sonnet-4-8
- 代号在特性标志、代码注释、卧底模式禁止词列表中出现

---

## 六、面试策略总结

### 核心叙事框架

```
"我研究了三个 Agent Runtime，提炼出以下设计原则：

1. 简单优先：Claude Code 的核心就是一个 while loop，
   复杂性只在真正需要时才添加（TODO → Tasks → Agent Teams）

2. 分层防御：上下文管理不是一个摘要器，而是从便宜到昂贵的级联防御

3. 缓存即性能：扁平消息历史 + prompt caching = 后续调用只付 10% 成本

4. 治理即架构：权限、Hooks、沙箱不是附加功能，而是核心设计

5. 记忆即维护：瓶颈不是存储（LLM 天生擅长读写文本），而是维护循环"
```

### 面试时的差异化优势

1. **你读过源码**：能说"我看过 Claude Code 的 query.ts，核心循环代号是 nO"
2. **你做过横向对比**：能说"Vercel AI SDK 的 streamText 和 Claude Code 的主循环有三个关键差异"
3. **你有自己的实现**：能展示你写的 mini agent loop、多级压缩器、错误恢复链
4. **你理解生产级问题**：能讲故障场景和恢复策略，不只是 happy path

### 面试可能的追问和回答方向

| 追问 | 回答方向 |
|------|---------|
| "为什么用状态机而不是 while loop？" | 显式 Phase 管道让异常处理更细粒度，每个状态有明确的进入/退出条件 |
| "压缩为什么要分五级？" | 便宜的本地控制优先，避免不必要的 LLM 调用；互斥门控防止系统打架 |
| "记忆为什么不用向量数据库？" | LLM 天生擅长读写文本，Markdown 人类可读可编辑，Dream Mode 解决维护问题 |
| "推测执行怎么保证一致性？" | Overlay 层 + 快照，类似数据库 WAL 或 Git staging area |
| "Token Budget 跨压缩边界怎么追踪？" | 每次压缩后重新计算，预算在 system prompt / 历史 / 工具结果间动态分配 |
| "8 小时不崩怎么保证？" | 分层防御 + 断路器 + 状态持久化 + 会话恢复 |

---

## 七、参考资源汇总

### 源码和仓库
- Vercel AI SDK: https://github.com/vercel/ai
- OpenAI Codex CLI: https://github.com/openai/codex
- OpenClaude (社区 Fork): https://github.com/Gitlawb/openclaude
- Claude Code 源码镜像: https://github.com/yasasbanukaofficial/claude-code

### 架构分析文章
- Claw Decode 完整分析: https://clawdecode.net/
- Claude Code 内部深入: https://www.janypka.com/claude-code-internals-a-quick-deep-dive/
- Agent Loop 幕后: https://blog.promptlayer.com/claude-code-behind-the-scenes-of-the-master-agent-loop/
- 架构分析: https://docs.bswen.com/blog/2026-03-25-claude-code-architecture/
- 上下文管理 7 层防御: https://interviewbrowser.com/blog/claude-code-context-management
- 工具/记忆/Hooks/MCP: https://www.penligent.ai/hackinglabs/inside-claude-code-the-architecture-behind-tools-memory-hooks-and-mcp/
- 安全分析: https://repello.ai/blog/claude-code-security-checklist
- MCP 架构: https://botmonster.com/posts/how-claude-code-uses-mcp-under-the-hood/

### 官方文档
- Claude Agent SDK: https://code.claude.com/docs/en/agent-sdk/agent-loop
- Vercel AI SDK: https://sdk.vercel.ai/docs
- Anthropic 上下文窗口: https://docs.anthropic.com/en/docs/build-with-claude/context-windows

> 内容基于公开可获取的分析文章和官方文档整理，用于学习目的。
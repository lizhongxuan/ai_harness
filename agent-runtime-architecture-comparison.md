# 四大 Agent Runtime 架构深度对比

> Claude Code · Vercel AI SDK · OpenAI Codex · Hermes Agent
>
> 基于源码分析，讲清楚设计原理、设计细节、设计差异

---

## 一、项目定位和设计哲学

| 维度 | Claude Code | Vercel AI SDK | OpenAI Codex | Hermes Agent |
|------|------------|---------------|-------------|-------------|
| 语言 | TypeScript (Bun) | TypeScript (Node) | Rust (codex-rs) + TS (codex-cli) | Python |
| 定位 | 生产级编码 Agent CLI | Agent 开发框架/SDK | 编码 Agent CLI + SDK | 通用 Agent 平台（CLI + 多平台网关） |
| 设计哲学 | "Do the simple thing first" | "开发者体验优先" | "安全优先，沙箱隔离" | "可扩展的技能生态" |
| 开源状态 | 泄露源码（512K 行） | 完全开源 | 完全开源 | 完全开源 |
| 核心用户 | 开发者（终端编码） | 框架使用者（构建 Agent 应用） | 开发者（终端编码） | 开发者 + 非技术用户（多平台） |

### 设计哲学差异

**Claude Code** — 极简主义 + 分层防御。核心是一个 while loop，复杂性只在需要时添加。选择 regex 而不是 embeddings 做搜索，选择 Markdown 而不是数据库做记忆。但在上下文管理和安全治理上极其精细（7 层压缩防御、43 个权限门控工具）。

**Vercel AI SDK** — 框架抽象 + 开发者体验。不做具体的 Agent 产品，而是提供构建 Agent 的积木（streamText、generateText、tool calling）。Provider 抽象层让模型切换透明。把复杂性留给使用者——没有内置压缩、记忆、错误恢复。

**OpenAI Codex** — 安全隔离 + 系统级工程。用 Rust 重写核心（codex-rs），追求性能和安全。沙箱执行模型是核心差异——所有命令在隔离环境中运行。权限系统基于 exec policy，比 Claude Code 的 allow/deny 规则更细粒度。

**Hermes Agent** — 技能生态 + 多平台。不只是编码 Agent，而是通用 Agent 平台。通过 skills 系统扩展能力（50+ 技能目录），通过 gateway 支持多平台（CLI、Telegram、Discord、WhatsApp）。上下文压缩和记忆系统都有，但更偏向"够用就好"。

---

## 二、Agent Loop 核心循环

### Claude Code — 单线程主循环 nO + 异步队列 h2A

```
核心文件: query.ts → queryLoop()

架构:
  用户输入 → 模式分发(cli.tsx) → 上下文组装(queryContext.ts)
  → queryLoop() {
      while (true) {
        response = await callAnthropicAPI(messages)
        if (no tool_calls) → return response.text
        for (toolCall of response.tool_calls) {
          result = await executeTool(toolCall)  // 权限检查在这里
          messages.push(toolResult)
        }
      }
    }
  → 输出渲染(Ink/React 或 纯文本)
```

关键设计：
- **单线程**：一条绝对线性的消息历史，最大化可调试性
- **扁平消息数组，只追加不修改**：最大化 Anthropic prompt caching 命中率
- **h2A 异步队列**：支持用户在执行中途注入指令（暂停/恢复/中断）
- **工具编排**（toolOrchestration.ts）：只读工具可并行，写入工具串行
- **子 Agent 限制**：最多 1 个子 Agent 分支，防止不受控增殖
- **模式分发**：interactive / headless / daemon / remote-control，在任何模型调用前就确定

### Vercel AI SDK — 线性 step 循环 + maxSteps

```
核心文件: generate-text.ts → generateText()

架构:
  generateText({
    model,
    messages,
    tools,
    maxSteps,  // 关键：启用多轮 tool calling
  }) {
    for (step = 0; step < maxSteps; step++) {
      response = await model.doGenerate(messages)
      
      if (response.finishReason === 'stop') break
      if (response.finishReason === 'length') continue  // 截断续写
      
      // tool_calls → 执行工具
      toolResults = await executeTools(response.toolCalls, tools)
      messages.push(assistantMessage, ...toolResultMessages)
      
      // 调用 onStepFinish 回调
      onStepFinish?.(stepResult)
    }
    return result
  }
```

关键设计：
- **maxSteps 是安全阀**：默认 1（不循环），必须显式设置才启用 agent loop
- **Provider 抽象层**（packages/provider/）：统一接口，模型切换透明
- **streamText 和 generateText 共享逻辑**：流式版本用 ReadableStream/TransformStream
- **不内置压缩、记忆、错误恢复**：这些留给使用者实现
- **工具类型安全**：用 Zod schema 做参数校验，TypeScript 泛型推导结果类型
- **中间件系统**：可以在 model 调用前后插入自定义逻辑

### OpenAI Codex — Rust 核心 + 沙箱执行

```
核心文件: codex-rs/core/src/codex_delegate.rs

架构:
  run_codex_thread_interactive() {
    loop {
      // 接收用户输入或 agent 事件
      event = await forward_events()
      
      match event {
        ExecApproval → handle_exec_approval()    // 命令执行审批
        PatchApproval → handle_patch_approval()  // 文件修改审批
        RequestUserInput → handle_request_user_input()
        RequestPermissions → handle_request_permissions()
      }
    }
  }
```

关键设计：
- **Rust 核心**（codex-rs）：性能和内存安全，沙箱用系统级隔离（Linux: landlock/seccomp, macOS: seatbelt）
- **事件驱动**：不是简单的 while loop，而是事件循环 + 消息传递
- **exec policy**：细粒度的命令执行策略（比 Claude Code 的 allow/deny 更精细）
- **沙箱执行**：所有命令在隔离环境中运行，文件系统和网络都受限
- **Agent 注册表**（agent/registry.rs）：支持多 Agent 管理，有深度限制
- **邮箱系统**（agent/mailbox.rs）：Agent 间通过消息传递通信
- **双实现**：codex-cli（TypeScript，旧版）和 codex-rs（Rust，新版），正在迁移

### Hermes Agent — Python while loop + 技能系统

```
核心文件: environments/agent_loop.py → HermesAgentLoop.run()
          run_agent.py → AIAgent.run_conversation()

架构:
  HermesAgentLoop.run(messages) {
    for turn in range(max_turns):
      response = await server.chat_completion(messages, tools)
      
      if no tool_calls:
        return AgentResult(finished_naturally=True)
      
      messages.append(assistant_message_with_tool_calls)
      
      for tc in tool_calls:
        if tc.name not in valid_tool_names:
          result = error("Unknown tool")
        else:
          args = json.loads(tc.arguments)
          result = await handle_function_call(tc.name, args, task_id)
        messages.append(tool_result)
    
    return AgentResult(finished_naturally=False)  // hit max_turns
  }
```

关键设计：
- **双层循环**：HermesAgentLoop（环境级，用于 RL 训练）和 AIAgent（CLI 级，完整功能）
- **线程池工具执行**：工具在 ThreadPoolExecutor 中运行，避免 asyncio 死锁
- **并行工具执行**（run_agent.py）：分析工具调用的安全性，只读工具并行，写入工具串行
- **技能系统**：50+ 技能目录（skills/），每个技能是一组工具 + 提示词
- **多平台网关**（gateway/）：CLI、Telegram、Discord、WhatsApp 统一接入
- **RL 训练支持**：trajectory 保存、压缩、评估，专为强化学习设计
- **Fallback 解析器**：如果 API 不返回结构化 tool_calls，用 hermes 格式解析器从文本中提取

---

## 三、上下文压缩

### Claude Code — 7 层分级防御

```
Layer 1: Tool Result Budget    — 零成本，截断大工具结果
Layer 2: Snip Compact          — 零成本，删除旧消息（UI 保留）
Layer 3: Microcompact (wU2)    — 极低成本，利用缓存 TTL 窗口清理
Layer 4: Context Collapse      — 低成本，CQRS 投影摘要
Layer 5: Auto-Compact          — 高成本，LLM 结构化摘要 + 断路器
Layer 6: Blocking              — 硬阻塞
Layer 7: Reactive Recovery     — 最后手段
```

核心文件：`services/compact/`、`utils/collapseReadSearch.ts`、`utils/collapseBackgroundBashNotifications.ts`

独特设计：
- **三分区缓存**（fresh/frozen/must-reapply）：保护 prompt cache 命中率
- **互斥门控**：Layer 4 启用时抑制 Layer 5
- **断路器**：Auto-Compact 连续失败后停止尝试
- **CQRS 分离**：UI 看完整历史，API 看压缩视图
- **92% 阈值**触发 Auto-Compact

### Vercel AI SDK — 无内置压缩

Vercel AI SDK 不提供任何上下文压缩机制。消息历史由使用者管理。这是有意的设计选择——作为框架，它不应该替使用者做这个决策。

使用者需要自己实现压缩逻辑，或者使用社区方案。

### OpenAI Codex — 基础截断

Codex 的上下文管理相对简单：
- 消息历史有长度限制
- 超出时截断旧消息
- 没有 LLM 摘要机制
- 依赖模型自身的上下文窗口管理

### Hermes Agent — 结构化 LLM 摘要

```
核心文件: agent/context_compressor.py → ContextCompressor

算法:
  1. 工具结果修剪（便宜的预处理，不调用 LLM）
     - 旧的工具结果替换为 "[Old tool output cleared to save context space]"
     - 只修剪 > 200 字符的结果
  
  2. 保护头部消息（system prompt + 首轮对话）
  
  3. Token 预算尾部保护（最近 ~20K tokens）
     - 不是固定消息数，而是按 token 预算动态计算
     - 不拆分 tool_call/tool_result 对
  
  4. 中间轮次 LLM 结构化摘要
     模板: Goal / Constraints / Progress / Key Decisions / Files / Next Steps / Critical Context
  
  5. 迭代更新：后续压缩时更新之前的摘要，而不是从头生成
```

独特设计：
- **结构化摘要模板**：比 Claude Code 的摘要更有结构（Goal/Progress/Decisions/Files/Next Steps）
- **迭代摘要更新**：`_previous_summary` 存储上次摘要，后续压缩时增量更新
- **摘要失败冷却**：失败后 600 秒内不再尝试（类似断路器）
- **tool_call/tool_result 对完整性**：`_sanitize_tool_pairs()` 修复压缩后的孤立对
- **大工具结果持久化**：超过 100K 字符的结果写入临时文件，消息中只保留预览 + 文件路径
- **50% 阈值**触发压缩（比 Claude Code 的 92% 更激进）

### 压缩策略对比

| 维度 | Claude Code | Hermes Agent | Codex | Vercel AI SDK |
|------|------------|-------------|-------|---------------|
| 层级数 | 7 层 | 2 层（修剪 + LLM 摘要） | 1 层（截断） | 无 |
| 触发阈值 | 70%/85%/92% 分级 | 50% 单一阈值 | 固定长度 | N/A |
| LLM 摘要 | 有（Layer 5） | 有（结构化模板） | 无 | N/A |
| 摘要模板 | 意图/概念/文件/错误/任务 | Goal/Progress/Decisions/Files/Next Steps | N/A | N/A |
| 迭代更新 | 未知 | 有（增量更新之前的摘要） | 无 | N/A |
| 断路器 | 有 | 有（600 秒冷却） | 无 | N/A |
| 缓存感知 | 有（三分区） | 有（Anthropic prompt caching） | 无 | N/A |
| 工具结果持久化 | 有（写入磁盘） | 有（写入临时文件） | 无 | N/A |

---

## 四、记忆系统

### Claude Code — Markdown 文件 + Dream Mode

```
核心文件: memdir/、services/SessionMemory/、services/autoDream/、services/extractMemories/

架构:
  Memory Directory/
  ├── ENTRYPOINT.md     ← 索引（< 25KB）
  ├── user-prefs.md     ← 用户偏好
  ├── project-ctx.md    ← 项目状态
  ├── feedback.md       ← 用户纠正
  └── logs/             ← 每日日志

  两套系统:
  - CLAUDE.md（用户写的，稳定规则）
  - Auto Memory（Claude 学的，渐进演化）

  Dream Mode（空闲时整合）:
  Orient → Gather → Consolidate → Prune
```

### Vercel AI SDK — 无内置记忆

无。使用者自己实现。

### OpenAI Codex — AGENTS.md + 配置文件

```
核心文件: codex-rs/instructions/

- AGENTS.md（类似 CLAUDE.md，项目级指令）
- 配置文件（codex-rs/config/）：用户偏好、模型设置
- 没有自动记忆学习机制
- 没有 Dream Mode 类似的整合循环
```

### Hermes Agent — MemoryManager + 插件化记忆

```
核心文件: agent/memory_manager.py、agent/builtin_memory_provider.py、tools/memory_tool.py

架构:
  MemoryManager
  ├── BuiltinMemoryProvider（内置，始终存在）
  │   ├── 文件系统存储（~/.hermes/memory/）
  │   ├── 记忆工具（memory tool）供模型调用
  │   └── prefetch（每轮开始时预取相关记忆）
  └── 最多 1 个外部插件 Provider
      ├── Honcho（对话记忆平台）
      └── 其他自定义 Provider

  记忆注入方式:
  - prefetch_all(query) → 检索相关记忆
  - build_memory_context_block() → 包装在 <memory-context> 标签中
  - 注入到系统消息，不是用户消息
  - 标记为 "[System note: recalled memory context, NOT new user input]"
```

独特设计：
- **插件化**：记忆后端可替换（内置 / Honcho / 自定义）
- **最多 1 个外部 Provider**：防止工具 schema 膨胀和冲突
- **记忆上下文围栏**：`<memory-context>` 标签 + 系统注释，防止模型把记忆当作用户输入
- **生命周期钩子**：on_turn_start / on_session_end / on_pre_compress / on_memory_write / on_delegation
- **压缩前通知**：on_pre_compress 让记忆 Provider 在压缩前保存重要信息

### 记忆系统对比

| 维度 | Claude Code | Hermes Agent | Codex | Vercel AI SDK |
|------|------------|-------------|-------|---------------|
| 存储方式 | Markdown 文件 | 文件系统 + 插件 | 配置文件 | 无 |
| 自动学习 | Auto Memory | 内置 Provider | 无 | 无 |
| 记忆整合 | Dream Mode（4 阶段） | 无自动整合 | 无 | 无 |
| 语义检索 | sideQuery | prefetch（关键词） | 无 | 无 |
| 插件化 | 无 | 有（最多 1 个外部） | 无 | 无 |
| 跨会话 | 有 | 有 | 有限（配置文件） | 无 |

---

## 五、工具系统和权限模型

### Claude Code — 43 个权限门控工具 + Actions With Care

```
核心文件: tools/、Tool.ts、tools.ts、hooks/toolPermission/

工具分类: Core(6) / Exec(3) / Agent(4) / Task(7) / Web(2) / MCP(4) / IDE(1) / Session(4) / Nav(4) / Config(4) / UX(4)

权限模型:
  每次工具调用 → checkPermission(tool, args) → allow | deny | ask
  规则语法: Bash(git diff *), Write(.env*), Read(*)
  优先级: deny > ask > allow（第一条匹配生效）

5 种权限模式: default / acceptEdits / plan / auto / bypassPermissions

auto 模式特殊处理:
  - 独立分类器模型审查每次操作
  - 进入 auto 时主动丢弃宽泛的 allow 规则
  - 保留窄规则（如 Bash(npm test)）

Hooks 系统:
  PreToolUse → 可以 allow/deny/ask/修改参数
  PostToolUse → 审计和日志
  PermissionRequest → 在审批边界拦截
```

### Vercel AI SDK — Zod 类型安全工具

```
核心文件: packages/ai/src/tool/tool.ts

工具定义:
  tool({
    description: '...',
    parameters: z.object({ path: z.string() }),
    execute: async (args) => { ... },
  })

特点:
  - Zod schema 做参数校验
  - TypeScript 泛型推导参数和结果类型
  - 无内置权限系统
  - 无 human-in-the-loop 机制
  - 使用者自己实现权限检查
```

### OpenAI Codex — exec policy + 沙箱

```
核心文件: codex-rs/execpolicy/、codex-rs/sandboxing/

exec policy:
  - 比 allow/deny 更细粒度
  - 基于命令模式匹配
  - 支持 always-allow / ask / deny
  - 沙箱级别: sandbox-strict / sandbox-permissive / no-sandbox

沙箱实现:
  - Linux: landlock + seccomp（内核级隔离）
  - macOS: seatbelt（App Sandbox）
  - 文件系统限制: 只能访问指定目录
  - 网络限制: 可配置允许的域名
  - 子进程继承沙箱约束

审批流程:
  handle_exec_approval() → 用户确认命令执行
  handle_patch_approval() → 用户确认文件修改
```

### Hermes Agent — 技能系统 + 工具注册表

```
核心文件: tools/registry.py、toolsets.py、skills/

工具注册:
  - 通过 toolsets 分组（terminal, file, web, browser, memory, ...）
  - 可以启用/禁用整个 toolset
  - 技能（skills）可以动态注册新工具

技能系统:
  skills/
  ├── software-development/  ← 编码相关
  ├── research/              ← 网络研究
  ├── creative/              ← 创意写作
  ├── devops/                ← 运维
  ├── data-science/          ← 数据科学
  └── 50+ 更多...

权限:
  - tools/approval.py: 工具执行前的审批
  - tools/skills_guard.py: 技能安全检查
  - 比 Claude Code 简单，没有 Actions With Care 框架
  
并行执行:
  _should_parallelize_tool_batch(): 分析工具调用安全性
  _PARALLEL_SAFE_TOOLS: 只读工具白名单
  _PATH_SCOPED_TOOLS: 文件工具按路径隔离
  _is_destructive_command(): 检测破坏性命令
```

---

## 六、错误恢复

| 维度 | Claude Code | Vercel AI SDK | Codex | Hermes Agent |
|------|------------|---------------|-------|-------------|
| prompt-too-long | 7 层压缩防御 | 无内置处理 | 截断 | 触发 ContextCompressor |
| max-output-tokens | 暂扣错误，尝试恢复 | finishReason='length' 续写 | 截断 | 无特殊处理 |
| 模型不可用 | 内置 fallback | Provider 抽象支持切换 | 无 | fallback_model 配置 |
| 速率限制 | 重试 + 限制追踪 | 无内置处理 | 重试 | 重试 |
| 工具失败 | 错误回填 + 安全注释 | 错误回填给模型 | 错误回填 | 错误回填（JSON 格式） |
| 流式错误 | 可恢复错误暂扣 | 标准错误传播 | 标准错误 | 无流式支持（批量） |
| 断路器 | Auto-Compact 有 | 无 | 无 | 摘要失败冷却 600 秒 |
| JSON 解析失败 | 重试 | 无 | 无 | 错误回填，继续循环 |

---

## 七、独特功能对比

### 只有 Claude Code 有的

- **Dream Mode**：空闲时自动整合记忆
- **h2A 异步队列**：用户中途注入指令
- **7 层上下文防御**：从零成本到 LLM 摘要的完整级联
- **CQRS 投影摘要**：UI 和 API 看到不同视图
- **三分区缓存**：保护 prompt cache 命中率
- **Buddy System**：虚拟宠物（未发布）
- **Undercover Mode**：公开仓库隐身模式
- **KAIROS**：主动持久助手（未发布）
- **914 行系统提示词**：静态/动态分界，全局可缓存

### 只有 Codex 有的

- **Rust 核心**：性能和内存安全
- **系统级沙箱**：landlock/seccomp/seatbelt
- **exec policy**：细粒度命令执行策略
- **Agent 邮箱系统**：Agent 间消息传递
- **WebRTC 支持**：实时通信（codex-rs/realtime-webrtc/）
- **V8 PoC**：JavaScript REPL 沙箱（codex-rs/v8-poc/）

### 只有 Vercel AI SDK 有的

- **Provider 抽象层**：最完善的模型切换机制
- **中间件系统**：model 调用前后插入自定义逻辑
- **类型安全工具**：Zod + TypeScript 泛型
- **UI 框架集成**：useChat / useCompletion React hooks
- **多模态支持**：图片、文件、音频的统一处理

### 只有 Hermes Agent 有的

- **技能生态**：50+ 技能目录，动态加载
- **多平台网关**：CLI / Telegram / Discord / WhatsApp / Web
- **RL 训练支持**：trajectory 保存/压缩/评估
- **插件化记忆**：可替换的记忆后端
- **迭代摘要更新**：压缩时增量更新之前的摘要
- **记忆上下文围栏**：`<memory-context>` 标签防止注入
- **Credential Pool**：多 API key 轮换
- **Smart Model Routing**：根据任务自动选择模型
- **Skin Engine**：CLI 主题/皮肤系统

---

## 八、面试叙事：如果让你设计第五个

> "我研究了四个 Agent Runtime，每个都有独特的设计洞察：
>
> **从 Claude Code 学到**：简单优先 + 分层防御。核心用 while loop，复杂性在边界控制上。7 层压缩防御是最成熟的上下文管理方案。Markdown 记忆 + Dream Mode 证明了'记忆即维护'。
>
> **从 Vercel AI SDK 学到**：Provider 抽象层是模型 fallback 的基础。类型安全的工具系统减少运行时错误。框架不应该替使用者做所有决策。
>
> **从 Codex 学到**：系统级沙箱是推测执行的基础。Rust 的性能和安全性在长运行 Agent 中很重要。exec policy 比简单的 allow/deny 更精细。
>
> **从 Hermes Agent 学到**：技能系统让 Agent 能力可扩展。插件化记忆让存储后端可替换。结构化摘要模板（Goal/Progress/Decisions）比自由格式摘要更可靠。迭代摘要更新避免了信息丢失。
>
> 我的第五个设计会取各家之长：Claude Code 的分层压缩 + Codex 的沙箱执行 + Vercel 的 Provider 抽象 + Hermes 的技能生态和结构化摘要。"
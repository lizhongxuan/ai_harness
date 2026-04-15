# 学习路线

> 5 个阶段，从入门到精通 Hermes Agent 架构

## 阶段总览

```mermaid
flowchart LR
    P1[阶段 1<br/>核心循环] --> P2[阶段 2<br/>工具与技能]
    P2 --> P3[阶段 3<br/>上下文与记忆]
    P3 --> P4[阶段 4<br/>网关与平台]
    P4 --> P5[阶段 5<br/>RL 训练]

    style P1 fill:#22543d,color:#fff
    style P2 fill:#1a365d,color:#fff
    style P3 fill:#744210,color:#fff
    style P4 fill:#2d3748,color:#fff
    style P5 fill:#742a2a,color:#fff
```

## 阶段 1: 核心循环（2-3 天）

**目标**：理解 Agent 的核心执行模型

| 序号 | 主题 | 文档 | 关键源码 |
|------|------|------|---------|
| 1 | 双 Agent 循环 | [dual-loop](/agent/dual-loop) | `run_agent.py`, `environments/agent_loop.py` |
| 2 | 并行工具执行 | [parallel-tools](/agent/parallel-tools) | `run_agent.py` |
| 3 | 迭代预算 | [iteration-budget](/agent/iteration-budget) | `run_agent.py` IterationBudget |
| 4 | 子 Agent 委托 | [subagent](/agent/subagent) | `tools/delegate_tool.py` |

**练习**：
- 阅读 `HermesAgentLoop.run()` 的完整实现，画出状态转换图
- 对比 `_should_parallelize_tool_batch()` 和 Claude Code 的批次分区逻辑

## 阶段 2: 工具与技能（2-3 天）

**目标**：理解工具注册、分发、技能生态

| 序号 | 主题 | 文档 | 关键源码 |
|------|------|------|---------|
| 5 | 工具注册表 | [registry](/tools/registry) | `tools/registry.py` |
| 6 | 工具类型 | [tool-types](/tools/tool-types) | `tools/` 目录 |
| 7 | 工具审批 | [approval](/tools/approval) | `tools/approval.py` |
| 8 | 技能系统 | [skill-system](/skills/skill-system) | `agent/prompt_builder.py` |
| 9 | Toolset 系统 | [toolsets](/skills/toolsets) | `toolsets.py` |

**练习**：
- 实现一个自定义工具，通过自注册模式加入 ToolRegistry
- 创建一个 SKILL.md，使用条件激活（requires_tools）

## 阶段 3: 上下文与记忆（2-3 天）

**目标**：理解上下文管理和记忆系统

| 序号 | 主题 | 文档 | 关键源码 |
|------|------|------|---------|
| 10 | 上下文压缩器 | [compressor](/context/compressor) | `agent/context_compressor.py` |
| 11 | 轨迹压缩器 | [trajectory-compressor](/context/trajectory-compressor) | `trajectory_compressor.py` |
| 12 | 记忆管理器 | [manager](/memory/manager) | `agent/memory_manager.py` |
| 13 | 内置记忆 Provider | [builtin-provider](/memory/builtin-provider) | `agent/builtin_memory_provider.py` |

**练习**：
- 对比 ContextCompressor 的 50% 阈值和 Claude Code 的 92% 阈值，分析各自的 trade-off
- 实现一个简单的外部 MemoryProvider 插件

## 阶段 4: 网关与平台（1-2 天）

**目标**：理解多平台统一接入

| 序号 | 主题 | 文档 | 关键源码 |
|------|------|------|---------|
| 14 | 网关架构 | [architecture](/gateway/architecture) | `gateway/` |
| 15 | 平台适配器 | [platforms](/gateway/platforms) | `gateway/platforms/` |
| 16 | 网关 Hook | [hooks](/gateway/hooks) | `gateway/hooks.py` |

**练习**：
- 分析 `PLATFORM_HINTS` 如何影响模型行为
- 设计一个新平台适配器的接口

## 阶段 5: RL 训练与 API（1-2 天）

**目标**：理解 RL 集成和 Provider 管理

| 序号 | 主题 | 文档 | 关键源码 |
|------|------|------|---------|
| 17 | 多 Provider 支持 | [multi-provider](/api/multi-provider) | `agent/auxiliary_client.py` |
| 18 | 智能模型路由 | [smart-routing](/api/smart-routing) | `agent/smart_model_routing.py` |
| 19 | RL Agent 循环 | [agent-loop](/rl/agent-loop) | `environments/agent_loop.py` |
| 20 | 轨迹管理 | [trajectory](/rl/trajectory) | `agent/trajectory.py` |
| 21 | CLI 架构 | [architecture](/cli/architecture) | `hermes_cli/` |

**练习**：
- 分析 `choose_cheap_model_route()` 的启发式规则，设计改进方案
- 使用 TrajectoryCompressor 压缩一批轨迹，分析压缩指标

## 与 Claude Code / Codex / Vercel AI SDK 学习路径的对比

| 阶段 | Hermes Agent | Claude Code | Codex CLI | Vercel AI SDK |
|------|-------------|-------------|-----------|---------------|
| 核心循环 | 双循环 + 并行 | ReAct 7 阶段 | 事件驱动 | streamText |
| 工具系统 | 自注册 + Toolset | buildTool + 权限 | Shell + Patch | Tool 定义 |
| 上下文 | 50% 压缩 + 迭代摘要 | 五层防爆 | 自动压缩 | maxSteps |
| 安全 | 轻量审批 | 三级权限 | Starlark 策略 | 无 |
| 特色 | 多平台网关 + RL | 提示词工程 | 沙箱安全 | Provider 抽象 |

## 面试重点领域

### Agent 架构
- 双循环设计的 trade-off
- 并行工具执行的安全性分析
- 迭代预算的线程安全实现

### 上下文管理
- 50% vs 92% 压缩阈值的 trade-off
- 迭代摘要更新的信息保留策略
- tool_call/tool_result 对完整性维护

### 工具系统
- 自注册模式 vs 声明式注册
- 类型强转的必要性和实现
- check_fn 动态可用性检查

### 多平台
- 平台无关核心工具的设计
- MEDIA: 协议的抽象层次
- 平台提示 vs 平台代码的 trade-off

### RL 训练
- 轻量循环 vs 全功能循环的分离原因
- 轨迹压缩的保护区域策略
- AgentResult 的训练信号设计

## 推荐阅读顺序

1. [快速开始](/guide/getting-started) — 全局视角
2. [双 Agent 循环](/agent/dual-loop) — 核心架构
3. [上下文压缩器](/context/compressor) — 关键算法
4. [工具注册表](/tools/registry) — 工具系统核心
5. [技能系统](/skills/skill-system) — 差异化能力
6. [网关架构](/gateway/architecture) — 多平台核心
7. [设计模式速查](/appendix/patterns) — 模式总结

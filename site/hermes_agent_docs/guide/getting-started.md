# 快速开始

> Hermes Agent 开源源码学习指南

## 项目背景

Hermes Agent 是 Nous Research 开源的通用 AI Agent 平台，用 Python 实现。核心差异化在于：多平台网关（15+ 平台）、技能生态（50+ 技能目录）、RL 训练支持（轨迹保存/压缩 + Atropos 集成）。

## 项目统计

| 指标 | 数值 |
|------|------|
| 语言 | Python |
| 技能目录 | 50+ |
| 支持平台 | 15+（CLI、Telegram、Discord、WhatsApp、Slack、Signal、Email、SMS、Matrix、DingTalk、Feishu、WeCom 等） |
| 工具数量 | 30+（分布在 10+ toolset 中） |
| 许可证 | Apache-2.0 |

## 架构总览

```
hermes-agent（仓库根目录）
├── run_agent.py              ← AIAgent 主循环（CLI / 网关入口）
├── environments/
│   └── agent_loop.py         ← HermesAgentLoop（RL 训练用轻量循环）
├── gateway/                  ← 多平台网关
│   ├── platforms/            ← 各平台适配器
│   ├── session.py            ← 会话管理
│   ├── delivery.py           ← 消息投递路由
│   ├── hooks.py              ← Hook 注册表
│   └── stream_consumer.py    ← 流式消费
├── agent/                    ← Agent 内部模块
│   ├── context_compressor.py ← 上下文压缩器
│   ├── memory_manager.py     ← 记忆管理器
│   ├── prompt_builder.py     ← 系统提示词组装
│   ├── smart_model_routing.py← 智能模型路由
│   ├── prompt_caching.py     ← Anthropic 提示缓存
│   └── trajectory.py         ← 轨迹保存
├── tools/                    ← 工具实现（自注册模式）
│   ├── registry.py           ← ToolRegistry 单例
│   ├── terminal_tool.py      ← 终端工具
│   ├── file_tools.py         ← 文件工具
│   ├── browser_tool.py       ← 浏览器工具
│   ├── delegate_tool.py      ← 子 Agent 委托
│   └── ...
├── skills/                   ← 50+ 技能目录
├── toolsets.py               ← Toolset 定义与解析
├── model_tools.py            ← 工具发现与分发
├── trajectory_compressor.py  ← 轨迹压缩器（RL 后处理）
└── hermes_cli/               ← CLI 界面
    ├── cli.py                ← curses UI
    └── providers.py          ← Provider 解析
```

## 与 Claude Code / Codex / Vercel AI SDK 的关键差异

| 维度 | Hermes Agent | Claude Code | Codex CLI | Vercel AI SDK |
|------|-------------|-------------|-----------|---------------|
| 语言 | Python | TypeScript (Bun) | Rust + TS | TypeScript |
| Agent Loop | 双循环（AIAgent + HermesAgentLoop） | while(true) ReAct | 事件驱动 | streamText 循环 |
| 平台 | 15+ 平台网关 | CLI only | CLI only | 框架集成 |
| 技能系统 | 50+ SKILL.md 目录 | — | — | — |
| RL 训练 | 轨迹保存 + Atropos | — | — | — |
| 上下文压缩 | 50% 阈值 + 结构化摘要 | 92% 阈值 + 五层防爆 | 自动压缩 + 截断 | maxSteps 控制 |
| 记忆 | MemoryManager + Provider 插件 | CLAUDE.md + Auto Memory | AGENTS.md + 配置 | 无内置 |
| 工具并行 | 读写分离 + 路径重叠检测 | 读写分区批次 | 串行 | 并行 tool calls |
| 模型路由 | 关键词启发式（cheap/strong） | 单模型 | 单模型 | 多 Provider |
| 沙箱 | Docker/Modal/Daytona 后端 | OS 级 Seatbelt/Bubblewrap | OS 级 Landlock/Seatbelt | 无 |

## 核心术语速查

| 术语 | 含义 |
|------|------|
| AIAgent | `run_agent.py` 中的全功能 Agent 类，用于 CLI 和网关 |
| HermesAgentLoop | `environments/agent_loop.py` 中的轻量循环，用于 RL 训练 |
| ToolRegistry | 工具注册表单例，所有工具通过自注册模式加入 |
| MemoryManager | 记忆管理器，编排内置 + 最多 1 个外部 Provider |
| ContextCompressor | 上下文压缩器，50% 阈值触发结构化 LLM 摘要 |
| Gateway | 多平台网关，统一消息路由和会话管理 |
| Skills | SKILL.md 格式的技能文档，50+ 目录，条件激活 |
| Toolsets | 工具集合定义，支持组合和循环检测 |
| IterationBudget | 线程安全的迭代计数器，父 90 / 子 50 |
| TrajectoryCompressor | RL 训练后处理，压缩轨迹到目标 token 预算 |

## 推荐阅读顺序

1. [双 Agent 循环](/hermes_agent_docs/agent/dual-loop) — 理解核心 Agent Loop 双轨设计
2. [并行工具执行](/hermes_agent_docs/agent/parallel-tools) — 理解读写分离的并行策略
3. [上下文压缩器](/hermes_agent_docs/context/compressor) — 理解 50% 阈值 + 结构化摘要
4. [技能系统](/hermes_agent_docs/skills/skill-system) — 理解 SKILL.md 生态
5. [网关架构](/hermes_agent_docs/gateway/architecture) — 理解多平台统一接入
6. [工具注册表](/hermes_agent_docs/tools/registry) — 理解自注册模式
7. [记忆管理器](/hermes_agent_docs/memory/manager) — 理解 Provider 插件架构
8. [RL Agent 循环](/hermes_agent_docs/rl/agent-loop) — 理解训练环境集成

# 快速开始

> Vercel AI SDK 开源源码学习指南

## 项目背景

Vercel AI SDK 是目前最流行的 AI 应用开发框架，不是一个 Agent 产品（如 Claude Code、Codex），而是构建 Agent 的**积木**。它提供 Provider 抽象、流式处理、工具系统、UI 集成等基础设施，让开发者专注于业务逻辑。

## 项目统计

| 指标 | 数值 |
|------|------|
| 语言 | TypeScript |
| 核心包 | packages/ai/（~200 源文件） |
| Provider 包 | 50+（OpenAI、Anthropic、Google、Mistral...） |
| UI 框架支持 | React、Vue、Svelte、Angular、Solid |
| 构建系统 | Turborepo + tsup |
| 包管理 | pnpm workspace |
| 许可证 | Apache-2.0 |

## 架构总览

```
ai/（仓库根目录）
├── packages/
│   ├── ai/                    ← 核心包（主要学习目标）
│   │   └── src/
│   │       ├── generate-text/  ← generateText / streamText（Agent Loop）
│   │       ├── generate-object/ ← 结构化输出
│   │       ├── agent/          ← ToolLoopAgent
│   │       ├── middleware/     ← 中间件系统
│   │       ├── registry/      ← Provider Registry
│   │       ├── prompt/        ← 提示词处理
│   │       ├── ui/            ← useChat / useCompletion
│   │       ├── ui-message-stream/ ← UIMessageStream
│   │       ├── text-stream/   ← 文本流处理
│   │       ├── types/         ← 类型定义
│   │       ├── error/         ← 错误类型
│   │       ├── telemetry/     ← OpenTelemetry
│   │       ├── model/         ← 模型版本适配
│   │       └── util/          ← 工具函数
│   ├── provider/              ← Provider 接口定义
│   ├── provider-utils/        ← Provider 工具函数
│   ├── openai/                ← OpenAI Provider
│   ├── anthropic/             ← Anthropic Provider
│   ├── google/                ← Google Provider
│   ├── react/                 ← React hooks
│   ├── vue/                   ← Vue composables
│   ├── svelte/                ← Svelte stores
│   ├── mcp/                   ← MCP 协议
│   └── ...（50+ providers）
```

## 与 Claude Code / Codex 的定位差异

| 维度 | Vercel AI SDK | Claude Code | Codex |
|------|--------------|-------------|-------|
| 定位 | 框架/SDK | Agent 产品 | Agent 产品 |
| 用户 | 开发者（构建 AI 应用） | 开发者（终端编码） | 开发者（终端编码） |
| Agent Loop | 提供积木（generateText） | 完整实现（queryLoop） | 完整实现（事件循环） |
| 上下文压缩 | 不提供 | 7 层防御 | 自动压缩 |
| 记忆系统 | 不提供 | CLAUDE.md + Dream Mode | AGENTS.md |
| 沙箱 | 不提供 | Seatbelt/Bubblewrap | Landlock/Seatbelt |
| Provider 抽象 | 最完善（50+ providers） | 单一（Anthropic） | 多个（OpenAI 为主） |
| UI 集成 | 最完善（5 框架） | Ink（终端） | Ratatui（终端） |

## 核心术语速查

| 术语 | 含义 |
|------|------|
| generateText | 阻塞式 Agent Loop，等待完成后返回 |
| streamText | 流式 Agent Loop，逐 token 输出 |
| maxSteps | Agent Loop 的最大迭代次数（安全阀） |
| Provider | 模型提供商的适配器（OpenAI、Anthropic 等） |
| LanguageModel | 统一的模型接口（所有 Provider 实现这个接口） |
| ToolSet | 工具集合，用 Zod schema 定义参数 |
| Middleware | 中间件，在模型调用前后插入自定义逻辑 |
| UIMessageStream | 前端消息流协议 |
| smoothStream | 流式输出平滑化（避免一次性输出大块文本） |
| StepResult | 每一步的结果（包含文本、工具调用、usage） |

## 推荐阅读顺序

1. [generateText 循环](/agent/generate-text-loop) — 理解核心 Agent Loop
2. [LanguageModel 接口](/provider/language-model-interface) — 理解 Provider 抽象
3. [类型安全工具](/tools/type-safe-tools) — 理解工具系统
4. [Web Streams 基础](/streaming/web-streams) — 理解流式处理
5. [wrapLanguageModel](/middleware/wrap-model) — 理解中间件
6. [useChat](/ui/use-chat) — 理解 UI 集成

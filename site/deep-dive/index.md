---
title: 项目深度剖析
---

# 四大项目深度剖析

> 基于源码的逐模块拆解，理解每个 Agent Runtime 的设计原理和实现细节。

## 选择一个项目开始

| 项目 | 语言 | 定位 | 设计哲学 | 进入 |
|------|------|------|---------|------|
| **Claude Code** | TypeScript (Bun) | 生产级编码 Agent CLI | 简单优先 + 分层防御 | [查看剖析](/deep-dive/claude-code) |
| **Codex CLI** | Rust + TypeScript | 编码 Agent CLI + SDK | 安全优先，沙箱隔离 | [查看剖析](/deep-dive/codex) |
| **Vercel AI SDK** | TypeScript (Node) | Agent 开发框架/SDK | 开发者体验优先 | [查看剖析](/deep-dive/vercel-ai-sdk) |
| **Hermes Agent** | Python | 通用 Agent 平台 | 可扩展的技能生态 | [查看剖析](/deep-dive/hermes-agent) |

## 各项目核心亮点

### 🟠 Claude Code — 生产级编码 Agent 的标杆

- 512K 行 TypeScript 源码，基于 Bun 运行时
- while(true) 主循环 + h2A 异步队列
- 7 层上下文压缩防御体系
- Dream Mode 记忆整合 + Markdown 记忆系统
- 43 个权限门控工具 + Actions With Care 安全框架

→ [进入 Claude Code 剖析](/deep-dive/claude-code) · [项目文档站](/claude_code_docs/)

### 🟢 Codex CLI — 安全隔离的极致实践

- Rust 核心（codex-rs）+ TypeScript CLI
- 事件驱动循环 + 沙箱执行模型
- 三层沙箱：exec policy + OS 级隔离 + 网络代理
- Landlock (Linux) / Seatbelt (macOS) 系统级安全
- Starlark 可编程策略引擎

→ [进入 Codex CLI 剖析](/deep-dive/codex) · [项目文档站](/codex_docs/)

### 🔵 Vercel AI SDK — 框架级抽象的典范

- TypeScript 框架，50+ Provider 适配
- generateText / streamText 统一 API
- Provider 抽象层让模型切换透明
- Zod + TypeScript 泛型的类型安全工具系统
- 中间件系统支持自定义拦截逻辑

→ [进入 Vercel AI SDK 剖析](/deep-dive/vercel-ai-sdk) · [项目文档站](/vercel_ai_docs/)

### 🟣 Hermes Agent — 可扩展的通用平台

- Python 实现，面向多场景
- 双层循环：HermesAgentLoop + AIAgent
- 50+ 技能目录，动态加载
- 多平台网关：CLI / Telegram / Discord / WhatsApp
- RL 训练支持：轨迹保存与压缩

→ [进入 Hermes Agent 剖析](/deep-dive/hermes-agent) · [项目文档站](/hermes_agent_docs/)

---

## 相关资源

- [← 返回全局概览](/overview/) — 先看四大项目的主循环对比
- [核心模块](/modules/agent-loop) — 按模块维度对比四大项目
- [实战定制指南](/customization/) — 如何根据业务场景改造

# 快速开始

> Codex CLI 开源源码学习指南

## 项目背景

Codex CLI 是 OpenAI 的开源编码 Agent，运行在本地终端。核心用 Rust 实现（codex-rs），追求性能和安全。正在从旧版 TypeScript CLI（codex-cli）迁移到 Rust 核心。

## 项目统计

| 指标 | 数值 |
|------|------|
| 语言 | Rust（核心）+ TypeScript（旧 CLI）+ Go（沙箱） |
| Rust crate 数量 | 60+ |
| 核心 crate（codex-core） | ~100 源文件 |
| 构建系统 | Cargo + Bazel |
| 沙箱实现 | 3 平台（macOS/Linux/Windows） |
| 许可证 | Apache-2.0 |

## 架构总览

```
codex（仓库根目录）
├── codex-rs/              ← Rust 核心（主要学习目标）
│   ├── core/              ← 核心引擎（Agent Loop、沙箱、策略）
│   ├── cli/               ← Rust CLI 入口
│   ├── tui/               ← 终端 UI（Ratatui）
│   ├── exec/              ← 非交互式执行
│   ├── sandboxing/        ← 沙箱抽象层
│   ├── linux-sandbox/     ← Linux 沙箱（Landlock + Bubblewrap）
│   ├── execpolicy/        ← 执行策略引擎（Starlark）
│   ├── protocol/          ← 协议定义
│   ├── config/            ← 配置系统
│   ├── hooks/             ← Hook 系统
│   ├── tools/             ← 工具实现
│   ├── codex-mcp/         ← MCP 协议集成
│   ├── network-proxy/     ← 网络代理隔离
│   ├── process-hardening/ ← 进程加固
│   ├── state/             ← 状态管理
│   ├── app-server/        ← IDE 集成服务
│   └── ...（60+ crates）
├── codex-cli/             ← 旧版 TypeScript CLI（正在迁移）
├── go_sandbox/            ← Go 沙箱管理器
├── sdk/                   ← Python/TypeScript SDK
└── docs/                  ← 文档
```

## 与 Claude Code 的关键差异

| 维度 | Codex | Claude Code |
|------|-------|------------|
| 语言 | Rust | TypeScript (Bun) |
| Agent Loop | 事件驱动 | while(true) |
| 沙箱 | OS 级（Landlock/Seatbelt） | OS 级（Seatbelt/Bubblewrap） |
| 策略引擎 | Starlark（可编程） | allow/deny 规则（声明式） |
| API | Responses API（OpenAI 原生） | Messages API（Anthropic） |
| 上下文压缩 | 基础（自动压缩 + 截断） | 7 层防御体系 |
| 记忆 | AGENTS.md + 配置文件 | CLAUDE.md + Auto Memory + Dream Mode |
| 多 Agent | 注册表 + 邮箱系统 | 子 Agent + Agent Teams |

## 核心术语速查

| 术语 | 含义 |
|------|------|
| codex-rs | Rust 核心引擎，所有新功能在这里开发 |
| codex-cli | 旧版 TypeScript CLI，正在迁移到 codex-rs |
| Exec Policy | 执行策略，用 Starlark 语言定义命令的审批规则 |
| Seatbelt | macOS 的 App Sandbox 机制 |
| Landlock | Linux 5.13+ 的文件系统隔离机制 |
| Bubblewrap | Linux 用户空间沙箱工具 |
| Responses API | OpenAI 的新 API 格式（替代 Chat Completions） |
| AGENTS.md | 项目级指令文件（类似 Claude Code 的 CLAUDE.md） |
| TUI | Terminal User Interface，终端图形界面 |
| Ratatui | Rust 的终端 UI 框架 |
| MCP | Model Context Protocol，连接外部工具的标准协议 |
| Guardian | 安全审查模块，审查 Agent 的操作 |

## 推荐阅读顺序

1. [事件驱动循环](/agent/event-loop) — 理解核心 Agent Loop
2. [沙箱架构总览](/sandbox/architecture) — 理解安全模型（Codex 的核心差异化）
3. [策略引擎](/execpolicy/policy-engine) — 理解命令审批
4. [Shell 工具](/tools/shell-tool) — 理解工具执行
5. [自动压缩](/context/auto-compact) — 理解上下文管理

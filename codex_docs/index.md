---
layout: home
hero:
  name: Codex CLI 源码学习
  text: 20+ 核心知识点深度解析
  tagline: 基于开源 codex-rs（Rust 核心）+ codex-cli（TypeScript）源码的完整分析，覆盖 Agent 架构、沙箱安全、执行策略、上下文管理
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 学习路线
      link: /appendix/roadmap

features:
  - icon: 🔄
    title: Agent 架构
    details: 事件驱动循环、Responses API 集成、多 Agent 注册表、邮箱通信
    link: /agent/event-loop
  - icon: 🔒
    title: 沙箱安全
    details: Seatbelt/Landlock/Bubblewrap 三平台沙箱、网络代理隔离、进程加固
    link: /sandbox/architecture
  - icon: ⚖️
    title: 执行策略
    details: Starlark 策略语言、命令审批流程、权限升级机制
    link: /execpolicy/policy-engine
  - icon: 🏰
    title: 上下文管理
    details: 自动压缩、消息历史截断、Token 估算
    link: /context/auto-compact
  - icon: 🔧
    title: 工具系统
    details: Shell/Apply-Patch 双工具、MCP 集成、工具审批
    link: /tools/shell-tool
  - icon: 🖥️
    title: 终端 UI
    details: Ratatui TUI 框架、流式渲染、快照测试
    link: /ui/tui-architecture
  - icon: 💾
    title: 数据与状态
    details: 会话持久化、AGENTS.md 发现、配置层叠
    link: /data/session
  - icon: 🌐
    title: API 交互
    details: Responses API、Chat Completions 适配、MCP 协议
    link: /api/responses-api
  - icon: 🤖
    title: 多 Agent
    details: Agent 注册表、邮箱系统、深度限制、角色系统
    link: /agent/multi-agent
  - icon: 📐
    title: 设计模式
    details: 12+ 种可复用的架构模式速查
    link: /appendix/patterns
---

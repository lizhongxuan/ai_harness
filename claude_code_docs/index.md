---
layout: home
hero:
  name: Claude Code 源码学习
  text: 24 个核心知识点深度解析
  tagline: 基于 v2.1.88 源码（4756 个文件）的完整分析，覆盖 Agent 架构、上下文管理、工具系统、提示词工程
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
    details: ReAct 循环、多级错误恢复、子 Agent 委托、Hook 系统
    link: /agent/react-loop
  - icon: 🏰
    title: 上下文管理
    details: 五层防爆体系、工具结果预算、压缩意图保持、Prompt Cache
    link: /context/five-layers
  - icon: 🔧
    title: 工具系统
    details: 工具类型系统、权限模式、工具结果落盘
    link: /tools/tool-type
  - icon: 🖥️
    title: 终端 UI
    details: 自研 Ink 渲染引擎、全屏消息管理
    link: /ui/ink-engine
  - icon: ⚙️
    title: 构建系统
    details: Feature Flag 编译期消除、Prompt 分区缓存
    link: /build/feature-flag
  - icon: 💾
    title: 数据与状态
    details: 会话持久化、CLAUDE.md 发现、极简状态管理
    link: /data/session
  - icon: 🌐
    title: API 交互
    details: 多 Provider 接口、Token 估算、MCP 协议
    link: /api/multi-provider
  - icon: ✍️
    title: 提示词工程
    details: 编码行为约束、风险评估框架、输出效率指令
    link: /prompt/coding-prompt
---

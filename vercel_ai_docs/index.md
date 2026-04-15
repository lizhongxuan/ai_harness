---
layout: home
hero:
  name: Vercel AI SDK 源码学习
  text: 20+ 核心知识点深度解析
  tagline: 基于开源 packages/ai/ 核心包源码的完整分析，覆盖 Agent Loop、Provider 抽象、流式处理、中间件、类型系统、UI 集成
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
    details: generateText/streamText 循环、maxSteps 安全阀、ToolLoopAgent、停止条件
    link: /agent/generate-text-loop
  - icon: 🔌
    title: Provider 抽象
    details: LanguageModel 接口、Provider Registry、50+ Provider 适配、版本兼容
    link: /provider/language-model-interface
  - icon: 🌊
    title: 流式处理
    details: Web Streams API、SSE 传输、背压控制、smoothStream、stitchableStream
    link: /streaming/web-streams
  - icon: 🧩
    title: 中间件系统
    details: wrapLanguageModel、参数变换、生成包装、流包装、中间件组合
    link: /middleware/wrap-model
  - icon: 🔧
    title: 工具系统
    details: Zod 类型安全、工具审批、工具修复、activeTools 过滤
    link: /tools/type-safe-tools
  - icon: 🎨
    title: UI 集成
    details: useChat/useCompletion、UIMessageStream、多框架支持（React/Vue/Svelte/Angular）
    link: /ui/use-chat
  - icon: 📐
    title: 类型系统
    details: 泛型推导、条件类型、工具类型推断、Provider 类型安全
    link: /types/generics
  - icon: 📊
    title: 可观测性
    details: OpenTelemetry 集成、遥测 Span、自定义遥测
    link: /telemetry/otel
  - icon: 📦
    title: 构建与发布
    details: Monorepo 架构、Turborepo、tsup 构建、Changesets 版本管理
    link: /build/monorepo
  - icon: 📋
    title: 设计模式
    details: 12+ 种可复用的框架设计模式速查
    link: /appendix/patterns
---

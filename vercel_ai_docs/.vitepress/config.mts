import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Vercel AI SDK 源码学习',
  description: '基于开源 TypeScript 源码的完整分析',
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: 'Agent 架构', link: '/agent/generate-text-loop' },
      { text: 'Provider', link: '/provider/language-model-interface' },
      { text: '流式处理', link: '/streaming/web-streams' },
      { text: '中间件', link: '/middleware/wrap-model' },
      { text: '学习路线', link: '/appendix/roadmap' },
    ],
    sidebar: [
      {
        text: '入门',
        items: [
          { text: '快速开始', link: '/guide/getting-started' },
        ]
      },
      {
        text: 'Agent 架构',
        items: [
          { text: '1. generateText 循环', link: '/agent/generate-text-loop' },
          { text: '2. streamText 流式循环', link: '/agent/stream-text-loop' },
          { text: '3. ToolLoopAgent', link: '/agent/tool-loop-agent' },
          { text: '4. 停止条件', link: '/agent/stop-condition' },
        ]
      },
      {
        text: 'Provider 抽象',
        items: [
          { text: '5. LanguageModel 接口', link: '/provider/language-model-interface' },
          { text: '6. Provider Registry', link: '/provider/registry' },
          { text: '7. OpenAI 适配器', link: '/provider/openai-adapter' },
          { text: '8. 版本兼容层', link: '/provider/version-compat' },
        ]
      },
      {
        text: '流式处理',
        items: [
          { text: '9. Web Streams 基础', link: '/streaming/web-streams' },
          { text: '10. smoothStream', link: '/streaming/smooth-stream' },
          { text: '11. SSE 传输', link: '/streaming/sse-transport' },
          { text: '12. UIMessageStream', link: '/streaming/ui-message-stream' },
        ]
      },
      {
        text: '中间件系统',
        items: [
          { text: '13. wrapLanguageModel', link: '/middleware/wrap-model' },
          { text: '14. 内置中间件', link: '/middleware/builtin' },
        ]
      },
      {
        text: '工具系统',
        items: [
          { text: '15. 类型安全工具', link: '/tools/type-safe-tools' },
          { text: '16. 工具审批', link: '/tools/tool-approval' },
          { text: '17. 工具修复', link: '/tools/tool-repair' },
        ]
      },
      {
        text: 'UI 集成',
        items: [
          { text: '18. useChat', link: '/ui/use-chat' },
          { text: '19. 多框架支持', link: '/ui/multi-framework' },
        ]
      },
      {
        text: '类型系统',
        items: [
          { text: '20. 泛型推导', link: '/types/generics' },
        ]
      },
      {
        text: '可观测性',
        items: [
          { text: '21. OpenTelemetry', link: '/telemetry/otel' },
        ]
      },
      {
        text: '构建与发布',
        items: [
          { text: '22. Monorepo 架构', link: '/build/monorepo' },
        ]
      },
      {
        text: '附录',
        items: [
          { text: '设计模式速查', link: '/appendix/patterns' },
          { text: '学习路线', link: '/appendix/roadmap' },
        ]
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/vercel/ai' }
    ]
  }
})

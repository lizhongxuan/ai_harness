import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Codex CLI 源码学习',
  description: '基于开源 Rust/TypeScript 源码的完整分析',
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/getting-started' },
      { text: 'Agent 架构', link: '/agent/event-loop' },
      { text: '沙箱安全', link: '/sandbox/architecture' },
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
          { text: '1. 事件驱动循环', link: '/agent/event-loop' },
          { text: '2. 多 Agent 系统', link: '/agent/multi-agent' },
          { text: '3. 错误恢复', link: '/agent/error-recovery' },
          { text: '4. Hook 系统', link: '/agent/hook-system' },
        ]
      },
      {
        text: '沙箱安全',
        items: [
          { text: '5. 沙箱架构总览', link: '/sandbox/architecture' },
          { text: '6. macOS Seatbelt', link: '/sandbox/seatbelt' },
          { text: '7. Linux Landlock', link: '/sandbox/landlock' },
          { text: '8. 网络代理隔离', link: '/sandbox/network-proxy' },
        ]
      },
      {
        text: '执行策略',
        items: [
          { text: '9. 策略引擎', link: '/execpolicy/policy-engine' },
          { text: '10. 审批流程', link: '/execpolicy/approval-flow' },
          { text: '11. 权限升级', link: '/execpolicy/escalation' },
        ]
      },
      {
        text: '上下文管理',
        items: [
          { text: '12. 自动压缩', link: '/context/auto-compact' },
          { text: '13. Token 估算', link: '/context/token-estimate' },
        ]
      },
      {
        text: '工具系统',
        items: [
          { text: '14. Shell 工具', link: '/tools/shell-tool' },
          { text: '15. Apply-Patch 工具', link: '/tools/apply-patch' },
          { text: '16. MCP 集成', link: '/tools/mcp-integration' },
        ]
      },
      {
        text: '终端 UI',
        items: [
          { text: '17. TUI 架构', link: '/ui/tui-architecture' },
          { text: '18. 流式渲染', link: '/ui/streaming' },
        ]
      },
      {
        text: '数据与状态',
        items: [
          { text: '19. 会话持久化', link: '/data/session' },
          { text: '20. 配置层叠', link: '/data/config-stack' },
          { text: '21. AGENTS.md', link: '/data/agents-md' },
        ]
      },
      {
        text: 'API 交互',
        items: [
          { text: '22. Responses API', link: '/api/responses-api' },
          { text: '23. Chat Completions 适配', link: '/api/chat-completions' },
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
      { icon: 'github', link: 'https://github.com/openai/codex' }
    ]
  }
})

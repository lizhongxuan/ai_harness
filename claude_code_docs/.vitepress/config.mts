import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: 'Claude Code 源码学习',
    description: '基于 v2.1.88 源码的深度解析，24 个核心知识点',
    lang: 'zh-CN',
    // GitHub Pages 部署时需要设置 base
    // 如果仓库名是 claude-code-study，则 base: '/claude-code-study/'
    // 如果是 <username>.github.io 仓库，则删除这行
    base: '/claude-code-study-site/',
    themeConfig: {
      nav: [
        { text: '首页', link: '/' },
        { text: '快速开始', link: '/guide/getting-started' },
        { text: '学习路线', link: '/appendix/roadmap' },
      ],
      sidebar: [
        {
          text: '概览',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
          ],
        },
        {
          text: '一、Agent 架构',
          collapsed: false,
          items: [
            { text: '1. ReAct 循环工程化', link: '/agent/react-loop' },
            { text: '2. 多级错误恢复', link: '/agent/error-recovery' },
            { text: '3. 子 Agent 委托', link: '/agent/sub-agent' },
            { text: '4. Hook 系统', link: '/agent/hook-system' },
          ],
        },
        {
          text: '二、上下文管理',
          collapsed: false,
          items: [
            { text: '5. 五层防爆体系', link: '/context/five-layers' },
            { text: '6. 工具结果预算', link: '/context/tool-budget' },
            { text: '7. 压缩意图保持', link: '/context/compact-intent' },
            { text: '8. Prompt Cache 优化', link: '/context/prompt-cache' },
          ],
        },
        {
          text: '三、工具系统',
          collapsed: false,
          items: [
            { text: '9. 工具类型系统', link: '/tools/tool-type' },
            { text: '10. 权限模式', link: '/tools/permission' },
            { text: '11. 工具结果落盘', link: '/tools/tool-persist' },
          ],
        },
        {
          text: '四、终端 UI',
          collapsed: true,
          items: [
            { text: '12. Ink 渲染引擎', link: '/ui/ink-engine' },
            { text: '13. 全屏消息管理', link: '/ui/fullscreen' },
          ],
        },
        {
          text: '五、构建系统',
          collapsed: true,
          items: [
            { text: '14. Feature Flag 消除', link: '/build/feature-flag' },
            { text: '15. Prompt 分区缓存', link: '/build/prompt-section' },
          ],
        },
        {
          text: '六、数据与状态',
          collapsed: true,
          items: [
            { text: '16. 会话持久化', link: '/data/session' },
            { text: '17. CLAUDE.md 发现', link: '/data/claudemd' },
            { text: '18. 极简状态管理', link: '/data/store' },
          ],
        },
        {
          text: '七、API 交互',
          collapsed: true,
          items: [
            { text: '19. 多 Provider 接口', link: '/api/multi-provider' },
            { text: '20. Token 估算', link: '/api/token-estimate' },
            { text: '21. MCP 协议', link: '/api/mcp' },
          ],
        },
        {
          text: '八、提示词工程',
          collapsed: false,
          items: [
            { text: '22. 编码行为约束', link: '/prompt/coding-prompt' },
            { text: '23. 风险评估框架', link: '/prompt/risk-framework' },
            { text: '24. 输出效率指令', link: '/prompt/output-efficiency' },
          ],
        },
        {
          text: '附录',
          collapsed: true,
          items: [
            { text: '设计模式速查', link: '/appendix/patterns' },
            { text: '学习路线', link: '/appendix/roadmap' },
          ],
        },
      ],
      outline: { level: [2, 3], label: '本页目录' },
      search: { provider: 'local' },
      footer: {
        message: '基于 Claude Code v2.1.88 源码分析',
      },
    },
    mermaid: {},
  })
)

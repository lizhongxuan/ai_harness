import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
    title: 'Hermes Agent 源码学习',
    description: '基于 Nous Research 开源 hermes-agent 源码的深度解析，26 个核心知识点',
    lang: 'zh-CN',
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
            { text: '1. 双 Agent 循环', link: '/agent/dual-loop' },
            { text: '2. 并行工具执行', link: '/agent/parallel-tools' },
            { text: '3. 迭代预算', link: '/agent/iteration-budget' },
            { text: '4. 子 Agent 委托', link: '/agent/subagent' },
          ],
        },
        {
          text: '二、多平台网关',
          collapsed: false,
          items: [
            { text: '5. 网关架构', link: '/gateway/architecture' },
            { text: '6. 平台适配器', link: '/gateway/platforms' },
            { text: '7. 网关 Hook', link: '/gateway/hooks' },
          ],
        },
        {
          text: '三、技能生态',
          collapsed: false,
          items: [
            { text: '8. 技能系统', link: '/skills/skill-system' },
            { text: '9. Toolset 系统', link: '/skills/toolsets' },
          ],
        },
        {
          text: '四、上下文管理',
          collapsed: false,
          items: [
            { text: '10. 上下文压缩器', link: '/context/compressor' },
            { text: '11. 轨迹压缩器', link: '/context/trajectory-compressor' },
          ],
        },
        {
          text: '五、记忆系统',
          collapsed: false,
          items: [
            { text: '12. 记忆管理器', link: '/memory/manager' },
            { text: '13. 内置记忆 Provider', link: '/memory/builtin-provider' },
          ],
        },
        {
          text: '六、工具系统',
          collapsed: false,
          items: [
            { text: '14. 工具注册表', link: '/tools/registry' },
            { text: '15. 工具类型', link: '/tools/tool-types' },
            { text: '16. 工具审批', link: '/tools/approval' },
          ],
        },
        {
          text: '七、API 与 Provider',
          collapsed: false,
          items: [
            { text: '17. 多 Provider 支持', link: '/api/multi-provider' },
            { text: '18. 智能模型路由', link: '/api/smart-routing' },
          ],
        },
        {
          text: '八、RL 训练',
          collapsed: false,
          items: [
            { text: '19. RL Agent 循环', link: '/rl/agent-loop' },
            { text: '20. 轨迹管理', link: '/rl/trajectory' },
          ],
        },
        {
          text: '九、CLI 与 UI',
          collapsed: true,
          items: [
            { text: '21. CLI 架构', link: '/cli/architecture' },
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
        message: '基于 Nous Research hermes-agent 开源源码分析',
      },
    },
    mermaid: {},
  })
)

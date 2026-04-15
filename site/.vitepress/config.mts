import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

export default withMermaid(
  defineConfig({
  lang: 'zh-CN',
  title: 'Agent Harness 学习',
  description: '四大 Agent 项目架构分析与学习站点',

  // GitHub Pages 部署路径，格式: /<仓库名>/
  // 如果部署到 https://<用户名>.github.io/ 根路径，改为 '/'
  base: '/ai_harness/',

  deadLinks: 'fail',

  themeConfig: {
    search: {
      provider: 'local',
    },

    nav: [
      { text: '全局概览', link: '/overview/' },
      { text: '核心模块', link: '/modules/agent-loop' },
      { text: '实战定制', link: '/customization/' },
      { text: '综合练习题', link: '/comprehensive/' },
      {
        text: '项目剖析',
        items: [
          { text: '总览', link: '/deep-dive/' },
          { text: 'Claude Code 剖析', link: '/deep-dive/claude-code' },
          { text: 'Codex CLI 剖析', link: '/deep-dive/codex' },
          { text: 'Vercel AI SDK 剖析', link: '/deep-dive/vercel-ai-sdk' },
          { text: 'Hermes Agent 剖析', link: '/deep-dive/hermes-agent' },
        ],
      },
      {
        text: '项目文档',
        items: [
          { text: 'Claude Code 文档', link: '/claude_code_docs/' },
          { text: 'Codex CLI 文档', link: '/codex_docs/' },
          { text: 'Vercel AI SDK 文档', link: '/vercel_ai_docs/' },
          { text: 'Hermes Agent 文档', link: '/hermes_agent_docs/' },
        ],
      },
      { text: '学习计划', link: '/study-plan' },
    ],

    sidebar: {
      '/overview/': [
        {
          text: '全局概览',
          items: [
            { text: '全局概览', link: '/overview/' },
          ],
        },
        {
          text: '快速跳转',
          items: [
            { text: '→ 核心模块', link: '/modules/agent-loop' },
            { text: '→ 实战定制指南', link: '/customization/' },
            { text: '→ 学习计划', link: '/study-plan' },
          ],
        },
      ],

      '/customization/': [
        {
          text: '实战定制',
          items: [
            { text: '实战定制指南', link: '/customization/' },
          ],
        },
        {
          text: '相关模块',
          items: [
            { text: '→ Agent Loop', link: '/modules/agent-loop' },
            { text: '→ 上下文压缩', link: '/modules/context-compression' },
            { text: '→ 记忆系统', link: '/modules/memory-system' },
            { text: '→ 错误恢复', link: '/modules/error-recovery' },
            { text: '→ Token Budget', link: '/modules/token-budget' },
            { text: '→ 推测执行', link: '/modules/speculative-execution' },
            { text: '→ 沙箱安全', link: '/modules/sandbox-security' },
          ],
        },
      ],

      '/deep-dive/': [
        {
          text: '项目深度剖析',
          items: [
            { text: '总览', link: '/deep-dive/' },
            { text: 'Claude Code', link: '/deep-dive/claude-code' },
            { text: 'Codex CLI', link: '/deep-dive/codex' },
            { text: 'Vercel AI SDK', link: '/deep-dive/vercel-ai-sdk' },
            { text: 'Hermes Agent', link: '/deep-dive/hermes-agent' },
          ],
        },
        {
          text: '项目文档站',
          items: [
            { text: '→ Claude Code 文档', link: '/claude_code_docs/' },
            { text: '→ Codex CLI 文档', link: '/codex_docs/' },
            { text: '→ Vercel AI SDK 文档', link: '/vercel_ai_docs/' },
            { text: '→ Hermes Agent 文档', link: '/hermes_agent_docs/' },
          ],
        },
        {
          text: '导航',
          items: [
            { text: '← 返回全局概览', link: '/overview/' },
          ],
        },
      ],

      '/modules/': [
        {
          text: '导航',
          items: [
            { text: '← 返回全局概览', link: '/overview/' },
          ],
        },
        {
          text: '核心模块',
          items: [
            { text: '状态机 Agent Loop ★★★★★', link: '/modules/agent-loop' },
            { text: '多级上下文压缩 ★★★★★', link: '/modules/context-compression' },
            { text: '跨会话记忆系统 ★★★★', link: '/modules/memory-system' },
            { text: '多级错误恢复 ★★★★', link: '/modules/error-recovery' },
            { text: 'Token Budget 管理 ★★★', link: '/modules/token-budget' },
            { text: '推测执行 ★★★', link: '/modules/speculative-execution' },
            { text: '沙箱安全 ★★★', link: '/modules/sandbox-security' },
          ],
        },
      ],

      '/comprehensive/': [
        {
          text: '综合面试题',
          items: [
            { text: '综合面试题', link: '/comprehensive/' },
          ],
        },
      ],

      '/claude_code_docs/': [
        {
          text: '导航',
          items: [
            { text: '← 返回项目剖析总览', link: '/deep-dive/' },
            { text: '← Claude Code 深度剖析', link: '/deep-dive/claude-code' },
          ],
        },
        {
          text: '概览',
          items: [
            { text: '快速开始', link: '/claude_code_docs/guide/getting-started' },
          ],
        },
        {
          text: '一、Agent 架构',
          collapsed: false,
          items: [
            { text: '1. ReAct 循环工程化', link: '/claude_code_docs/agent/react-loop' },
            { text: '2. 多级错误恢复', link: '/claude_code_docs/agent/error-recovery' },
            { text: '3. 子 Agent 委托', link: '/claude_code_docs/agent/sub-agent' },
            { text: '4. Hook 系统', link: '/claude_code_docs/agent/hook-system' },
          ],
        },
        {
          text: '二、上下文管理',
          collapsed: false,
          items: [
            { text: '5. 五层防爆体系', link: '/claude_code_docs/context/five-layers' },
            { text: '6. 工具结果预算', link: '/claude_code_docs/context/tool-budget' },
            { text: '7. 压缩意图保持', link: '/claude_code_docs/context/compact-intent' },
            { text: '8. Prompt Cache 优化', link: '/claude_code_docs/context/prompt-cache' },
          ],
        },
        {
          text: '三、工具系统',
          collapsed: false,
          items: [
            { text: '9. 工具类型系统', link: '/claude_code_docs/tools/tool-type' },
            { text: '10. 权限模式', link: '/claude_code_docs/tools/permission' },
            { text: '11. 工具结果落盘', link: '/claude_code_docs/tools/tool-persist' },
          ],
        },
        {
          text: '四、终端 UI',
          collapsed: true,
          items: [
            { text: '12. Ink 渲染引擎', link: '/claude_code_docs/ui/ink-engine' },
            { text: '13. 全屏消息管理', link: '/claude_code_docs/ui/fullscreen' },
          ],
        },
        {
          text: '五、构建系统',
          collapsed: true,
          items: [
            { text: '14. Feature Flag 消除', link: '/claude_code_docs/build/feature-flag' },
            { text: '15. Prompt 分区缓存', link: '/claude_code_docs/build/prompt-section' },
          ],
        },
        {
          text: '六、数据与状态',
          collapsed: true,
          items: [
            { text: '16. 会话持久化', link: '/claude_code_docs/data/session' },
            { text: '17. CLAUDE.md 发现', link: '/claude_code_docs/data/claudemd' },
            { text: '18. 极简状态管理', link: '/claude_code_docs/data/store' },
          ],
        },
        {
          text: '七、API 交互',
          collapsed: true,
          items: [
            { text: '19. 多 Provider 接口', link: '/claude_code_docs/api/multi-provider' },
            { text: '20. Token 估算', link: '/claude_code_docs/api/token-estimate' },
            { text: '21. MCP 协议', link: '/claude_code_docs/api/mcp' },
          ],
        },
        {
          text: '八、提示词工程',
          collapsed: false,
          items: [
            { text: '22. 编码行为约束', link: '/claude_code_docs/prompt/coding-prompt' },
            { text: '23. 风险评估框架', link: '/claude_code_docs/prompt/risk-framework' },
            { text: '24. 输出效率指令', link: '/claude_code_docs/prompt/output-efficiency' },
          ],
        },
        {
          text: '附录',
          collapsed: true,
          items: [
            { text: '设计模式速查', link: '/claude_code_docs/appendix/patterns' },
            { text: '学习路线', link: '/claude_code_docs/appendix/roadmap' },
          ],
        },
      ],

      '/codex_docs/': [
        {
          text: '导航',
          items: [
            { text: '← 返回项目剖析总览', link: '/deep-dive/' },
            { text: '← Codex CLI 深度剖析', link: '/deep-dive/codex' },
          ],
        },
        {
          text: '入门',
          items: [
            { text: '快速开始', link: '/codex_docs/guide/getting-started' },
          ],
        },
        {
          text: 'Agent 架构',
          items: [
            { text: '1. 事件驱动循环', link: '/codex_docs/agent/event-loop' },
            { text: '2. 多 Agent 系统', link: '/codex_docs/agent/multi-agent' },
            { text: '3. 错误恢复', link: '/codex_docs/agent/error-recovery' },
            { text: '4. Hook 系统', link: '/codex_docs/agent/hook-system' },
          ],
        },
        {
          text: '沙箱安全',
          items: [
            { text: '5. 沙箱架构总览', link: '/codex_docs/sandbox/architecture' },
            { text: '6. macOS Seatbelt', link: '/codex_docs/sandbox/seatbelt' },
            { text: '7. Linux Landlock', link: '/codex_docs/sandbox/landlock' },
            { text: '8. 网络代理隔离', link: '/codex_docs/sandbox/network-proxy' },
          ],
        },
        {
          text: '执行策略',
          items: [
            { text: '9. 策略引擎', link: '/codex_docs/execpolicy/policy-engine' },
            { text: '10. 审批流程', link: '/codex_docs/execpolicy/approval-flow' },
            { text: '11. 权限升级', link: '/codex_docs/execpolicy/escalation' },
          ],
        },
        {
          text: '上下文管理',
          items: [
            { text: '12. 自动压缩', link: '/codex_docs/context/auto-compact' },
            { text: '13. Token 估算', link: '/codex_docs/context/token-estimate' },
          ],
        },
        {
          text: '工具系统',
          items: [
            { text: '14. Shell 工具', link: '/codex_docs/tools/shell-tool' },
            { text: '15. Apply-Patch 工具', link: '/codex_docs/tools/apply-patch' },
            { text: '16. MCP 集成', link: '/codex_docs/tools/mcp-integration' },
          ],
        },
        {
          text: '终端 UI',
          items: [
            { text: '17. TUI 架构', link: '/codex_docs/ui/tui-architecture' },
            { text: '18. 流式渲染', link: '/codex_docs/ui/streaming' },
          ],
        },
        {
          text: '数据与状态',
          items: [
            { text: '19. 会话持久化', link: '/codex_docs/data/session' },
            { text: '20. 配置层叠', link: '/codex_docs/data/config-stack' },
            { text: '21. AGENTS.md', link: '/codex_docs/data/agents-md' },
          ],
        },
        {
          text: 'API 交互',
          items: [
            { text: '22. Responses API', link: '/codex_docs/api/responses-api' },
            { text: '23. Chat Completions 适配', link: '/codex_docs/api/chat-completions' },
          ],
        },
        {
          text: '附录',
          items: [
            { text: '设计模式速查', link: '/codex_docs/appendix/patterns' },
            { text: '学习路线', link: '/codex_docs/appendix/roadmap' },
          ],
        },
      ],

      '/vercel_ai_docs/': [
        {
          text: '导航',
          items: [
            { text: '← 返回项目剖析总览', link: '/deep-dive/' },
            { text: '← Vercel AI SDK 深度剖析', link: '/deep-dive/vercel-ai-sdk' },
          ],
        },
        {
          text: '入门',
          items: [
            { text: '快速开始', link: '/vercel_ai_docs/guide/getting-started' },
          ],
        },
        {
          text: 'Agent 架构',
          items: [
            { text: '1. generateText 循环', link: '/vercel_ai_docs/agent/generate-text-loop' },
            { text: '2. streamText 流式循环', link: '/vercel_ai_docs/agent/stream-text-loop' },
            { text: '3. ToolLoopAgent', link: '/vercel_ai_docs/agent/tool-loop-agent' },
            { text: '4. 停止条件', link: '/vercel_ai_docs/agent/stop-condition' },
          ],
        },
        {
          text: 'Provider 抽象',
          items: [
            { text: '5. LanguageModel 接口', link: '/vercel_ai_docs/provider/language-model-interface' },
            { text: '6. Provider Registry', link: '/vercel_ai_docs/provider/registry' },
            { text: '7. OpenAI 适配器', link: '/vercel_ai_docs/provider/openai-adapter' },
            { text: '8. 版本兼容层', link: '/vercel_ai_docs/provider/version-compat' },
          ],
        },
        {
          text: '流式处理',
          items: [
            { text: '9. Web Streams 基础', link: '/vercel_ai_docs/streaming/web-streams' },
            { text: '10. smoothStream', link: '/vercel_ai_docs/streaming/smooth-stream' },
            { text: '11. SSE 传输', link: '/vercel_ai_docs/streaming/sse-transport' },
            { text: '12. UIMessageStream', link: '/vercel_ai_docs/streaming/ui-message-stream' },
          ],
        },
        {
          text: '中间件系统',
          items: [
            { text: '13. wrapLanguageModel', link: '/vercel_ai_docs/middleware/wrap-model' },
            { text: '14. 内置中间件', link: '/vercel_ai_docs/middleware/builtin' },
          ],
        },
        {
          text: '工具系统',
          items: [
            { text: '15. 类型安全工具', link: '/vercel_ai_docs/tools/type-safe-tools' },
            { text: '16. 工具审批', link: '/vercel_ai_docs/tools/tool-approval' },
            { text: '17. 工具修复', link: '/vercel_ai_docs/tools/tool-repair' },
          ],
        },
        {
          text: 'UI 集成',
          items: [
            { text: '18. useChat', link: '/vercel_ai_docs/ui/use-chat' },
            { text: '19. 多框架支持', link: '/vercel_ai_docs/ui/multi-framework' },
          ],
        },
        {
          text: '类型系统',
          items: [
            { text: '20. 泛型推导', link: '/vercel_ai_docs/types/generics' },
          ],
        },
        {
          text: '可观测性',
          items: [
            { text: '21. OpenTelemetry', link: '/vercel_ai_docs/telemetry/otel' },
          ],
        },
        {
          text: '构建与发布',
          items: [
            { text: '22. Monorepo 架构', link: '/vercel_ai_docs/build/monorepo' },
          ],
        },
        {
          text: '附录',
          items: [
            { text: '设计模式速查', link: '/vercel_ai_docs/appendix/patterns' },
            { text: '学习路线', link: '/vercel_ai_docs/appendix/roadmap' },
          ],
        },
      ],

      '/hermes_agent_docs/': [
        {
          text: '导航',
          items: [
            { text: '← 返回项目剖析总览', link: '/deep-dive/' },
            { text: '← Hermes Agent 深度剖析', link: '/deep-dive/hermes-agent' },
          ],
        },
        {
          text: '概览',
          items: [
            { text: '快速开始', link: '/hermes_agent_docs/guide/getting-started' },
          ],
        },
        {
          text: '一、Agent 架构',
          collapsed: false,
          items: [
            { text: '1. 双 Agent 循环', link: '/hermes_agent_docs/agent/dual-loop' },
            { text: '2. 并行工具执行', link: '/hermes_agent_docs/agent/parallel-tools' },
            { text: '3. 迭代预算', link: '/hermes_agent_docs/agent/iteration-budget' },
            { text: '4. 子 Agent 委托', link: '/hermes_agent_docs/agent/subagent' },
          ],
        },
        {
          text: '二、多平台网关',
          collapsed: false,
          items: [
            { text: '5. 网关架构', link: '/hermes_agent_docs/gateway/architecture' },
            { text: '6. 平台适配器', link: '/hermes_agent_docs/gateway/platforms' },
            { text: '7. 网关 Hook', link: '/hermes_agent_docs/gateway/hooks' },
          ],
        },
        {
          text: '三、技能生态',
          collapsed: false,
          items: [
            { text: '8. 技能系统', link: '/hermes_agent_docs/skills/skill-system' },
            { text: '9. Toolset 系统', link: '/hermes_agent_docs/skills/toolsets' },
          ],
        },
        {
          text: '四、上下文管理',
          collapsed: false,
          items: [
            { text: '10. 上下文压缩器', link: '/hermes_agent_docs/context/compressor' },
            { text: '11. 轨迹压缩器', link: '/hermes_agent_docs/context/trajectory-compressor' },
          ],
        },
        {
          text: '五、记忆系统',
          collapsed: false,
          items: [
            { text: '12. 记忆管理器', link: '/hermes_agent_docs/memory/manager' },
            { text: '13. 内置记忆 Provider', link: '/hermes_agent_docs/memory/builtin-provider' },
          ],
        },
        {
          text: '六、工具系统',
          collapsed: false,
          items: [
            { text: '14. 工具注册表', link: '/hermes_agent_docs/tools/registry' },
            { text: '15. 工具类型', link: '/hermes_agent_docs/tools/tool-types' },
            { text: '16. 工具审批', link: '/hermes_agent_docs/tools/approval' },
          ],
        },
        {
          text: '七、API 与 Provider',
          collapsed: false,
          items: [
            { text: '17. 多 Provider 支持', link: '/hermes_agent_docs/api/multi-provider' },
            { text: '18. 智能模型路由', link: '/hermes_agent_docs/api/smart-routing' },
          ],
        },
        {
          text: '八、RL 训练',
          collapsed: false,
          items: [
            { text: '19. RL Agent 循环', link: '/hermes_agent_docs/rl/agent-loop' },
            { text: '20. 轨迹管理', link: '/hermes_agent_docs/rl/trajectory' },
          ],
        },
        {
          text: '九、CLI 与 UI',
          collapsed: true,
          items: [
            { text: '21. CLI 架构', link: '/hermes_agent_docs/cli/architecture' },
          ],
        },
        {
          text: '附录',
          collapsed: true,
          items: [
            { text: '设计模式速查', link: '/hermes_agent_docs/appendix/patterns' },
            { text: '学习路线', link: '/hermes_agent_docs/appendix/roadmap' },
          ],
        },
      ],
    },
  },
})
)

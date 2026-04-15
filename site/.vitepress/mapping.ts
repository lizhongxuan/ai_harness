export interface KnowledgePointLink {
  title: string;
  path: string;
}

export interface ModuleMapping {
  moduleId: string;
  moduleName: string;
  weight: string;
  knowledgePoints: {
    claude_code: KnowledgePointLink[];
    codex: KnowledgePointLink[];
    vercel_ai: KnowledgePointLink[];
    hermes_agent: KnowledgePointLink[];
  };
}

export const moduleMapping: ModuleMapping[] = [
  {
    moduleId: 'agent-loop',
    moduleName: '状态机 Agent Loop',
    weight: '★★★★★',
    knowledgePoints: {
      claude_code: [
        { title: 'ReAct 循环工程化实现', path: '/claude_code_docs/agent/react-loop' },
      ],
      codex: [
        { title: '事件驱动循环架构', path: '/codex_docs/agent/event-loop' },
      ],
      vercel_ai: [
        { title: 'generateText 循环控制', path: '/vercel_ai_docs/agent/generate-text-loop' },
      ],
      hermes_agent: [
        { title: '双 Agent 循环机制', path: '/hermes_agent_docs/agent/dual-loop' },
      ],
    },
  },
  {
    moduleId: 'context-compression',
    moduleName: '多级上下文压缩',
    weight: '★★★★★',
    knowledgePoints: {
      claude_code: [
        { title: '五层上下文管理体系', path: '/claude_code_docs/context/five-layers' },
        { title: 'Compact 意图压缩策略', path: '/claude_code_docs/context/compact-intent' },
      ],
      codex: [
        { title: '自动上下文压缩机制', path: '/codex_docs/context/auto-compact' },
      ],
      vercel_ai: [],
      hermes_agent: [
        { title: '上下文压缩器设计', path: '/hermes_agent_docs/context/compressor' },
      ],
    },
  },
  {
    moduleId: 'memory-system',
    moduleName: '跨会话记忆系统',
    weight: '★★★★',
    knowledgePoints: {
      claude_code: [
        { title: 'CLAUDE.md 持久化配置', path: '/claude_code_docs/data/claudemd' },
        { title: '会话数据管理', path: '/claude_code_docs/data/session' },
      ],
      codex: [
        { title: '会话状态持久化', path: '/codex_docs/data/session' },
        { title: 'agents.md 配置体系', path: '/codex_docs/data/agents-md' },
      ],
      vercel_ai: [],
      hermes_agent: [
        { title: '记忆管理器架构', path: '/hermes_agent_docs/memory/manager' },
      ],
    },
  },
  {
    moduleId: 'error-recovery',
    moduleName: '多级错误恢复',
    weight: '★★★★',
    knowledgePoints: {
      claude_code: [
        { title: '多级错误恢复策略', path: '/claude_code_docs/agent/error-recovery' },
      ],
      codex: [
        { title: '错误恢复与重试机制', path: '/codex_docs/agent/error-recovery' },
      ],
      vercel_ai: [
        { title: '停止条件与错误处理', path: '/vercel_ai_docs/agent/stop-condition' },
      ],
      hermes_agent: [],
    },
  },
  {
    moduleId: 'token-budget',
    moduleName: 'Token Budget 管理',
    weight: '★★★',
    knowledgePoints: {
      claude_code: [
        { title: '工具调用 Token 预算', path: '/claude_code_docs/context/tool-budget' },
        { title: 'Token 估算与计费', path: '/claude_code_docs/api/token-estimate' },
      ],
      codex: [
        { title: 'Token 用量估算', path: '/codex_docs/context/token-estimate' },
      ],
      vercel_ai: [],
      hermes_agent: [],
    },
  },
  {
    moduleId: 'speculative-execution',
    moduleName: '推测执行',
    weight: '★★★',
    knowledgePoints: {
      claude_code: [],
      codex: [
        { title: '沙箱架构与推测执行', path: '/codex_docs/sandbox/architecture' },
        { title: '策略引擎与执行控制', path: '/codex_docs/execpolicy/policy-engine' },
      ],
      vercel_ai: [],
      hermes_agent: [],
    },
  },
  {
    moduleId: 'sandbox-security',
    moduleName: '沙箱安全',
    weight: '★★★',
    knowledgePoints: {
      claude_code: [],
      codex: [
        { title: '沙箱整体架构设计', path: '/codex_docs/sandbox/architecture' },
        { title: 'macOS Seatbelt 沙箱', path: '/codex_docs/sandbox/seatbelt' },
        { title: 'Linux Landlock 沙箱', path: '/codex_docs/sandbox/landlock' },
        { title: '网络代理与隔离', path: '/codex_docs/sandbox/network-proxy' },
      ],
      vercel_ai: [],
      hermes_agent: [],
    },
  },
];

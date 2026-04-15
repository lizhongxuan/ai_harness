# 16. MCP 集成

> 源码位置: `codex-rs/codex-mcp/`, `codex-rs/rmcp-client/`

## 概述

Codex 通过 MCP（Model Context Protocol）集成外部工具和数据源。MCP 工具在 Codex 中作为普通工具出现，经过相同的审批和沙箱流程。

## 底层原理

### MCP 连接管理

```rust
// codex-rs/codex-mcp/src/mcp_connection_manager.rs

// MCP 连接管理器负责：
// 1. 连接到 MCP 服务器
// 2. 发现可用工具
// 3. 路由工具调用
// 4. 管理连接生命周期
```

### MCP 工具审批

```
MCP 工具调用也经过 Exec Policy 检查：
  - MCP 工具名映射为 mcp__<server>__<tool>
  - 可以在策略中为特定 MCP 工具设置规则
  - 默认需要用户确认
```

### 与 Claude Code MCP 的对比

| 维度 | Codex | Claude Code |
|------|-------|------------|
| 协议版本 | MCP 标准 | MCP 标准 |
| 工具发现 | 连接时发现 | 延迟加载（按需） |
| 审批 | Exec Policy | PreToolUse Hook |
| 沙箱 | MCP 工具也在沙箱中 | MCP 工具不在沙箱中 |

## 关联知识点

- [策略引擎](/execpolicy/policy-engine) — MCP 工具的策略检查

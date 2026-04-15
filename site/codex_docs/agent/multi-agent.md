# 2. 多 Agent 系统

> 源码位置: `codex-rs/core/src/agent/registry.rs`, `agent/mailbox.rs`, `agent/control.rs`, `agent/role.rs`

## 概述

Codex 的多 Agent 系统基于**注册表 + 邮箱**模式。每个 Agent 在注册表中有唯一标识，通过邮箱系统异步通信。有严格的深度限制防止递归生成。

## 底层原理

### Agent 注册表

```rust
// agent/registry.rs

struct AgentRegistry {
    active_agents: ActiveAgents,  // 当前活跃的 Agent
}

struct AgentMetadata {
    thread_id: ThreadId,          // 线程 ID
    // 其他元数据：创建时间、父 Agent、角色等
}

// 深度限制：防止 Agent 递归生成 Agent
fn session_depth(session_source: &SessionSource) -> i32 {
    // 根 Agent: depth = 0
    // 子 Agent: depth = parent.depth + 1
    // 超过限制 → 拒绝生成
}
```

### 邮箱系统

```rust
// agent/mailbox.rs

struct Mailbox {
    // 发送端：Agent 间异步消息传递
}

struct MailboxReceiver {
    // 接收端：watch channel
}

impl Mailbox {
    fn new() -> (Self, MailboxReceiver) {
        // 创建 mailbox + receiver 对
    }
    
    fn send(&self, communication: InterAgentCommunication) -> u64 {
        // 发送消息，返回序列号
    }
    
    fn subscribe(&self) -> watch::Receiver<u64> {
        // 订阅消息通知（用于等待新消息）
    }
}
```

### Agent 生命周期

```rust
// agent/control.rs

enum SpawnAgentForkMode {
    // Agent 的创建模式
}

struct SpawnAgentOptions {
    // 创建 Agent 的配置
}

struct LiveAgent {
    // 运行中的 Agent 实例
}

struct ListedAgent {
    // Agent 列表中的条目
}
```

### 角色系统

```rust
// agent/role.rs

// Agent 可以有不同的角色，角色决定：
// - 可用的工具集
// - 系统提示词
// - 权限级别
// - 配置覆盖

pub async fn apply_role_to_config(config: &mut Config, role: &str) {
    // 从 TOML 文件加载角色配置
    // 合并到当前配置中
}

fn resolve_role_config(config: &Config, role_layer: &TomlValue) -> Config {
    // 角色配置可以覆盖：
    // - model（使用不同的模型）
    // - tools（限制可用工具）
    // - system_prompt（不同的提示词）
    // - permissions（不同的权限级别）
}
```

### 与 Claude Code 的对比

| 维度 | Codex | Claude Code |
|------|-------|------------|
| 通信方式 | 邮箱（异步消息传递） | 工具调用返回值 |
| Agent 标识 | 注册表 + ThreadId | agentId 字符串 |
| 深度限制 | session_depth() 函数 | 硬编码最多 1 个子 Agent |
| 角色系统 | TOML 配置文件 | 无（所有 Agent 相同角色） |
| 并发 | 多个 Agent 可以并行 | 最多 1 个子 Agent |

## 设计原因

- **解耦**：邮箱系统让 Agent 间通信不需要直接引用
- **可扩展**：注册表模式支持动态添加/移除 Agent
- **安全**：深度限制防止递归爆炸
- **灵活**：角色系统让同一个 Agent 引擎可以扮演不同角色

## 关联知识点

- [事件驱动循环](/codex_docs/agent/event-loop) — Agent 事件的处理
- [Hook 系统](/codex_docs/agent/hook-system) — Agent 间的 Hook 触发

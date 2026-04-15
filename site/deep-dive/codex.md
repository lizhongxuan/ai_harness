---
title: OpenAI Codex 源码深度剖析
---

# OpenAI Codex 源码深度剖析

> 基于开源仓库 codex-rs/（Rust 核心）和 codex-cli/（TypeScript CLI），逐模块拆解

::: tip 知识点导航
本文涉及的 Codex 源码分析文章：
- [事件驱动循环架构](/codex_docs/agent/event-loop) — Agent Loop 核心架构
- [多 Agent 管理机制](/codex_docs/agent/multi-agent) — Agent 注册表与邮箱系统
- [自动上下文压缩机制](/codex_docs/context/auto-compact) — 上下文管理策略
- [Token 用量估算](/codex_docs/context/token-estimate) — Token Budget 管理
- [会话状态持久化](/codex_docs/data/session) — 会话管理
- [agents.md 配置体系](/codex_docs/data/agents-md) — 项目级指令配置
- [配置栈架构](/codex_docs/data/config-stack) — 多层配置合并
- [错误恢复与重试机制](/codex_docs/agent/error-recovery) — 错误恢复链路
- [沙箱整体架构设计](/codex_docs/sandbox/architecture) — 三层沙箱体系
- [macOS Seatbelt 沙箱](/codex_docs/sandbox/seatbelt) — macOS 沙箱实现
- [Linux Landlock 沙箱](/codex_docs/sandbox/landlock) — Linux 沙箱实现
- [网络代理与隔离](/codex_docs/sandbox/network-proxy) — 网络访问控制
- [策略引擎与执行控制](/codex_docs/execpolicy/policy-engine) — Exec Policy 详解
- [审批流程设计](/codex_docs/execpolicy/approval-flow) — 命令审批机制
:::

---

## 1. 状态机 Agent Loop ★★★★★

> 📖 详细源码分析：[事件驱动循环架构](/codex_docs/agent/event-loop) | [多 Agent 管理机制](/codex_docs/agent/multi-agent)

### 核心文件：`codex-rs/core/src/codex_delegate.rs`、`codex-rs/exec/src/lib.rs`

Codex 的 Agent Loop 是**事件驱动**的，不是简单的 while loop。核心用 Rust 实现，通过 async/await + channel 通信。

### 架构概览

```
codex-rs 架构：

用户输入
  │
  ▼
codex-rs/exec/ → CLI 入口
  │ interactive mode → run_codex_thread_interactive()
  │ one-shot mode   → run_codex_thread_one_shot()
  ▼
codex-rs/core/ → 核心引擎
  │
  ├── codex_delegate.rs → 事件循环 + 审批处理
  │     forward_events() → 接收 agent 事件
  │     handle_exec_approval() → 命令执行审批
  │     handle_patch_approval() → 文件修改审批
  │     handle_request_user_input() → 用户输入请求
  │
  ├── agent/ → 多 Agent 管理
  │     registry.rs → Agent 注册表（深度限制）
  │     mailbox.rs → Agent 间消息传递
  │     control.rs → Agent 生命周期管理
  │
  ├── session/ → 会话管理
  │     thread_manager.rs → 线程管理
  │
  └── tools/ → 工具执行
        sandboxing/ → 沙箱隔离
        exec/ → 命令执行
```

### 事件循环

> 📖 参见：[事件驱动循环架构](/codex_docs/agent/event-loop) — 事件分发与处理流程

```rust
// codex_delegate.rs — 简化版
pub async fn run_codex_thread_interactive(codex: &Codex, delegate: &Delegate) {
    loop {
        // 接收事件（来自 agent 或用户）
        match forward_events(codex, delegate).await {
            Event::ExecApproval(approval) => {
                // 命令执行需要用户审批
                handle_exec_approval(codex, delegate, approval).await
            }
            Event::PatchApproval(patch) => {
                // 文件修改需要用户审批
                handle_patch_approval(codex, delegate, patch).await
            }
            Event::RequestUserInput(request) => {
                // Agent 请求用户输入
                handle_request_user_input(codex, delegate, request).await
            }
            Event::RequestPermissions(request) => {
                // 权限请求
                handle_request_permissions(codex, delegate, request).await
            }
            Event::Shutdown => break,
        }
    }
    shutdown_delegate(codex).await
}
```

### 与 Claude Code 的关键差异

```
Claude Code: while(true) { callModel → executeTools → continue }
  - 模型决定下一步
  - 工具执行是循环的一部分
  - 单线程

Codex: loop { receive_event → handle_event }
  - 事件驱动
  - 审批是显式的事件（不是工具执行的副作用）
  - Rust async runtime（tokio）管理并发
  - Agent 间通过 mailbox 通信
```

### Agent 注册表和深度限制

> 📖 参见：[多 Agent 管理机制](/codex_docs/agent/multi-agent) — 注册表与深度控制

```rust
// agent/registry.rs
struct AgentRegistry {
    active_agents: ActiveAgents,
}

struct AgentMetadata {
    thread_id: ThreadId,
    // ... 其他元数据
}

// 深度限制：防止递归生成 Agent
fn session_depth(session_source: &SessionSource) -> i32 {
    // 计算当前 Agent 的嵌套深度
    // 超过限制 → 拒绝生成新 Agent
}
```

### Agent 邮箱系统

> 📖 参见：[多 Agent 管理机制](/codex_docs/agent/multi-agent) — 邮箱通信机制

```rust
// agent/mailbox.rs
struct Mailbox {
    // Agent 间异步消息传递
}

struct MailboxReceiver {
    // 接收端
}

impl Mailbox {
    fn send(&self, communication: InterAgentCommunication) -> u64 {
        // 发送消息给其他 Agent
    }
    
    fn subscribe(&self) -> watch::Receiver<u64> {
        // 订阅消息通知
    }
}
```

---

## 2. 多级上下文压缩 ★★★★★

> 📖 详细源码分析：[自动上下文压缩机制](/codex_docs/context/auto-compact)

Codex 的上下文管理相对简单，没有 Claude Code 那样的 7 层防御。

```
主要策略：
1. 消息历史长度限制
2. 超出时截断旧消息
3. 没有 LLM 摘要机制
4. 依赖模型自身的上下文窗口

原因：Codex 的设计重心在沙箱和安全，不在上下文管理。
它假设大多数编码任务不需要超长会话。
```

---

## 3. 跨会话记忆系统 ★★★★

> 📖 详细源码分析：[agents.md 配置体系](/codex_docs/data/agents-md) | [会话状态持久化](/codex_docs/data/session) | [配置栈架构](/codex_docs/data/config-stack)

### 核心文件：`codex-rs/instructions/`、`codex-rs/config/`

```
Codex 的记忆系统基于配置文件：

1. AGENTS.md（类似 CLAUDE.md）
   - 项目级指令
   - 放在仓库根目录
   - 每次会话开始时加载

2. 配置文件（codex-rs/config/）
   - 用户偏好
   - 模型设置
   - exec policy 规则
   - 持久化到 ~/.codex/

3. 没有自动记忆学习
   - 不像 Claude Code 的 Auto Memory
   - 不像 Hermes 的 memory tool
   - 用户需要手动维护 AGENTS.md

4. 没有 Dream Mode
   - 没有记忆整合循环
   - 没有过期清理
   - 没有矛盾解决
```

---

## 4. 多级错误恢复 ★★★★

> 📖 详细源码分析：[错误恢复与重试机制](/codex_docs/agent/error-recovery)

```
Codex 的错误恢复：

1. 命令执行失败
   - 沙箱捕获错误
   - 错误信息回填给模型
   - 模型决定是否重试

2. API 错误
   - 基础重试逻辑
   - 没有模型 fallback 链

3. 沙箱违规
   - 命令被沙箱阻止
   - 错误信息包含违规原因
   - 用户可以选择放宽沙箱限制

4. 审批超时
   - await_approval_with_cancel() 支持取消
   - 超时后通知 Agent
```

---

## 5. Token Budget 管理 ★★★

> 📖 详细源码分析：[Token 用量估算](/codex_docs/context/token-estimate)

```
Codex 的 token 管理相对简单：
- 基础的 usage 追踪
- 没有跨压缩边界追踪（因为没有压缩）
- 没有成本预算（maxBudgetUsd）
```

---

## 6. 推测执行 ★★★

> 📖 详细源码分析：[沙箱整体架构设计](/codex_docs/sandbox/architecture) | [策略引擎与执行控制](/codex_docs/execpolicy/policy-engine)

### Codex 的沙箱本身就是一种推测执行

```
概念：所有命令在沙箱中执行 = 在隔离环境中"推测"执行

流程：
  1. Agent 决定执行命令
  2. 命令在沙箱中运行（文件系统隔离）
  3. 用户审查结果
  4. 确认 → 变更生效
  5. 拒绝 → 沙箱状态丢弃

与 Claude Code 的 overlay 推测执行类似，但实现层面不同：
  Claude Code: 应用层 overlay（虚拟文件系统）
  Codex: 操作系统级沙箱（landlock/seatbelt）
```

---

## 7. 沙箱 ★★★ — Codex 的核心差异化

> 📖 详细源码分析：[沙箱整体架构设计](/codex_docs/sandbox/architecture) | [macOS Seatbelt 沙箱](/codex_docs/sandbox/seatbelt) | [Linux Landlock 沙箱](/codex_docs/sandbox/landlock) | [网络代理与隔离](/codex_docs/sandbox/network-proxy)

### 核心文件：`codex-rs/sandboxing/`、`codex-rs/exec/`、`codex-rs/execpolicy/`、`go_sandbox/`

这是 Codex 最独特的部分，也是它和其他 Agent Runtime 的核心差异。

### 沙箱架构

```
三层沙箱体系：

Layer 1: Exec Policy（策略层）
  codex-rs/execpolicy/
  - 命令模式匹配
  - always-allow / ask / deny 规则
  - 比 Claude Code 的 allow/deny 更细粒度

Layer 2: OS-Level Sandbox（系统级隔离）
  codex-rs/sandboxing/
  - Linux: landlock + seccomp
  - macOS: seatbelt (App Sandbox)
  - Windows: Windows Sandbox RS

Layer 3: Go Sandbox（额外隔离层）
  go_sandbox/
  - Go 实现的沙箱管理器
  - 策略文件定义允许的操作
  - seatbelt 策略生成
```

### Exec Policy 详解

> 📖 参见：[策略引擎与执行控制](/codex_docs/execpolicy/policy-engine) — 规则匹配与策略级别

```
codex-rs/execpolicy/ 定义了细粒度的命令执行策略：

策略级别：
  sandbox-strict    — 最严格，只允许白名单命令
  sandbox-permissive — 允许大部分命令，限制危险操作
  no-sandbox        — 不隔离（仅用于信任环境）

规则匹配：
  - 基于命令名 + 参数模式
  - 支持通配符
  - 支持正则表达式
  - 第一条匹配的规则生效

示例：
  allow: ["git status", "git diff *", "npm test"]
  ask:   ["git commit *", "npm install *"]
  deny:  ["rm -rf *", "curl *", "wget *"]
```

### Linux 沙箱实现

> 📖 参见：[Linux Landlock 沙箱](/codex_docs/sandbox/landlock) — landlock + seccomp 详细实现

```
codex-rs/linux-sandbox/

使用 landlock + seccomp：

landlock（文件系统隔离）：
  - Linux 5.13+ 内核特性
  - 限制进程可以访问的文件路径
  - 规则：允许读 /usr, /lib, /etc
  - 规则：允许读写 /tmp/codex-sandbox/
  - 规则：禁止访问 ~/.ssh, ~/.aws

seccomp（系统调用过滤）：
  - 限制进程可以使用的系统调用
  - 禁止：ptrace, mount, reboot, ...
  - 允许：read, write, open, close, ...

子进程继承：
  - 所有子进程自动继承沙箱约束
  - 无法通过 fork/exec 逃逸
```

### macOS 沙箱实现

> 📖 参见：[macOS Seatbelt 沙箱](/codex_docs/sandbox/seatbelt) — seatbelt 策略文件与动态生成

```
go_sandbox/seatbelt.go

使用 macOS Seatbelt (App Sandbox)：

seatbelt 策略文件（.sb 格式）：
  (version 1)
  (deny default)                    ; 默认拒绝所有
  (allow file-read* (subpath "/usr"))  ; 允许读 /usr
  (allow file-read-write* (subpath "/tmp/codex"))  ; 允许读写 /tmp/codex
  (allow network-outbound (remote tcp "github.com:443"))  ; 允许访问 github
  (deny network* (local udp))       ; 禁止本地 UDP

策略生成：
  go_sandbox/seatbelt_policies.go
  - 根据 exec policy 动态生成 .sb 文件
  - 不同的命令可以有不同的沙箱策略

执行：
  sandbox-exec -f policy.sb -- command args
```

### 网络隔离

> 📖 参见：[网络代理与隔离](/codex_docs/sandbox/network-proxy) — 域名白名单与数据泄露防护

```
codex-rs/network-proxy/

网络访问控制：
  - 代理所有网络请求
  - 白名单域名检查
  - 阻止未授权的外部访问
  - 防止数据泄露

配置：
  allowedDomains: ["github.com", "*.npmjs.org", "api.openai.com"]
  denyDomains: ["*"]  ; 默认拒绝
```

### 进程加固

```
codex-rs/process-hardening/

额外的安全措施：
  - 禁止 ptrace（防止调试器附加）
  - 限制 /proc 访问
  - 清理环境变量（移除敏感信息）
  - 设置资源限制（CPU、内存、文件描述符）
```

### 审批流程

> 📖 参见：[审批流程设计](/codex_docs/execpolicy/approval-flow) — 完整审批链路与取消机制

```rust
// codex_delegate.rs

async fn handle_exec_approval(codex, delegate, approval) {
    // 1. 检查 exec policy
    let policy_decision = check_exec_policy(&approval.command);
    
    match policy_decision {
        AlwaysAllow => {
            // 自动批准
            codex.approve_exec(approval.id).await;
        }
        Ask => {
            // 展示给用户，等待确认
            let user_decision = await_approval_with_cancel(
                delegate.prompt_user(approval),
                codex.cancellation_token(),
            ).await;
            
            match user_decision {
                Approved => codex.approve_exec(approval.id).await,
                Denied => codex.deny_exec(approval.id).await,
                Cancelled => { /* 用户取消 */ }
            }
        }
        Deny => {
            // 自动拒绝
            codex.deny_exec(approval.id).await;
        }
    }
}

async fn handle_patch_approval(codex, delegate, patch) {
    // 类似流程，但针对文件修改
    // 展示 diff 给用户
    // 用户确认后才应用
}
```

### 与 Claude Code 沙箱的对比

| 维度 | Codex | Claude Code |
|------|-------|------------|
| 实现层面 | 操作系统级（landlock/seatbelt） | 操作系统级（seatbelt/bubblewrap） |
| 语言 | Rust + Go | TypeScript（调用系统命令） |
| 策略粒度 | exec policy（命令级） | allow/deny 规则（工具级） |
| 网络隔离 | 有（network-proxy） | 有（allowedDomains） |
| 进程加固 | 有（process-hardening） | 无 |
| 审批 UI | 事件驱动（handle_exec_approval） | 权限系统（checkPermission） |
| 子进程 | 自动继承沙箱 | 自动继承沙箱 |
| escape hatch | 无（更严格） | 有（dangerouslyDisableSandbox） |

---

## 深入阅读

以下是 Codex 项目文档站中与本文各章节对应的详细源码分析文章：

### Agent 核心架构

- [事件驱动循环架构](/codex_docs/agent/event-loop) — codex_delegate 事件循环、forward_events 分发机制
- [多 Agent 管理机制](/codex_docs/agent/multi-agent) — Agent 注册表、邮箱系统、深度限制
- [错误恢复与重试机制](/codex_docs/agent/error-recovery) — 沙箱错误、API 重试、审批超时处理
- [Hook 系统](/codex_docs/agent/hook-system) — 事件钩子与扩展点

### 上下文管理

- [自动上下文压缩机制](/codex_docs/context/auto-compact) — 消息历史截断策略
- [Token 用量估算](/codex_docs/context/token-estimate) — 基础 usage 追踪

### 数据与记忆

- [agents.md 配置体系](/codex_docs/data/agents-md) — 项目级指令、AGENTS.md 加载机制
- [会话状态持久化](/codex_docs/data/session) — 会话管理与线程状态
- [配置栈架构](/codex_docs/data/config-stack) — 多层配置合并、用户偏好持久化

### 沙箱与安全

- [沙箱整体架构设计](/codex_docs/sandbox/architecture) — 三层沙箱体系总览
- [macOS Seatbelt 沙箱](/codex_docs/sandbox/seatbelt) — seatbelt 策略文件、动态生成
- [Linux Landlock 沙箱](/codex_docs/sandbox/landlock) — landlock + seccomp 实现
- [网络代理与隔离](/codex_docs/sandbox/network-proxy) — 域名白名单、数据泄露防护

### 执行策略

- [策略引擎与执行控制](/codex_docs/execpolicy/policy-engine) — 命令模式匹配、策略级别
- [审批流程设计](/codex_docs/execpolicy/approval-flow) — exec/patch 审批、取消机制
- [权限升级机制](/codex_docs/execpolicy/escalation) — 沙箱限制放宽流程

### 工具与 API

- [Shell 工具实现](/codex_docs/tools/shell-tool) — 命令执行与沙箱集成
- [Apply Patch 工具](/codex_docs/tools/apply-patch) — 文件修改与 diff 审批
- [MCP 集成](/codex_docs/tools/mcp-integration) — MCP 协议支持

### 附录

- [设计模式总结](/codex_docs/appendix/patterns) — Codex 架构模式与最佳实践

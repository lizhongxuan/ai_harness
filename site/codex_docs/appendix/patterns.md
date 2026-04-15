# 设计模式速查表

> 从 Codex 源码中提炼的 12+ 种可复用架构模式

## 1. 事件驱动 Agent Loop

```
模式：match event { ... } 替代 while(true) { if/else }
优势：审批是显式事件，不是副作用
源码：codex_delegate.rs
```

## 2. 三层沙箱体系

```
模式：策略层（应用级）+ 沙箱层（OS 级）+ 网络代理层
优势：纵深防御，任何一层被突破都不会完全失控
源码：execpolicy/ + sandboxing/ + network-proxy/
```

## 3. Starlark 策略引擎

```
模式：用可编程语言（而不是声明式规则）定义安全策略
优势：可以表达条件逻辑、正则匹配、环境检查
源码：codex-rs/execpolicy/
```

## 4. 命令规范化

```
模式：在策略评估前规范化命令（展开别名、解析管道）
优势：防止通过别名或路径变体绕过策略
源码：command_canonicalization.rs
```

## 5. 渐进式权限升级

```
模式：命令被阻止 → 分析原因 → 提供最小化的放宽选项
优势：用户不需要全局放开权限，只放宽需要的部分
源码：exec_policy.rs — try_derive_execpolicy_amendment
```

## 6. Agent 注册表 + 邮箱

```
模式：Agent 在注册表中有唯一标识，通过邮箱异步通信
优势：解耦、可扩展、支持动态添加/移除 Agent
源码：agent/registry.rs + agent/mailbox.rs
```

## 7. 角色系统

```
模式：同一个 Agent 引擎通过角色配置扮演不同角色
优势：复用引擎代码，通过配置改变行为
源码：agent/role.rs
```

## 8. 取消安全的审批

```
模式：tokio::select! { approval OR cancellation }
优势：用户可以随时取消，不会导致状态不一致
源码：codex_delegate.rs — await_approval_with_cancel
```

## 9. Guardian 安全审查

```
模式：在用户审批前，先让独立的 LLM 评估操作安全性
优势：自动过滤明显危险的操作，减少用户审批负担
源码：codex_delegate.rs — spawn_guardian_review
```

## 10. 远程压缩

```
模式：利用 API Provider 的服务端能力做上下文压缩
优势：减少本地 token 消耗
源码：compact_remote.rs
```

## 11. 配置层叠

```
模式：系统 → 用户 → 项目 → 环境变量 → CLI 参数
优势：灵活的配置覆盖，适合团队协作
源码：config/ + config_loader/
```

## 12. 快照测试驱动 UI

```
模式：每次 UI 变更都需要更新 insta 快照
优势：UI 变更可视化审查，防止意外回归
源码：codex-rs/tui/ + cargo-insta
```

## 13. 子进程沙箱继承

```
模式：操作系统级沙箱自动继承到所有子进程
优势：无法通过 fork/exec 逃逸沙箱
源码：seatbelt.rs + landlock.rs
```

## 与 Claude Code 设计模式的对比

| 模式 | Codex | Claude Code |
|------|-------|------------|
| Agent Loop | 事件驱动 | while(true) + State |
| 安全策略 | Starlark（可编程） | allow/deny（声明式） |
| 沙箱 | OS 级 + 网络代理 | OS 级 |
| 上下文压缩 | 2 层 | 7 层 |
| 记忆 | AGENTS.md | CLAUDE.md + Auto Memory + Dream Mode |
| UI | Ratatui（即时模式） | Ink（React 保留模式） |
| 多 Agent | 注册表 + 邮箱 | 子 Agent + Agent Teams |
| 审批 | 事件 + Guardian | 权限系统 + Hooks |

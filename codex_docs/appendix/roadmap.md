# 学习路线

## 推荐路径

### 第一阶段：理解核心架构（1-2 天）

```
1. 快速开始 → 了解项目结构和术语
2. 事件驱动循环 → 理解 Agent Loop 的核心模式
3. 沙箱架构总览 → 理解 Codex 的核心差异化
```

### 第二阶段：深入安全模型（2-3 天）

```
4. macOS Seatbelt → 理解 OS 级沙箱实现
5. Linux Landlock → 理解 Linux 沙箱实现
6. 网络代理隔离 → 理解网络层安全
7. 策略引擎 → 理解 Starlark 策略语言
8. 审批流程 → 理解用户交互
9. 权限升级 → 理解渐进式信任
```

### 第三阶段：工具和上下文（1-2 天）

```
10. Shell 工具 → 理解命令执行
11. Apply-Patch → 理解文件编辑
12. MCP 集成 → 理解外部工具
13. 自动压缩 → 理解上下文管理
```

### 第四阶段：UI 和数据（1 天）

```
14. TUI 架构 → 理解终端 UI
15. 会话持久化 → 理解状态管理
16. 配置层叠 → 理解配置系统
17. AGENTS.md → 理解项目指令
```

### 第五阶段：API 和模式（1 天）

```
18. Responses API → 理解 OpenAI 新 API
19. 多 Agent 系统 → 理解 Agent 协作
20. 设计模式速查 → 提炼可复用模式
```

## 与 Claude Code 学习的互补

```
如果你已经学了 Claude Code：
  重点看 Codex 的差异化部分：
  ├── 沙箱安全（Codex 最强）
  ├── Starlark 策略引擎（比 allow/deny 更强大）
  ├── Rust 实现（性能和安全性）
  ├── Responses API（OpenAI 新 API）
  └── 事件驱动 vs while loop

如果你还没学 Claude Code：
  建议先学 Codex（更简单），再学 Claude Code（更复杂）
  Codex 的上下文管理和记忆系统比 Claude Code 简单得多
  但沙箱和安全模型比 Claude Code 更完善
```

## 面试重点

```
如果面试 Agent Harness 架构师：
  1. 沙箱安全 — Codex 的三层体系是最佳实践
  2. 策略引擎 — Starlark vs 声明式规则的权衡
  3. 事件驱动 vs while loop — 各自的优缺点
  4. Rust vs TypeScript — 性能和安全性的权衡
  5. Responses API vs Messages API — 不同 Provider 的适配
```

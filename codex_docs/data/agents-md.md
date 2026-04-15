# 21. AGENTS.md

> 源码位置: `codex-rs/core/src/instructions/`, `codex-rs/core/src/project_doc.rs`

## 概述

AGENTS.md 是 Codex 的项目级指令文件，类似 Claude Code 的 CLAUDE.md。放在仓库根目录，每次会话开始时自动加载。

## 底层原理

### 加载机制

```rust
// project_doc.rs

// 加载顺序：
// 1. 查找当前目录的 AGENTS.md
// 2. 查找 .codex/ 目录下的指令文件
// 3. 合并到系统提示词中
```

### 内容规范

```markdown
# AGENTS.md 示例

## 项目说明
本项目使用 Rust + TypeScript 混合开发。

## 编码规范
- 使用 `just fmt` 格式化代码
- 模块不超过 500 行
- 优先使用 Stylize helpers

## 测试要求
- 使用 insta 快照测试
- 使用 pretty_assertions
- 避免修改进程环境变量

## 构建命令
- `cargo test -p <crate>` — 运行特定 crate 的测试
- `just fix -p <crate>` — 修复 lint 问题
- `just fmt` — 格式化代码
```

### 与 Claude Code CLAUDE.md 的对比

| 维度 | Codex (AGENTS.md) | Claude Code (CLAUDE.md) |
|------|-------------------|------------------------|
| 文件名 | AGENTS.md | CLAUDE.md |
| 位置 | 仓库根目录 | 沿目录树向上查找 |
| 自动学习 | 无 | Auto Memory |
| 记忆整合 | 无 | Dream Mode |
| 大小限制 | 无明确限制 | 40,000 字符 |

## 关联知识点

- [配置层叠](/data/config-stack) — AGENTS.md 在配置层叠中的位置

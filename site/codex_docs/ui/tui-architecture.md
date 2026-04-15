# 17. TUI 架构

> 源码位置: `codex-rs/tui/`

## 概述

Codex 的终端 UI 使用 **Ratatui**（Rust 的终端 UI 框架）构建，与 Claude Code 使用 Ink（React 终端框架）完全不同。Ratatui 是即时模式渲染，每帧重绘整个界面。

## 底层原理

### 架构

```
codex-rs/tui/
├── src/
│   ├── app.rs              ← 主应用状态和事件循环
│   ├── chatwidget.rs       ← 聊天消息渲染
│   ├── bottom_pane/        ← 底部面板（输入框、状态栏）
│   │   ├── chat_composer.rs ← 消息输入组件
│   │   ├── footer.rs       ← 底部状态栏
│   │   └── mod.rs
│   ├── wrapping.rs         ← 文本换行工具
│   └── styles.md           ← 样式规范
```

### 与 Claude Code UI 的对比

| 维度 | Codex (Ratatui) | Claude Code (Ink) |
|------|----------------|-------------------|
| 框架 | Ratatui（Rust） | Ink（React 终端） |
| 渲染模式 | 即时模式（每帧重绘） | 保留模式（React 虚拟 DOM） |
| 语言 | Rust | TypeScript/JSX |
| 测试 | 快照测试（insta） | React 测试 |
| 性能 | 极高（Rust 原生） | 中等（JS 运行时） |
| 组件模型 | Widget trait | React 组件 |

### 快照测试

```rust
// Codex 使用 insta crate 做 UI 快照测试
// 每次 UI 变更都需要更新快照
// 确保 UI 变更是有意的

// 运行测试：
// cargo test -p codex-tui
// 查看变更：
// cargo insta pending-snapshots -p codex-tui
// 接受变更：
// cargo insta accept -p codex-tui
```

## 关联知识点

- [流式渲染](/codex_docs/ui/streaming) — 模型输出的实时渲染

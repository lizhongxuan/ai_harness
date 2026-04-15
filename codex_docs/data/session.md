# 19. 会话持久化

> 源码位置: `codex-rs/state/`, `codex-rs/core/src/state/`

## 概述

Codex 的会话状态持久化到本地数据库，支持会话恢复和历史查看。

## 底层原理

### 状态存储

```
~/.codex/
├── state/           ← 会话状态数据库
├── config.toml      ← 用户配置
├── exec-policy.star ← 执行策略
└── cache/           ← 缓存
```

### 会话恢复

```
codex resume — 恢复上一次会话
  1. 从状态数据库加载消息历史
  2. 重建 Agent 上下文
  3. 继续对话
```

## 关联知识点

- [配置层叠](/data/config-stack) — 配置文件的加载顺序
- [AGENTS.md](/data/agents-md) — 项目级指令

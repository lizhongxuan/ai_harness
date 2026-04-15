# 13. 内置记忆 Provider

> 源码位置: `agent/builtin_memory_provider.py`, `tools/memory_tool.py`

## 概述

BuiltinMemoryProvider 是 Hermes Agent 的默认记忆后端，使用文件系统存储（`~/.hermes/memory/`）。它提供 `memory` 工具让模型读写持久记忆，以及 `session_search` 工具用于跨会话召回。

## 底层原理

### 存储结构

```
~/.hermes/memory/
├── user_profile.md      ← 用户画像（偏好、环境、习惯）
├── notes/               ← 持久笔记
│   ├── python_tips.md
│   ├── project_config.md
│   └── ...
└── sessions/            ← 会话历史（用于 session_search）
    ├── 2024-01-15_abc123.jsonl
    └── ...
```

### Memory 工具

模型通过 `memory` 工具读写持久记忆：

```mermaid
flowchart LR
    M[模型] -->|memory(action='write', key='python_tips', content='...')| MT[memory_tool]
    MT --> FS[~/.hermes/memory/notes/python_tips.md]
    
    M -->|memory(action='read', key='python_tips')| MT
    MT --> M2[返回文件内容]

    style MT fill:#1a365d,color:#fff
```

### Session Search 工具

```python
# tools/session_search_tool.py
# 搜索过去的会话记录，支持关键词匹配和摘要
```

当用户引用过去对话中的内容时，模型可以使用 `session_search` 工具搜索历史会话，而不是要求用户重复。

### 记忆指导原则

```python
# agent/prompt_builder.py
MEMORY_GUIDANCE = (
    "Save durable facts using the memory tool: user preferences, "
    "environment details, tool quirks, and stable conventions.\n"
    "Prioritize what reduces future user steering — the most valuable "
    "memory is one that prevents the user from having to correct or "
    "remind you again.\n"
    "Do NOT save task progress, session outcomes, completed-work logs..."
)
```

关键原则：
- 保存持久事实（偏好、环境、约定），不保存临时状态
- 优先保存能减少未来用户纠正的信息
- 任务进度和完成日志用 `session_search` 召回，不存入记忆

### Session Search 指导

```python
SESSION_SEARCH_GUIDANCE = (
    "When the user references something from a past conversation or you "
    "suspect relevant cross-session context exists, use session_search "
    "to recall it before asking them to repeat themselves."
)
```

### 与 Claude Code CLAUDE.md 的对比

| 维度 | Hermes Agent 内置记忆 | Claude Code |
|------|---------------------|-------------|
| 存储 | `~/.hermes/memory/` 文件 | CLAUDE.md 文件 |
| 写入方式 | 模型通过 memory 工具 | Auto Memory + Dream Mode |
| 读取方式 | 自动注入 + memory 工具 | 启动时加载 |
| 跨会话搜索 | session_search 工具 | 无 |
| 用户画像 | user_profile.md | 无专用 |
| 指导原则 | MEMORY_GUIDANCE 提示词 | 无显式指导 |

## 设计原因

- **文件系统存储**：简单、可靠、人类可读可编辑。用户可以直接查看和修改 `~/.hermes/memory/` 中的文件
- **记忆 vs 会话搜索分离**：记忆存储持久事实（"用户偏好 Python 3.12"），会话搜索召回临时上下文（"上次我们讨论了什么"）。混合存储会导致记忆膨胀
- **MEMORY_GUIDANCE 提示词**：明确告诉模型什么该存、什么不该存，防止模型把每次对话的细节都写入记忆

## 关联知识点

- [记忆管理器](/memory/manager) — Provider 的注册和编排
- [技能系统](/skills/skill-system) — 技能是另一种持久知识形式
- [双 Agent 循环](/agent/dual-loop) — 记忆在循环中的注入时机

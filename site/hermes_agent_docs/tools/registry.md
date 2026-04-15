# 14. 工具注册表

> 源码位置: `tools/registry.py`

## 概述

ToolRegistry 是 Hermes Agent 工具系统的核心，采用自注册模式：每个工具模块在导入时调用 `registry.register()` 注册自己的 schema、handler 和元数据。`model_tools.py` 触发所有工具模块的导入，然后通过 Registry 提供统一的查询和分发接口。

## 底层原理

### 自注册模式

```mermaid
flowchart TD
    subgraph Discovery["model_tools._discover_tools()"]
        I1[import tools.web_tools]
        I2[import tools.terminal_tool]
        I3[import tools.file_tools]
        I4[import tools.browser_tool]
        I5[import tools.delegate_tool]
        I6[...]
    end

    subgraph Registry["ToolRegistry 单例"]
        R[registry._tools: Dict]
    end

    I1 -->|registry.register('web_search', ...)| R
    I2 -->|registry.register('terminal', ...)| R
    I3 -->|registry.register('read_file', ...)| R
    I4 -->|registry.register('browser_navigate', ...)| R
    I5 -->|registry.register('delegate_task', ...)| R

    R --> API[get_definitions / dispatch]

    style Registry fill:#1a365d,color:#fff
```

### ToolEntry 数据结构

```python
class ToolEntry:
    __slots__ = (
        "name",         # 工具名称
        "toolset",      # 所属 toolset
        "schema",       # OpenAI 格式 JSON Schema
        "handler",      # 执行函数
        "check_fn",     # 可用性检查函数
        "requires_env", # 需要的环境变量
        "is_async",     # 是否异步
        "description",  # 描述
        "emoji",        # 显示用 emoji
    )
```

### 注册接口

```python
registry.register(
    name="web_search",
    toolset="web",
    schema={
        "name": "web_search",
        "description": "Search the web for information",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {"type": "string", "description": "Search query"},
            },
            "required": ["query"],
        },
    },
    handler=web_search_handler,
    check_fn=lambda: bool(os.getenv("SERPER_API_KEY")),
    requires_env=["SERPER_API_KEY"],
    emoji="🔍",
)
```

### check_fn 条件可用性

```python
def get_definitions(self, tool_names, quiet=False):
    for name in sorted(tool_names):
        entry = self._tools.get(name)
        if entry.check_fn:
            if not bool(entry.check_fn()):
                continue  # 跳过不可用的工具
        result.append({"type": "function", "function": schema_with_name})
```

`check_fn` 在每次获取工具定义时执行，动态检查工具是否可用（如 API key 是否配置、服务是否运行）。结果按 check_fn 缓存，同一个 check_fn 只执行一次。

### 分发与异步桥接

```python
def dispatch(self, name, args, **kwargs):
    entry = self._tools.get(name)
    if entry.is_async:
        from model_tools import _run_async
        return _run_async(entry.handler(args, **kwargs))
    return entry.handler(args, **kwargs)
```

异步工具通过 `_run_async()` 桥接到同步上下文。`_run_async` 是工具系统中 sync→async 桥接的单一真相源。

### 反注册（MCP 动态工具）

```python
def deregister(self, name: str) -> None:
    """移除工具。用于 MCP 动态工具发现的 nuke-and-repave。"""
    entry = self._tools.pop(name, None)
    # 如果是 toolset 中最后一个工具，也清理 toolset check
    if not any(e.toolset == entry.toolset for e in self._tools.values()):
        self._toolset_checks.pop(entry.toolset, None)
```

当 MCP server 发送 `notifications/tools/list_changed` 时，先反注册所有旧工具，再重新注册新工具。

### 工具响应序列化辅助

```python
def tool_error(message, **extra) -> str:
    return json.dumps({"error": str(message)}, ensure_ascii=False)

def tool_result(data=None, **kwargs) -> str:
    return json.dumps(data or kwargs, ensure_ascii=False)
```

消除工具文件中重复的 `json.dumps({"error": msg})` 样板代码。

### 与 Claude Code / Codex 工具系统的对比

| 维度 | Hermes Agent | Claude Code | Codex CLI |
|------|-------------|-------------|-----------|
| 注册模式 | 自注册（模块导入时） | buildTool() 声明 | 工具定义文件 |
| 可用性检查 | check_fn 动态检查 | 静态声明 | 静态 |
| 异步支持 | _run_async 桥接 | 原生 async | 原生 async |
| 动态工具 | deregister + re-register | MCP 集成 | MCP 集成 |
| 序列化 | tool_error/tool_result 辅助 | 内置 | 内置 |

## 设计原因

- **自注册模式**：每个工具模块自包含（schema + handler + check_fn），添加新工具只需创建文件并在 `_discover_tools()` 中添加 import，不需要修改中心化的注册表
- **check_fn 动态检查**：工具可用性可能在运行时变化（如用户中途配置 API key），每次获取定义时重新检查
- **_run_async 单一真相源**：避免每个异步工具自己实现 sync→async 桥接，统一处理事件循环冲突（如网关的 async 栈、RL 环境的事件循环）
- **deregister**：MCP 工具列表可能动态变化，需要支持完整的 nuke-and-repave 更新

## 关联知识点

- [工具类型](/hermes_agent_docs/tools/tool-types) — 各类工具的具体实现
- [Toolset 系统](/hermes_agent_docs/skills/toolsets) — 工具的逻辑分组
- [并行工具执行](/hermes_agent_docs/agent/parallel-tools) — 工具的并行安全性

# 20. 配置层叠

> 源码位置: `codex-rs/config/`, `codex-rs/core/src/config/`, `codex-rs/core/src/config_loader/`

## 概述

Codex 的配置系统支持多层叠加，后者覆盖前者。配置文件使用 TOML 格式。

## 底层原理

### 配置层叠顺序

```
1. 内置默认值（代码中硬编码）
2. 系统级配置（/etc/codex/config.toml）
3. 用户级配置（~/.codex/config.toml）
4. 项目级配置（.codex/config.toml）
5. 环境变量覆盖（CODEX_*）
6. 命令行参数覆盖（--model, --sandbox, ...）
```

### 配置内容

```toml
# ~/.codex/config.toml 示例

[model]
name = "o4-mini"
provider = "openai"

[sandbox]
enabled = true
policy = "sandbox-permissive"

[exec_policy]
path = "~/.codex/exec-policy.star"

[network]
allowed_domains = ["github.com", "*.npmjs.org"]
```

### 配置 Schema

```
codex-rs/core/config.schema.json
  - 自动生成的 JSON Schema
  - 用于 IDE 自动补全和验证
  - 运行 `just write-config-schema` 更新
```

## 与 Claude Code 的对比

| 维度 | Codex | Claude Code |
|------|-------|------------|
| 格式 | TOML | JSON |
| 层叠 | 系统 → 用户 → 项目 → 环境变量 → CLI | Managed → User → Project → Local |
| Schema | 自动生成 JSON Schema | 无 |
| 热更新 | 部分支持 | 部分支持 |

## 关联知识点

- [策略引擎](/codex_docs/execpolicy/policy-engine) — 策略文件也是配置的一部分
- [AGENTS.md](/codex_docs/data/agents-md) — 项目级指令

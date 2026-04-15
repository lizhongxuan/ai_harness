# 15. Apply-Patch 工具

> 源码位置: `codex-rs/apply-patch/`

## 概述

Apply-Patch 是 Codex 的文件编辑工具。与 Claude Code 的 FileEdit（基于搜索替换）不同，Codex 使用标准的 **patch/diff 格式**进行文件修改。

## 底层原理

### 工作方式

```
Agent 生成 patch（unified diff 格式）
  │
  ▼
apply-patch crate 解析 patch
  │
  ▼
PatchApproval 事件 → 用户审查 diff
  │
  ▼
用户确认 → 应用 patch 到文件
```

### 与 Claude Code FileEdit 的对比

| 维度 | Codex (Apply-Patch) | Claude Code (FileEdit) |
|------|-------------------|----------------------|
| 格式 | Unified diff | 搜索/替换字符串 |
| 审查体验 | 标准 diff 预览 | 自定义 diff 渲染 |
| 冲突处理 | patch 应用失败 → 报错 | 搜索不到 → 报错 |
| 多文件 | 一个 patch 可以修改多个文件 | 每次只修改一个文件 |

## 关联知识点

- [审批流程](/execpolicy/approval-flow) — Patch 审批

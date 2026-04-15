# 11. 权限升级

> 源码位置: `codex-rs/core/src/exec_policy.rs`, `codex-rs/shell-escalation/`

## 概述

当命令被沙箱或策略阻止时，Codex 提供**渐进式权限升级**机制。用户可以选择为特定命令放宽限制，而不是全局放开。

## 底层原理

### 升级流程

```
命令被阻止
  │
  ▼
分析阻止原因
  ├── 沙箱文件系统限制 → 提供添加路径到白名单的选项
  ├── 沙箱网络限制 → 提供添加域名到白名单的选项
  ├── Exec Policy 拒绝 → 提供添加 allow 规则的选项
  └── 未知原因 → 展示错误信息
  │
  ▼
用户选择升级
  │
  ▼
更新策略（append_amendment_and_update）
  │
  ▼
重试命令
```

### 策略修正推导

```rust
// exec_policy.rs

fn try_derive_execpolicy_amendment_for_allow_rules(
    command_args: &[String],
    evaluation: &Evaluation,
) -> Option<PolicyAmendment> {
    // 从被拒绝的命令推导出最小的 allow 规则
    // 例如：`git push` 被拒绝 → 推导出 allow("git", "push", "*")
    // 而不是 allow("git", "*")（太宽泛）
}

fn prefix_rule_would_approve_all_commands(rule: &Rule) -> bool {
    // 安全检查：如果推导出的规则会允许所有命令 → 拒绝
    // 防止用户意外创建过于宽泛的规则
}
```

## 关联知识点

- [策略引擎](/codex_docs/execpolicy/policy-engine) — 策略评估
- [沙箱架构](/codex_docs/sandbox/architecture) — 沙箱限制

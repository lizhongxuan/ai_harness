# 10. 审批流程

> 源码位置: `codex-rs/core/src/codex_delegate.rs`

## 概述

当 Exec Policy 返回 `prompt`（需要用户确认）时，Codex 展示审批 UI。用户可以批准、拒绝、或选择"始终允许"来更新策略。

## 底层原理

### 审批类型

```
1. ExecApproval — 命令执行审批
   展示：命令内容 + 策略原因
   选项：Allow / Deny / Always Allow

2. PatchApproval — 文件修改审批
   展示：Diff 预览
   选项：Accept / Reject

3. RequestUserInput — 请求用户输入
   展示：Agent 的问题
   选项：自由文本输入

4. RequestPermissions — 权限请求
   展示：需要的权限
   选项：Grant / Deny
```

### 取消安全

```rust
async fn await_approval_with_cancel<F>(
    approval_future: F,
    cancellation_token: CancellationToken,
) -> Result<ApprovalResult> {
    // tokio::select! 确保：
    // - 用户可以随时取消（Ctrl+C）
    // - 取消不会导致状态不一致
    // - 取消后 Agent 收到明确的 Cancelled 信号
    tokio::select! {
        result = approval_future => result,
        _ = cancellation_token.cancelled() => Ok(ApprovalResult::Cancelled),
    }
}
```

## 关联知识点

- [策略引擎](/execpolicy/policy-engine) — 审批前的策略评估
- [事件驱动循环](/agent/event-loop) — 审批事件的处理

# 22. 编码行为约束

> 源码位置: `src/constants/prompts.ts`

## 概述

Claude Code 的 system prompt 中包含一组精心设计的编码行为约束，定义了模型在写代码时应该遵循的原则。这些约束不是泛泛的"写好代码"，而是针对 LLM 常见失败模式的精确对策——每一条都对应一个真实的、反复出现的问题。内部版本（ant）比外部版本多出若干条更严格的约束。

## 底层原理

### 5 条核心约束

#### 约束 1：最小变更原则

> **原文**: "Don't add features, refactor code, or make 'improvements' beyond what was asked. A bug fix doesn't need surrounding code cleaned up. A simple feature doesn't need extra configurability. Don't add docstrings, comments, or type annotations to code you didn't change."

**中文解析**：不要在用户要求之外添加功能、重构代码或做"改进"。修 bug 不需要顺手清理周围代码，简单功能不需要额外的可配置性。不要给你没改的代码加文档字符串、注释或类型注解。

**对应的 LLM 失败模式**：模型倾向于"过度帮忙"——用户让它改一行，它顺手重构了整个文件。这在代码审查中会造成巨大的 diff 噪音，也增加了引入 bug 的风险。

#### 约束 2：拒绝过早抽象

> **原文**: "Don't create helpers, utilities, or abstractions for one-time operations. Don't design for hypothetical future requirements. Three similar lines of code is better than a premature abstraction."

**中文解析**：不要为一次性操作创建辅助函数、工具类或抽象层。不要为假设的未来需求做设计。三行相似的代码好过一个过早的抽象。

**对应的 LLM 失败模式**：模型喜欢"DRY 到极致"——看到两行相似代码就想提取函数。但过早抽象比重复代码更难维护，因为抽象一旦建立就很难移除。

#### 约束 3：先读后改

> **原文**: "In general, do not propose changes to code you haven't read. If a user asks about or wants you to modify a file, read it first. Understand existing code before suggesting modifications."

**中文解析**：不要对你没读过的代码提出修改建议。如果用户要你修改一个文件，先读它。在建议修改之前理解现有代码。

**对应的 LLM 失败模式**：模型可能基于文件名或函数签名"猜测"代码内容，然后生成与实际代码不兼容的修改。

#### 约束 4：诊断后再换方向

> **原文**: "If an approach fails, diagnose why before switching tactics—read the error, check your assumptions, try a focused fix. Don't retry the identical action blindly, but don't abandon a viable approach after a single failure either."

**中文解析**：如果一个方法失败了，先诊断原因再换策略——读错误信息，检查假设，尝试针对性修复。不要盲目重试相同操作，但也不要因为一次失败就放弃可行的方案。

**对应的 LLM 失败模式**：模型遇到错误时有两种极端——要么无脑重试完全相同的操作，要么立刻放弃当前方案换一个全新的。正确做法是分析错误原因，做针对性调整。

#### 约束 5：记录重要信息

> **原文**（来自 `getFunctionResultClearingSection`）: "tool result may be cleared later... write down important information"

**中文解析**：工具结果可能在后续被清理（微压缩），所以重要信息要主动记录下来，不要依赖工具结果一直存在于上下文中。

**对应的 LLM 失败模式**：模型假设之前读过的文件内容会一直在上下文中，但微压缩（L3）会清理旧的工具结果。如果不主动记录关键信息，压缩后就会"忘记"。

### 内部版本 (ant) 的额外约束

源码中通过 `process.env.USER_TYPE === 'ant'` 区分内部和外部版本：

```typescript
const codeStyleSubitems = [
  // 所有用户都有的约束
  `Don't add features beyond what was asked...`,
  `Don't add error handling for scenarios that can't happen...`,
  `Three similar lines is better than a premature abstraction...`,
  // 仅内部用户
  ...(process.env.USER_TYPE === 'ant' ? [
    `Default to writing no comments. Only add one when the WHY is non-obvious...`,
    `Don't explain WHAT the code does, since well-named identifiers already do that...`,
    `Don't remove existing comments unless you're removing the code they describe...`,
    `Before reporting a task complete, verify it actually works...`,
  ] : []),
]
```

| 约束 | 外部版本 | 内部版本 (ant) |
|------|---------|---------------|
| 最小变更 | ✅ | ✅ |
| 拒绝过早抽象 | ✅ | ✅ |
| 先读后改 | ✅ | ✅ |
| 诊断后再换方向 | ✅ | ✅ |
| 默认不写注释 | ❌ | ✅ |
| 不解释 WHAT，只解释 WHY | ❌ | ✅ |
| 不删除已有注释 | ❌ | ✅ |
| 完成前必须验证 | ❌ | ✅ |
| 如实报告结果 | ❌ | ✅ |
| 发现误解主动指出 | ❌ | ✅ |

### 注释哲学的深层设计

内部版本的注释约束特别值得关注，它形成了一个完整的注释哲学：

```
写注释的唯一理由：WHY 不明显
  ├── 隐藏的约束
  ├── 微妙的不变量
  ├── 针对特定 bug 的 workaround
  └── 会让读者惊讶的行为

不写注释的场景：
  ├── 解释 WHAT（好的命名已经做到了）
  ├── 引用当前任务（"added for the Y flow"）
  ├── 引用调用者（"used by X"）
  └── 引用 issue 编号（"handles the case from issue #123"）
      └── 这些属于 PR description，会随代码演进而腐烂
```

## 设计原因

- **对抗 LLM 倾向**：每条约束都针对模型的具体失败模式，而不是泛泛的编码规范
- **内外分层**：外部版本保持简洁，内部版本加入更严格的约束（如注释哲学），可能是因为内部用户对代码质量要求更高
- **可验证性**：约束 4（完成前验证）要求模型实际运行测试，而不是声称"应该能工作"
- **诚实性**：内部版本的"如实报告"约束直接对抗模型的"讨好倾向"——不要为了让用户高兴而隐瞒失败

## 应用场景

::: tip 可借鉴场景
这些约束可以直接复用到你自己的 `CLAUDE.md` 文件中。最有价值的三条：(1) "Three similar lines is better than a premature abstraction"——防止模型过度抽象；(2) "Do not propose changes to code you haven't read"——防止模型凭猜测修改代码；(3) "If an approach fails, diagnose why before switching"——防止模型在方案间无意义跳转。
:::

## 关联知识点

- [风险评估框架](/prompt/risk-framework) — 编码约束的姊妹篇，约束"行动"而非"代码"
- [输出效率指令](/prompt/output-efficiency) — 控制模型的文本输出风格
- [Prompt 分区缓存](/build/prompt-section) — 这些约束位于 system prompt 的静态区
- [CLAUDE.md 发现](/data/claudemd) — 用户可以在 CLAUDE.md 中添加自己的编码约束

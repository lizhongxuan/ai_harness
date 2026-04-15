# 24. 输出效率指令

> 源码位置: `src/constants/prompts.ts` — `getOutputEfficiencySection()`

## 概述

Claude Code 对模型的文本输出风格有明确的指令，但内部版本（ant）和外部版本的指令截然不同。外部版本追求极致简洁——"Go straight to the point"；内部版本则要求详细但结构化的沟通——"Write so they can pick back up cold"。这种差异反映了两种不同的使用场景和用户预期。

## 底层原理

### 外部版本：极致简洁

```typescript
// process.env.USER_TYPE !== 'ant'
function getOutputEfficiencySection(): string {
  return `# Output efficiency

IMPORTANT: Go straight to the point. Try the simplest approach first
without going in circles. Do not overdo it. Be extra concise.

Keep your text output brief and direct. Lead with the answer or action,
not the reasoning. Skip filler words, preamble, and unnecessary transitions.
Do not restate what the user said — just do it.

Focus text output on:
- Decisions that need the user's input
- High-level status updates at natural milestones
- Errors or blockers that change the plan

If you can say it in one sentence, don't use three.`
}
```

核心原则：**先行动，后解释（如果需要的话）**。

### 内部版本：假设用户已离开

```typescript
// process.env.USER_TYPE === 'ant'
function getOutputEfficiencySection(): string {
  return `# Communicating with the user
When sending user-facing text, you're writing for a person, not logging
to a console. Assume users can't see most tool calls or thinking - only
your text output.

When making updates, assume the person has stepped away and lost the thread.
They don't know codenames, abbreviations, or shorthand you created along
the way, and didn't track your process. Write so they can pick back up cold:
use complete, grammatically correct sentences without unexplained jargon.

Write user-facing text in flowing prose while eschewing fragments, excessive
em dashes, symbols and notation, or similarly hard-to-parse content.

Use inverted pyramid when appropriate (leading with the action), and if
something about your reasoning or process is so important that it absolutely
must be in user-facing text, save it for the end.`
}
```

核心原则：**假设读者已经离开，回来时需要从零理解**。

### 两个版本的对比

| 维度 | 外部版本 | 内部版本 (ant) |
|------|---------|---------------|
| 标题 | Output efficiency | Communicating with the user |
| 核心指令 | "Go straight to the point" | "Write so they can pick back up cold" |
| 假设 | 用户在屏幕前实时看 | 用户可能已经离开 |
| 推理过程 | "Lead with the answer, not the reasoning" | "Save reasoning for the end" |
| 详细程度 | "If you can say it in one sentence, don't use three" | "Err on the side of more explanation" |
| 格式 | 不限制 | "Flowing prose"，避免 fragments 和 em dashes |
| 表格使用 | 不限制 | 仅用于短的可枚举事实，不要在表格里塞解释 |
| 术语 | 不限制 | "Expand technical terms"，不用未解释的缩写 |
| 用户水平 | 不区分 | "Attend to cues about expertise level" |
| 适用范围 | 不适用于代码和工具调用 | 不适用于代码和工具调用 |

### "假设用户已离开"写作原则

内部版本的核心设计理念可以用一句话概括：

> "Assume the person has stepped away and lost the thread."

这意味着每次输出都应该是自包含的：
1. 不依赖用户记住之前的上下文
2. 不使用过程中创造的缩写或代号
3. 用完整的句子，不用片段
4. 技术术语要展开解释

### 倒金字塔结构 (Inverted Pyramid)

内部版本要求使用新闻写作中的"倒金字塔"结构：

```
┌─────────────────────────────┐
│  最重要的信息（行动/结论）    │  ← 第一句话
├─────────────────────────────┤
│  支撑细节                    │  ← 必要的上下文
├─────────────────────────────┤
│  推理过程（如果必须说的话）   │  ← 放在最后
└─────────────────────────────┘
```

这样即使用户只读第一句话，也能获得最关键的信息。

### 何时输出更新

两个版本在"什么时候该说话"上有共识：

```typescript
// 外部版本明确列出三种场景
`Focus text output on:
- Decisions that need the user's input
- High-level status updates at natural milestones
- Errors or blockers that change the plan`

// 内部版本用更自然的语言描述
`Before your first tool call, briefly state what you're about to do.
While working, give short updates at key moments:
when you find something load-bearing (a bug, a root cause),
when changing direction,
when you've made progress without an update.`
```

### 源码中的版本切换

```typescript
function getOutputEfficiencySection(): string {
  if (process.env.USER_TYPE === 'ant') {
    return `# Communicating with the user
    ...详细版本...`
  }
  return `# Output efficiency
  ...简洁版本...`
}
```

这个函数位于 system prompt 的静态区，会被 prompt cache 缓存。

## 设计原因

- **场景适配**：外部用户通常在终端前实时交互，需要快速反馈；内部用户可能在后台运行长任务，回来时需要理解发生了什么
- **对抗 LLM 倾向**：外部版本对抗模型的"啰嗦"倾向；内部版本对抗模型的"过度简洁"和"使用未定义缩写"倾向
- **可读性优先**：内部版本明确说"What's most important is the reader understanding your output without mental overhead"——理解优先于简洁
- **代码豁免**：两个版本都明确说"This does not apply to code or tool calls"——输出效率指令只约束自然语言，不约束代码

## 应用场景

::: tip 可借鉴场景
根据你的使用场景选择合适的版本。如果用户实时交互，用外部版本的"Go straight to the point"；如果用户可能离开后回来查看结果，用内部版本的"Write so they can pick back up cold"。倒金字塔结构和"假设用户已离开"原则可以直接写入你的 agent 的 system prompt 或 CLAUDE.md。
:::

## 关联知识点

- [编码行为约束](/prompt/coding-prompt) — 约束代码风格，输出效率约束文本风格
- [Prompt 分区缓存](/build/prompt-section) — 输出效率指令位于静态区，被 cache 缓存
- [Feature Flag 消除](/build/feature-flag) — `USER_TYPE === 'ant'` 是一种运行时 feature flag

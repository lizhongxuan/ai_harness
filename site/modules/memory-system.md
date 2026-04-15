# 跨会话记忆系统 ★★★★

## 模块概述

跨会话记忆系统解决的是 Agent 的"长期记忆"问题——如何让 Agent 在多次会话之间保持对用户偏好、项目状态和历史决策的记忆。这是从"一次性对话工具"进化为"持续协作伙伴"的关键能力。

四个项目在记忆系统的设计上差异巨大：

- **Claude Code** 选择了 Markdown 文件 + 索引的极简方案，配合 Dream Mode（梦境模式）在空闲时自动整合记忆，同时维护 CLAUDE.md（用户规则）和 Auto Memory（Agent 学习）两套系统
- **Codex CLI** 采用 AGENTS.md 配置文件 + 基础配置持久化，没有自动记忆学习机制
- **Vercel AI SDK** 不提供任何内置记忆系统，完全由使用者自行实现
- **Hermes Agent** 实现了插件化的 MemoryManager，支持内置 Provider 和外部 Provider（如 Honcho），配合记忆上下文围栏防止注入

理解记忆系统的设计权衡——特别是"存储 vs 维护"、"Markdown vs 向量数据库"、"显式规则 vs 隐式学习"——是面试中的高频考点。


---

## 面试题

### 基础概念题

#### Q3.1 ⭐ Claude Code 的记忆系统用 Markdown 文件而不是向量数据库。为什么？这个设计决策的优缺点是什么？

<details>
<summary>查看答案</summary>

Claude Code 选择 Markdown 文件 + 索引的理由：

| 维度 | Markdown 文件 | 向量数据库 |
|------|-------------|-----------|
| LLM 兼容性 | LLM 天生擅长读写文本 | 需要额外的 embedding → 检索 → 注入流程 |
| 人类可读 | 直接打开就能看、能编辑 | 需要专门的查询工具 |
| 维护成本 | 零依赖，文件系统即存储 | 需要运行数据库服务 |
| 调试性 | `cat memory.md` 就能看 | 需要查询 API |
| 版本控制 | 可以 git 管理 | 不友好 |
| 精确性 | 原文保留，无信息损失 | embedding 是有损压缩 |
| 检索能力 | 弱（需要全文搜索或 LLM 辅助） | 强（语义相似度搜索） |
| 扩展性 | 文件太大时性能下降 | 可以处理大量数据 |

核心洞察：**瓶颈不是存储，而是维护**。

向量数据库解决的是"怎么存"和"怎么找"的问题。但 Agent 记忆的真正难题是"怎么维护"——过期的记忆要删除、矛盾的记忆要解决、分散的记忆要整合。Dream Mode 就是解决维护问题的。

**什么时候应该用向量数据库？**
- 记忆量极大（数万条）
- 需要跨用户的知识库检索
- 需要模糊语义匹配（"类似的问题之前怎么解决的"）

**什么时候 Markdown 就够了？**
- 单用户的个人记忆
- 记忆量可控（索引 < 25KB）
- 记忆结构相对固定（用户偏好、项目状态、反馈）

</details>

#### Q3.2 解释 Claude Code 的四种记忆类型：user / feedback / project / reference。每种类型存什么？怎么用？

<details>
<summary>查看答案</summary>

| 类型 | 存什么 | 示例 | 怎么用 |
|------|--------|------|--------|
| user | 用户身份、角色、目标、偏好 | "高级后端工程师，偏好函数式风格，用 Vim" | 定制交互风格和建议 |
| feedback | 用户的纠正和偏好规则 | "不要在代码中加注释" / "测试用 Vitest 不用 Jest" | 规则优先展示，附带 Why + How |
| project | 项目状态、进行中的工作、决策 | "正在重构 auth 模块，截止日期 4/20" | 跨会话保持项目上下文 |
| reference | 外部系统指针 | "Linear 项目: ABC-123" / "Grafana 面板: /d/xxx" | 跨工具导航 |

feedback 类型的特殊设计：

```markdown
## Rule: 不要在代码中加注释
- Why: 用户认为好的代码应该自解释
- How: 除非逻辑非常复杂且不明显，否则不加注释
- Source: 用户在 2026-04-10 的会话中明确要求
```

规则优先，然后是为什么和怎么应用。这样即使记忆被压缩，规则本身不会丢失。

</details>

#### Q3.3 什么是 Dream Mode（梦境模式）？它的 4 个阶段分别做什么？为什么需要一个专门的记忆整合循环？

<details>
<summary>查看答案</summary>

Dream Mode 是 Claude Code 的记忆整合机制，在 Agent 空闲时运行。

**为什么需要专门的整合循环？**

记忆会随时间"腐烂"：
- 相对日期过期："昨天" 在一周后就没意义了
- 信息分散：同一个主题的记忆散落在多个日志中
- 矛盾累积：用户改了偏好但旧记忆还在
- 索引膨胀：不断追加导致索引超过 25KB 限制

**4 阶段详解：**

**Phase 1: Orient（定向）— "我有什么记忆？"**
- 操作：ls 记忆目录、读 ENTRYPOINT.md 索引、浏览现有主题文件的标题
- 目的：了解当前记忆的全貌，避免创建重复文件

**Phase 2: Gather（收集）— "最近发生了什么？"**
- 操作：检查每日日志（logs/2026/04/）、窄范围 grep JSONL 转录
- 目的：发现需要整合的新信息
- 关键："Don't exhaustively read transcripts. Look only for things you already suspect matter."

**Phase 3: Consolidate（整合）— "把新信息合并进去"**
- 操作：合并新内容到现有主题文件、相对日期 → 绝对日期（"昨天" → "2026-04-13"）、删除被矛盾的旧事实、更新 ENTRYPOINT.md 索引
- 目的：保持记忆的一致性和时效性

**Phase 4: Prune（修剪）— "清理过期的东西"**
- 操作：索引保持 < 25KB、删除过期指针、解决文件间的矛盾、删除超过 30 天未访问的记忆
- 目的：防止记忆无限膨胀

</details>

#### Q3.4 CLAUDE.md 和 Auto Memory 有什么区别？谁写的？范围是什么？为什么需要两套系统？

<details>
<summary>查看答案</summary>

| 维度 | CLAUDE.md | Auto Memory |
|------|-----------|-------------|
| 谁写的 | 用户手动编写 | Claude 自动学习 |
| 范围 | 项目/用户/组织 | 每个工作树（git worktree） |
| 内容 | 稳定规则、架构笔记、编码标准 | 构建命令、调试模式、反复纠正 |
| 生命周期 | 长期稳定 | 随使用演化 |
| 加载方式 | 沿目录树向上查找并合并 | 会话开始时自动加载 |
| 压缩后存活 | 是（每次 compact 后重新加载） | 是 |
| 可编辑 | 用户直接编辑文件 | 用户可以编辑，但主要由 Claude 维护 |

**为什么需要两套？**

```
CLAUDE.md = 宪法（用户制定的规则，不可违反）
Auto Memory = 经验（Claude 学到的模式，可以演化）
```

例子：
- CLAUDE.md: "本项目用 TypeScript strict mode，测试用 Vitest"
- Auto Memory: "npm test 需要先 npm run build" / "用户不喜欢 console.log 调试"

CLAUDE.md 是显式的、确定的、用户控制的；Auto Memory 是隐式的、渐进的、Agent 学习的。

</details>


### 设计题

#### Q3.5 ⭐ 设计一个跨会话记忆系统，要求支持四种记忆类型、索引机制、定期整合、索引大小上限、记忆过期和矛盾解决

<details>
<summary>查看答案</summary>

```typescript
// === 数据结构 ===

type MemoryType = 'user' | 'feedback' | 'project' | 'reference';

interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  createdAt: string;          // ISO 日期（绝对日期）
  lastAccessedAt: string;
  expiresAt?: string;         // 可选过期时间
  tags: string[];
  source: string;             // 来源会话 ID
}

interface MemoryIndex {
  version: number;
  lastUpdated: string;
  entries: Array<{
    id: string;
    type: MemoryType;
    summary: string;          // 一行摘要
    filePath: string;         // 指向详细文件
    tags: string[];
  }>;
}

// === 核心接口 ===

class MemoryStore {
  private indexPath = 'memory/ENTRYPOINT.md';
  private maxIndexSize = 25 * 1024; // 25KB
  
  // CRUD
  async create(entry: MemoryEntry): Promise<void> {
    const filePath = `memory/${entry.type}/${entry.id}.md`;
    await this.writeMemoryFile(filePath, entry);
    await this.updateIndex(entry, 'add');
  }
  
  async read(id: string): Promise<MemoryEntry | null> {
    const indexEntry = this.index.entries.find(e => e.id === id);
    if (!indexEntry) return null;
    const entry = await this.readMemoryFile(indexEntry.filePath);
    entry.lastAccessedAt = new Date().toISOString();
    return entry;
  }
  
  async update(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    const entry = await this.read(id);
    if (!entry) throw new Error(`Memory ${id} not found`);
    Object.assign(entry, updates);
    await this.writeMemoryFile(`memory/${entry.type}/${id}.md`, entry);
    await this.updateIndex(entry, 'update');
  }
  
  async delete(id: string): Promise<void> {
    await this.updateIndex({ id } as MemoryEntry, 'remove');
  }
  
  // 检索
  async search(query: string, type?: MemoryType): Promise<MemoryEntry[]> {
    const matches = this.index.entries
      .filter(e => !type || e.type === type)
      .filter(e => e.summary.toLowerCase().includes(query.toLowerCase())
                || e.tags.some(t => t.includes(query)));
    return Promise.all(matches.map(m => this.readMemoryFile(m.filePath)));
  }
  
  // Dream Mode 整合
  async dreamConsolidate(): Promise<void> {
    // Phase 1: Orient — 了解当前记忆全貌
    const index = await this.loadIndex();
    const existingTopics = index.entries.map(e => e.summary);
    
    // Phase 2: Gather — 发现需要整合的新信息
    const recentLogs = await this.getRecentLogs(7);
    const newFacts = this.extractFacts(recentLogs);
    
    // Phase 3: Consolidate — 合并新信息
    for (const fact of newFacts) {
      const existing = await this.findRelated(fact);
      if (existing) {
        await this.mergeInto(existing, fact);
      } else {
        await this.create(fact);
      }
    }
    await this.normalizeAllDates();      // 相对日期 → 绝对日期
    await this.resolveContradictions();  // 删除矛盾
    
    // Phase 4: Prune — 清理过期内容
    await this.pruneExpired();
    await this.enforceIndexSizeLimit();
  }
  
  private async enforceIndexSizeLimit(): Promise<void> {
    let indexContent = await this.serializeIndex();
    while (Buffer.byteLength(indexContent) > this.maxIndexSize) {
      const oldest = this.index.entries
        .sort((a, b) => a.lastAccessedAt.localeCompare(b.lastAccessedAt))[0];
      this.index.entries = this.index.entries.filter(e => e.id !== oldest.id);
      indexContent = await this.serializeIndex();
    }
  }
}
```

</details>

#### Q3.6 🔥 设计 sideQuery 语义检索机制：什么是 sideQuery？检索方式？结果注入？Token 成本控制？

<details>
<summary>查看答案</summary>

**什么是 sideQuery？**

sideQuery 是在主对话之外做的一次检索查询。它的结果注入到上下文中，但检索过程本身不污染主对话历史。

```
主对话: 用户 → Agent → 工具 → Agent → 用户
                ↓
          sideQuery（独立的检索调用）
                ↓
          结果注入到下一轮的系统消息中
```

**为什么不直接把记忆塞进主上下文？**

1. **记忆太多，塞不下：** 100 条记忆 × 200 tokens = 20,000 tokens，占用上下文窗口的 10%，但大部分和当前任务无关
2. **噪音干扰：** 不相关的记忆会分散模型的注意力，模型可能被旧的、过时的记忆误导
3. **缓存失效：** 每次会话的记忆不同 → 系统提示词变化 → prompt cache 失效

**检索方式：**

| 方案 | 特点 | 适用场景 |
|------|------|---------|
| 关键词匹配（Claude Code 的选择） | 简单、快速、零成本 | 结构化的记忆（标签、类型分类） |
| 嵌入向量检索 | 语义匹配，需要 embedding API 调用 | 大规模记忆 |
| LLM 辅助检索 | 最智能但最贵，需要额外 LLM 调用 | 复杂查询 |

**结果注入方式：**

```typescript
async function injectSideQueryResults(
  messages: Message[], query: string
): Promise<Message[]> {
  // 1. 在独立上下文中检索（不污染主对话）
  const results = await memoryStore.search(query);
  if (results.length === 0) return messages;
  
  // 2. 控制注入量（最多 2,000 tokens）
  const budgetTokens = 2000;
  let injected = '';
  let tokensUsed = 0;
  for (const result of results) {
    const tokens = countTokens(result.content);
    if (tokensUsed + tokens > budgetTokens) break;
    injected += `\n- [${result.type}] ${result.content}`;
    tokensUsed += tokens;
  }
  
  // 3. 注入到系统消息中（不是用户消息）
  const systemMsg = messages.find(m => m.role === 'system')!;
  systemMsg.content += `\n\n[Relevant memories]\n${injected}`;
  return messages;
}
```

Hermes Agent 的做法类似：用 `<memory-context>` 标签包裹记忆内容，并标记为 `"[System note: recalled memory context, NOT new user input]"`，防止模型把记忆当作用户输入。

</details>

#### Q3.7 你的记忆系统中，两条记忆互相矛盾（比如"用户偏好 tabs"和"用户偏好 spaces"）。怎么检测和解决矛盾？

<details>
<summary>查看答案</summary>

**检测方法：**

1. **同一主题的记忆，内容不同：** "用户偏好 tabs" vs "用户偏好 spaces"。检测方式：同一 tag/type 下的记忆，关键词冲突
2. **时间戳比较：** 更新的记忆通常更准确。"2026-04-01: 偏好 tabs" vs "2026-04-10: 偏好 spaces" → 以 4/10 的为准

**解决策略：**

| 策略 | 适用场景 | 说明 |
|------|---------|------|
| Last-Write-Wins（最后写入胜出） | 用户偏好类记忆 | 最简单，保留最新的，删除旧的 |
| 合并（Merge） | 项目状态类记忆 | "项目 A 进度 50%" + "项目 A 新增了模块 B" → "项目 A 进度 50%，新增了模块 B" |
| 询问用户（Human-in-the-loop） | 关键决策类记忆 | "检测到矛盾：你之前说用 tabs，最近又用了 spaces。哪个是对的？" |

</details>

#### Q3.8 💡 Dream Mode 的 Consolidate 阶段需要把相对日期转换为绝对日期（"昨天" → "2026-04-13"）。为什么这很重要？如果不做会怎样？

<details>
<summary>查看答案</summary>

**问题：** "昨天" 在不同时间点意味着不同的日期。

```
会话 1 (4/10): "昨天部署了 v2.0" → 实际是 4/9
会话 2 (4/15): 读到记忆 "昨天部署了 v2.0"
  → 模型理解为 4/14 部署了 v2.0 ❌
  → 实际是 4/9 部署的
```

**如果不转换：**
- 记忆随时间"漂移"，含义不断变化
- 模型基于错误的时间线做决策
- 项目截止日期、部署时间等关键信息全部失真

**转换后：**
- "2026-04-09 部署了 v2.0" → 永远准确，不管什么时候读

这就是 Dream Mode Consolidate 阶段的关键操作之一。

</details>


### 编码题

#### Q3.9 用 TypeScript 设计记忆系统的数据结构和核心接口：MemoryStore 类、四种记忆类型的 CRUD、索引管理、Dream Mode 的 4 阶段整合流程

<details>
<summary>查看答案</summary>

核心数据结构已在 Q3.5 中给出，这里补充 Dream Mode 的完整 4 阶段实现：

```typescript
class DreamMode {
  constructor(private store: MemoryStore) {}
  
  async run(): Promise<DreamReport> {
    const report: DreamReport = {
      oriented: 0, gathered: 0, consolidated: 0, pruned: 0
    };
    
    // Phase 1: Orient — 了解当前记忆全貌
    const index = await this.store.loadIndex();
    const existingTopics = new Set(
      index.entries.map(e => `${e.type}:${e.tags.join(',')}`)
    );
    report.oriented = index.entries.length;
    
    // Phase 2: Gather — 窄范围搜索最近日志
    const recentLogs = await this.store.getRecentLogs(7);
    const newFacts: MemoryEntry[] = [];
    for (const log of recentLogs) {
      const facts = await this.extractFactsNarrowly(log, existingTopics);
      newFacts.push(...facts);
    }
    report.gathered = newFacts.length;
    
    // Phase 3: Consolidate — 合并新信息
    for (const fact of newFacts) {
      // 相对日期 → 绝对日期
      fact.content = this.normalizeDates(fact.content, fact.createdAt);
      
      const related = await this.store.search(fact.tags[0], fact.type);
      if (related.length > 0) {
        await this.mergeMemory(related[0], fact);
      } else {
        await this.store.create(fact);
      }
      report.consolidated++;
    }
    await this.resolveContradictions();
    
    // Phase 4: Prune — 清理过期内容
    const expired = index.entries.filter(e => 
      e.expiresAt && new Date(e.expiresAt) < new Date()
    );
    for (const entry of expired) {
      await this.store.delete(entry.id);
      report.pruned++;
    }
    await this.store.enforceIndexSizeLimit();
    
    return report;
  }
  
  private normalizeDates(content: string, referenceDate: string): string {
    const ref = new Date(referenceDate);
    return content
      .replace(/昨天|yesterday/gi,
        this.formatDate(new Date(ref.getTime() - 86400000)))
      .replace(/今天|today/gi, this.formatDate(ref))
      .replace(/上周|last week/gi,
        this.formatDate(new Date(ref.getTime() - 7 * 86400000)));
  }
  
  private formatDate(d: Date): string {
    return d.toISOString().split('T')[0]; // "2026-04-13"
  }
}
```

**关键设计点：**
- Phase 2 的 Gather 是窄范围搜索，不读完整转录（太大了），只找已知可能重要的信息
- Phase 3 的日期规范化是防止记忆"漂移"的关键操作
- Phase 4 的索引大小限制（25KB）通过删除最旧、最少访问的条目来维持

</details>

---

## 跨项目对比

| 维度 | Claude Code | Codex CLI | Vercel AI SDK | Hermes Agent |
|------|------------|-----------|---------------|-------------|
| **存储方式** | Markdown 文件 + 索引（[CLAUDE.md 持久化配置](/claude_code_docs/data/claudemd)） | 配置文件（[AGENTS.md](/codex_docs/data/agents-md)） | 无内置 | 文件系统 + 插件（[记忆管理器](/hermes_agent_docs/memory/manager)） |
| **自动学习** | Auto Memory（Claude 自动学习用户偏好和项目模式） | 无 | 无 | 内置 Provider（模型可调用 memory tool 主动存储） |
| **记忆整合** | Dream Mode（4 阶段：Orient → Gather → Consolidate → Prune） | 无自动整合 | 无 | 无自动整合 |
| **语义检索** | sideQuery（关键词匹配 + LLM 辅助） | 无 | 无 | prefetch（关键词匹配，每轮开始时预取） |
| **插件化** | 无（单一 Markdown 后端） | 无 | 无 | 有（最多 1 个外部 Provider，如 Honcho） |
| **跨会话持久化** | 有（[会话数据管理](/claude_code_docs/data/session)） | 有限（[会话状态持久化](/codex_docs/data/session)） | 无 | 有 |
| **记忆注入方式** | 系统消息注入 | 系统消息注入 | N/A | `<memory-context>` 标签 + 系统注释围栏 |
| **记忆类型** | 4 种（user / feedback / project / reference） | 1 种（项目指令） | N/A | 通用键值对 |
| **索引机制** | ENTRYPOINT.md（< 25KB） | 无 | N/A | 无显式索引 |
| **矛盾解决** | Dream Mode Consolidate 阶段处理 | 无 | N/A | 无 |
| **设计哲学** | "记忆即维护"——存储简单，维护复杂 | "够用就好"——配置文件即记忆 | "留给使用者" | "可扩展的插件生态" |

---

## 设计模式与权衡

### 模式 1：Markdown 文件记忆（File-Based Memory）

- **描述：** 用纯文本文件（Markdown）作为记忆存储，LLM 直接读写文件内容
- **使用项目：** Claude Code（Memory Directory + CLAUDE.md）、Codex CLI（AGENTS.md）
- **权衡：** 零依赖、人类可读、LLM 原生兼容，但检索能力弱、扩展性有限；适合单用户、记忆量可控的场景

### 模式 2：插件化记忆后端（Pluggable Memory Provider）

- **描述：** 记忆存储后端可替换，通过统一接口支持不同的存储实现
- **使用项目：** Hermes Agent（BuiltinMemoryProvider + 外部 Provider）
- **权衡：** 灵活性高，可以接入向量数据库或对话记忆平台（如 Honcho），但增加了架构复杂度；限制最多 1 个外部 Provider 防止工具 schema 膨胀

### 模式 3：双轨记忆系统（Dual-Track Memory）

- **描述：** 同时维护"用户显式规则"和"Agent 隐式学习"两套记忆
- **使用项目：** Claude Code（CLAUDE.md = 宪法 + Auto Memory = 经验）
- **权衡：** 用户保持控制权的同时 Agent 能渐进学习，但需要明确的优先级规则（CLAUDE.md 优先于 Auto Memory）

### 模式 4：记忆上下文围栏（Memory Context Fencing）

- **描述：** 用特殊标签包裹记忆内容，防止模型把记忆当作用户输入或新指令
- **使用项目：** Hermes Agent（`<memory-context>` 标签 + "[System note: recalled memory context, NOT new user input]"）
- **权衡：** 有效防止记忆注入攻击和上下文污染，但依赖模型遵守标签语义

### 模式 5：空闲时整合（Idle-Time Consolidation）

- **描述：** 在 Agent 空闲时运行记忆整合循环，而不是在每次会话中实时整合
- **使用项目：** Claude Code（Dream Mode）
- **权衡：** 不影响会话性能，但记忆更新有延迟；整合过程本身消耗 token（需要 LLM 参与）

---

## 答题策略

### 推荐答题结构

1. **先讲核心挑战**（30 秒）：记忆系统的难点不是"怎么存"，而是"怎么维护"——过期清理、矛盾解决、索引膨胀控制
2. **再讲设计选择**（2 分钟）：对比 Markdown vs 向量数据库，引用 Claude Code 的 "Do the simple thing first" 哲学；讲解双轨系统（CLAUDE.md + Auto Memory）的设计理由
3. **最后讲维护机制**（1 分钟）：Dream Mode 的 4 阶段整合流程，特别是日期规范化和矛盾解决

### 常见追问方向

- "Markdown 记忆太原始了，为什么不用向量数据库？"
  - 回答要点：瓶颈不是存储而是维护；Markdown 零依赖、人类可读、LLM 原生兼容；向量数据库适合大规模跨用户场景
- "记忆矛盾怎么解决？"
  - 回答要点：三种策略——Last-Write-Wins（偏好类）、Merge（状态类）、Human-in-the-loop（关键决策类）
- "sideQuery 和直接塞进上下文有什么区别？"
  - 回答要点：sideQuery 不污染主对话历史、有 token 预算控制、结果注入到系统消息而非用户消息

### 关键源码引用

- Claude Code 记忆目录：`memdir/`、`services/SessionMemory/`
- Claude Code Dream Mode：`services/autoDream/`、`services/extractMemories/`
- Claude Code CLAUDE.md 加载：沿目录树向上查找并合并
- Codex AGENTS.md：`codex-rs/instructions/`
- Hermes Agent 记忆管理器：`agent/memory_manager.py`、`agent/builtin_memory_provider.py`
- Hermes Agent 记忆工具：`tools/memory_tool.py`

---

## 深入阅读

### Claude Code

- [CLAUDE.md 持久化配置](/claude_code_docs/data/claudemd) — CLAUDE.md 的加载机制、目录层叠、与 Auto Memory 的优先级关系
- [会话数据管理](/claude_code_docs/data/session) — 会话状态持久化、Dream Mode 整合循环、记忆索引管理

### Codex CLI

- [会话状态持久化](/codex_docs/data/session) — Codex 的会话数据管理和状态恢复机制
- [agents.md 配置体系](/codex_docs/data/agents-md) — AGENTS.md 的加载、层叠和项目级指令管理

### Hermes Agent

- [记忆管理器架构](/hermes_agent_docs/memory/manager) — MemoryManager 的插件化设计、内置 Provider、生命周期钩子、记忆上下文围栏
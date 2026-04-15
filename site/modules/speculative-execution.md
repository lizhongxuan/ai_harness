# 推测执行 ★★★

## 模块概述

推测执行（Speculative Execution）是 Agent Runtime 中通过预测用户意图、提前在隔离层执行操作来减少交互等待时间的优化机制——它借鉴了 CPU 推测执行的思想，在用户确认之前先在 overlay 层完成操作，确认后原子提交，拒绝时完整回滚。

四个项目在推测执行上的投入差异显著：

- **Codex CLI** 是推测执行的最佳实践——所有命令在沙箱容器中执行，沙箱有独立的 overlay 文件系统，执行完成后用户审查变更，确认后才同步到宿主文件系统。这本质上就是系统级的推测执行
- **Claude Code** 没有显式的推测执行机制，但其 Checkpoint 系统（每次文件编辑前创建快照）提供了类似的回滚能力
- **Vercel AI SDK** 作为框架不内置推测执行，但 `experimental_prepareStep` 等 API 为使用者提供了实现推测的扩展点
- **Hermes Agent** 没有推测执行机制，依赖容器级隔离（Docker/Modal）提供基础的环境隔离

理解推测执行的关键在于：**它是 human-in-the-loop 和执行效率之间的桥梁**。没有推测执行时，用户确认和操作执行是串行的；有了推测执行，两者可以并行——用户在审查 diff 的同时，操作已经在 overlay 层完成了。

---

## 面试题

### 基础概念题

#### Q6.1 ⭐ 什么是推测执行（Speculative Execution）在 Agent 上下文中的含义？和 CPU 的推测执行有什么类比？

<details>
<summary>查看答案</summary>

CPU 推测执行的类比：

```
CPU 推测执行:
  - CPU 预测分支方向，提前执行预测路径的指令
  - 预测正确 → 省了等待时间
  - 预测错误 → 丢弃结果，回滚到分支点

Agent 推测执行:
  - Agent 预测用户会确认当前操作，提前在 overlay 层执行
  - 用户确认 → 直接提交，省了等待时间
  - 用户拒绝 → 丢弃 overlay，回滚到执行前状态
```

核心价值：**减少 human-in-the-loop 的等待时间**。

```
没有推测执行:
  Agent 决定编辑文件 → 等待用户确认 → 用户确认 → 开始编辑 → 完成
  总时间: 确认等待 + 编辑时间

有推测执行:
  Agent 决定编辑文件 → 同时: overlay 层开始编辑 + 等待用户确认
  用户确认 → 直接提交 overlay 结果
  总时间: max(确认等待, 编辑时间) ← 并行了
```

</details>

#### Q6.2 Overlay 预执行是什么？为什么不直接执行然后回滚？

<details>
<summary>查看答案</summary>

```
直接执行后回滚的问题:
  1. 不可逆操作: rm -rf 执行后无法回滚
  2. 副作用: 发送了 HTTP 请求、写了数据库、发了邮件
  3. 并发冲突: 执行期间其他进程也在修改文件
  4. 用户感知: 用户看到文件被改了又改回来，体验差

Overlay 的优势:
  1. 隔离: 所有操作在虚拟层执行，真实文件系统不受影响
  2. 安全: 即使操作失败，也不影响真实环境
  3. 预览: 用户可以看到 diff，决定是否接受
  4. 原子性: 提交是原子的——要么全部应用，要么全部不应用
```

</details>

#### Q6.3 Codex CLI 的沙箱执行模型和推测执行有什么关系？

<details>
<summary>查看答案</summary>

Codex CLI 的沙箱模型是推测执行的一种实现方式：

```
Codex CLI:
  - 所有代码在沙箱容器中执行
  - 沙箱有独立的文件系统（overlay filesystem）
  - 执行完成后，用户审查变更
  - 确认后才把变更同步到宿主文件系统

这本质上就是推测执行:
  - 沙箱 = overlay 层
  - 容器文件系统 = 快照
  - 用户审查 = 确认/拒绝
  - 同步到宿主 = 提交
```

Codex 的沙箱实现使用了系统级隔离技术：
- **Linux**: Landlock + Bubblewrap + Seccomp（内核级文件系统、命名空间和系统调用隔离）
- **macOS**: Seatbelt（App Sandbox，内核级）

这比纯应用层的 overlay 更安全——即使 Agent 执行了恶意代码，也无法逃逸沙箱。exec policy 进一步控制了哪些命令可以在沙箱中执行。

</details>

### 设计题

#### Q6.4 ⭐ 设计一个 Overlay 推测执行系统

<details>
<summary>查看答案</summary>

```typescript
interface FileChange {
  path: string;
  type: 'create' | 'modify' | 'delete';
  oldContent?: string;  // modify/delete 时保存原内容
  newContent?: string;  // create/modify 时的新内容
}

class OverlayFS {
  private changes = new Map<string, FileChange>();
  
  // 在 overlay 层读文件（优先读 overlay，fallback 到真实 FS）
  async read(path: string): Promise<string> {
    const change = this.changes.get(path);
    if (change?.type === 'delete') throw new Error('File deleted in overlay');
    if (change?.newContent !== undefined) return change.newContent;
    return await realFS.readFile(path, 'utf-8'); // fallback 到真实 FS
  }
  
  // 在 overlay 层写文件
  async write(path: string, content: string): Promise<void> {
    const oldContent = await this.safeRead(path);
    this.changes.set(path, {
      path,
      type: oldContent !== null ? 'modify' : 'create',
      oldContent: oldContent ?? undefined,
      newContent: content,
    });
  }
  
  async delete(path: string): Promise<void> {
    const oldContent = await this.safeRead(path);
    this.changes.set(path, {
      path, type: 'delete', oldContent: oldContent ?? undefined
    });
  }
  
  // 生成 diff
  getDiff(): string {
    let diff = '';
    for (const change of this.changes.values()) {
      diff += `--- ${change.path}\n`;
      if (change.type === 'create')
        diff += `+++ NEW FILE\n${change.newContent}\n`;
      else if (change.type === 'delete')
        diff += `+++ DELETED\n`;
      else
        diff += generateUnifiedDiff(change.oldContent!, change.newContent!);
    }
    return diff;
  }
  
  // 提交到真实 FS
  async commit(): Promise<void> {
    for (const change of this.changes.values()) {
      switch (change.type) {
        case 'create':
        case 'modify':
          await realFS.writeFile(change.path, change.newContent!);
          break;
        case 'delete':
          await realFS.unlink(change.path);
          break;
      }
    }
    this.changes.clear();
  }
  
  // 回滚（直接清空 overlay）
  rollback(): void {
    this.changes.clear();
  }
}

class SpeculativeExecutor {
  private overlayStack: OverlayFS[] = []; // 支持多步推测
  
  async speculateStep(action: AgentAction): Promise<{
    diff: string;
    overlay: OverlayFS;
  }> {
    const overlay = new OverlayFS();
    this.overlayStack.push(overlay);
    
    // 在 overlay 层执行操作
    await this.executeInOverlay(action, overlay);
    
    return { diff: overlay.getDiff(), overlay };
  }
  
  async commitAll(): Promise<void> {
    // 按顺序提交所有 overlay 层
    for (const overlay of this.overlayStack) {
      await overlay.commit();
    }
    this.overlayStack = [];
  }
  
  rollbackAll(): void {
    this.overlayStack.forEach(o => o.rollback());
    this.overlayStack = [];
  }
  
  // 回滚最后一步
  rollbackLast(): void {
    this.overlayStack.pop()?.rollback();
  }
}
```

**设计要点：**

- **OverlayFS 读写分层：** 读操作优先查 overlay，miss 时 fallback 到真实文件系统
- **多步推测：** overlayStack 支持连续预测 2-3 步，每步独立回滚或全部提交
- **原子提交：** commit 按顺序应用所有 overlay 层的变更
- **零成本回滚：** rollback 只需清空 Map，不需要恢复文件

</details>

#### Q6.5 🔥 推测执行中，Agent 预测要修改文件 A，但在 overlay 层执行时发现文件 A 已经被另一个进程修改了（并发冲突）。怎么处理？

<details>
<summary>查看答案</summary>

```
检测: 提交前检查文件是否被外部修改

async commit(): Promise<void> {
  for (const change of this.changes.values()) {
    if (change.type === 'modify') {
      // 检查文件是否在推测期间被外部修改
      const currentContent = await realFS.readFile(change.path, 'utf-8');
      if (currentContent !== change.oldContent) {
        throw new ConflictError(change.path, {
          expected: change.oldContent,
          actual: currentContent,
          proposed: change.newContent,
        });
      }
    }
  }
  // 无冲突，执行提交
  ...
}

处理冲突的策略:
  1. 通知用户，展示三方 diff（原始 / 外部修改 / Agent 修改）
  2. 让用户选择: 保留外部修改 / 保留 Agent 修改 / 手动合并
  3. 或者: 基于外部修改后的版本重新执行推测
```

**关键洞察：** 并发冲突检测的时机是提交时（乐观锁），而不是执行时。这和数据库的乐观并发控制（OCC）是同一个思路——先执行，提交时检查版本号（这里是文件内容）。

</details>

#### Q6.6 推测执行的置信度怎么评估？什么情况下应该跳过推测直接执行？什么情况下应该强制推测？

<details>
<summary>查看答案</summary>

```
高置信度（应该推测）:
  - 只读操作（Read, Grep）→ 无副作用，推测零风险
  - 小范围编辑（改一行代码）→ 回滚成本低
  - 用户之前确认过类似操作 → 历史模式匹配

低置信度（应该等待确认）:
  - 删除操作 → 不可逆
  - 大范围重构 → 回滚成本高
  - 涉及外部系统（API 调用、数据库写入）→ 有副作用
  - 首次执行某类操作 → 没有历史模式

跳过推测直接执行:
  - 用户在 auto 模式下
  - 操作在 allow 白名单中
  - 操作是只读的

强制推测（即使在 auto 模式下）:
  - 操作在 "always confirm" 列表中
  - 影响范围超过阈值（如修改 > 5 个文件）
```

**面试回答策略：** 用"风险矩阵"来组织回答——横轴是操作的可逆性，纵轴是影响范围。高风险高影响 = 强制推测，低风险低影响 = 跳过推测。

</details>

#### Q6.7 💡 设计推测执行的快照机制

<details>
<summary>查看答案</summary>

```
快照包含:
  - 文件内容（受影响的文件）
  - git 状态（当前 HEAD、是否有未提交的变更）
  - 不包含环境变量（推测执行不应该修改环境）

存储位置:
  - 小快照（< 1MB）: 内存
  - 大快照（> 1MB）: 磁盘临时文件
  - 也可以用 git stash（如果在 git 仓库中）

多步推测的快照管理:
  - 链式快照: 每步保存增量 diff，回滚时逆序应用
  - 优于完整快照: 节省空间，支持逐步回滚
  
  Step 1 快照: { files: { 'a.ts': oldContent } }
  Step 2 快照: { files: { 'b.ts': oldContent } }  // 只保存 step 2 改的文件
  
  回滚 step 2: 恢复 b.ts
  回滚 step 1: 恢复 a.ts
  回滚全部: 恢复 a.ts + b.ts
```

**设计要点：**

- **增量快照 vs 完整快照：** 增量快照只保存每步变更的文件，空间效率高；完整快照保存所有文件状态，回滚更简单但空间开销大
- **git stash 作为快照后端：** 在 git 仓库中，`git stash` 是天然的快照机制，支持命名、列表、逐个恢复
- **快照过期：** 推测执行完成（提交或回滚）后立即清理快照，避免磁盘泄漏

</details>

### 编码题

#### Q6.8 用 TypeScript 实现 SpeculativeExecutor 类

<details>
<summary>查看答案</summary>

（核心代码已在 Q6.4 中给出，包含 OverlayFS、快照、diff、提交和回滚。这里补充完整的 SpeculativeExecutor 使用流程）

```typescript
// 使用示例
async function agentLoopWithSpeculation(agent: Agent) {
  const executor = new SpeculativeExecutor();
  
  while (true) {
    const action = await agent.decideNextAction();
    
    if (action.type === 'done') break;
    
    if (shouldSpeculate(action)) {
      // 推测执行：在 overlay 层执行，等待用户确认
      const { diff } = await executor.speculateStep(action);
      
      // 展示 diff 给用户
      const userDecision = await promptUser({
        message: `Agent 想要执行以下操作：`,
        diff,
        options: ['确认', '拒绝', '修改后确认'],
      });
      
      switch (userDecision) {
        case '确认':
          await executor.commitAll();
          break;
        case '拒绝':
          executor.rollbackAll();
          break;
        case '修改后确认':
          executor.rollbackAll();
          // 让用户手动编辑后继续
          break;
      }
    } else {
      // 直接执行（auto 模式或只读操作）
      await executeDirectly(action);
    }
  }
}

function shouldSpeculate(action: AgentAction): boolean {
  // 只读操作不需要推测
  if (isReadOnly(action)) return false;
  // auto 模式下不推测
  if (isAutoMode()) return false;
  // 在 allow 白名单中不推测
  if (isAllowed(action)) return false;
  // 其他情况推测执行
  return true;
}
```

**关键设计点：**

- **OverlayFS 的读写分层：** 读操作先查 overlay Map，miss 时 fallback 到真实文件系统，保证推测期间的读写一致性
- **多步推测的栈式管理：** overlayStack 支持逐步回滚（rollbackLast）或全部回滚（rollbackAll）
- **并发冲突检测：** 提交时用乐观锁检查文件是否被外部修改，冲突时展示三方 diff

</details>

---

## 跨项目对比

| 维度 | Claude Code | Codex CLI | Vercel AI SDK | Hermes Agent |
|------|------------|-----------|---------------|-------------|
| **推测执行机制** | 无显式推测执行 | 沙箱即推测执行（[沙箱架构](/codex_docs/sandbox/architecture)） | 无内置 | 无 |
| **Overlay 实现** | 无 | OS 级 overlay filesystem（Landlock/Seatbelt） | 无 | 无（依赖容器隔离） |
| **快照机制** | Checkpoint（每次编辑前快照） | 沙箱容器文件系统快照 | 无 | 无 |
| **Diff 预览** | 有（编辑前展示 diff） | 有（沙箱执行后展示变更） | 无 | 无 |
| **回滚能力** | Checkpoint 回滚（文件级） | 沙箱丢弃（容器级） | 无 | 无 |
| **多步推测** | 不支持 | 支持（沙箱内连续执行多步） | 无 | 无 |
| **并发冲突检测** | 无 | 沙箱隔离避免冲突 | 无 | 无 |
| **执行策略控制** | 权限系统（allow/deny/ask） | exec policy（Starlark）（[策略引擎](/codex_docs/execpolicy/policy-engine)） | 无 | 基础审批 |
| **设计哲学** | "先执行，Checkpoint 兜底" | "沙箱隔离，确认后提交" | "使用者自行实现" | "容器隔离，够用就好" |

---

## 设计模式与权衡

### 模式 1：Overlay 文件系统（Overlay Filesystem）

- **描述：** 在真实文件系统之上建立虚拟层，所有写操作记录在 overlay 中，读操作优先查 overlay、miss 时 fallback 到真实 FS。提交时原子应用所有变更，回滚时直接清空 overlay
- **使用项目：** Codex CLI（OS 级 overlay）
- **权衡：** 完美的隔离性和原子性，回滚零成本；但 overlay 层的文件操作有额外开销，且不支持非文件系统的副作用（网络请求、数据库写入）

### 模式 2：乐观并发控制（Optimistic Concurrency Control）

- **描述：** 推测执行时不加锁，提交时检查文件是否被外部修改（比较 oldContent 和当前内容）。冲突时展示三方 diff，让用户决定合并策略
- **使用项目：** Codex CLI（沙箱隔离天然避免冲突）
- **权衡：** 无锁执行性能好，但冲突检测和解决增加了复杂度；在高并发场景下冲突率可能较高

### 模式 3：链式增量快照（Chained Incremental Snapshots）

- **描述：** 多步推测时，每步只保存该步变更的文件（增量 diff），回滚时逆序应用。比完整快照节省空间，支持逐步回滚
- **使用项目：** 通用模式（Codex 的沙箱容器天然支持）
- **权衡：** 空间效率高，支持精细的逐步回滚；但增量快照的依赖链可能导致回滚顺序错误，需要严格的栈式管理

### 模式 4：置信度驱动的推测决策（Confidence-Driven Speculation）

- **描述：** 根据操作的可逆性、影响范围、历史确认模式评估置信度，高置信度时推测执行，低置信度时等待确认。只读操作和 auto 模式下跳过推测
- **使用项目：** 通用模式
- **权衡：** 在安全性和效率之间取得平衡；但置信度评估的准确性依赖于历史数据和启发式规则，可能出现误判

### 模式 5：沙箱即推测执行（Sandbox-as-Speculation）

- **描述：** 将系统级沙箱（Seatbelt/Landlock）作为推测执行的实现基础——沙箱容器就是 overlay 层，容器文件系统就是快照，用户审查就是确认/拒绝，同步到宿主就是提交
- **使用项目：** Codex CLI
- **权衡：** 最强的隔离保证（OS 级），即使恶意代码也无法逃逸；但沙箱启动有开销，且跨平台实现成本高（macOS/Linux 各需不同实现）

---

## 答题策略

### 推荐答题结构

1. **先讲类比**（30 秒）：用 CPU 推测执行类比——预测分支方向、提前执行、预测正确省时间、预测错误回滚。Agent 推测执行同理：预测用户确认、overlay 层提前执行、确认后提交、拒绝后回滚
2. **再讲 Overlay 设计**（2 分钟）：说明 OverlayFS 的读写分层、diff 生成、原子提交和零成本回滚。引用 Codex 的沙箱模型作为系统级实现
3. **最后讲权衡**（1 分钟）：推测执行的适用场景（文件操作 vs 网络请求）、置信度评估、并发冲突处理

### 常见追问方向

- "推测执行和 git stash 有什么区别？"
  - 回答要点：git stash 是文件级快照，推测执行的 overlay 是操作级隔离。git stash 需要手动管理，overlay 自动跟踪所有变更。git stash 不支持多步推测的逐步回滚
- "如果推测执行的操作有网络副作用怎么办？"
  - 回答要点：纯 overlay 无法隔离网络副作用。Codex 的方案是网络代理层——沙箱内的网络请求被重定向到本地代理，代理可以缓存响应或阻止请求。对于数据库写入等副作用，需要事务级隔离（begin/rollback）
- "多步推测时，后续步骤依赖前面步骤的结果怎么办？"
  - 回答要点：overlay 栈的读写分层解决了这个问题——后续步骤读文件时，先查当前 overlay，再查前面步骤的 overlay，最后 fallback 到真实 FS。这保证了多步推测的读写一致性

### 关键源码引用

- Codex 沙箱架构：`codex-rs/sandboxing/` — 沙箱即推测执行的系统级实现
- Codex 策略引擎：`codex-rs/execpolicy/` — 控制哪些操作可以在沙箱中推测执行
- Codex Seatbelt：`codex-rs/core/src/seatbelt.rs` — macOS 上的 overlay 隔离实现
- Codex Landlock：`codex-rs/core/src/landlock.rs` — Linux 上的 overlay 隔离实现

---

## 深入阅读

### Codex CLI

- [沙箱架构与推测执行](/codex_docs/sandbox/architecture) — Codex 三层沙箱体系如何实现系统级推测执行，包括 overlay 文件系统、子进程继承、与 Claude Code 的对比
- [策略引擎与执行控制](/codex_docs/execpolicy/policy-engine) — Starlark 可编程策略如何控制推测执行的范围，渐进式权限升级机制的详细分析

import{_ as s,o as n,c as e,a2 as p}from"./chunks/framework.D6tuaLBS.js";const u=JSON.parse('{"title":"学习路线","description":"","frontmatter":{},"headers":[],"relativePath":"codex_docs/appendix/roadmap.md","filePath":"codex_docs/appendix/roadmap.md"}'),l={name:"codex_docs/appendix/roadmap.md"};function i(t,a,o,d,c,h){return n(),e("div",null,[...a[0]||(a[0]=[p(`<h1 id="学习路线" tabindex="-1">学习路线 <a class="header-anchor" href="#学习路线" aria-label="Permalink to &quot;学习路线&quot;">​</a></h1><h2 id="推荐路径" tabindex="-1">推荐路径 <a class="header-anchor" href="#推荐路径" aria-label="Permalink to &quot;推荐路径&quot;">​</a></h2><h3 id="第一阶段-理解核心架构-1-2-天" tabindex="-1">第一阶段：理解核心架构（1-2 天） <a class="header-anchor" href="#第一阶段-理解核心架构-1-2-天" aria-label="Permalink to &quot;第一阶段：理解核心架构（1-2 天）&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>1. 快速开始 → 了解项目结构和术语</span></span>
<span class="line"><span>2. 事件驱动循环 → 理解 Agent Loop 的核心模式</span></span>
<span class="line"><span>3. 沙箱架构总览 → 理解 Codex 的核心差异化</span></span></code></pre></div><h3 id="第二阶段-深入安全模型-2-3-天" tabindex="-1">第二阶段：深入安全模型（2-3 天） <a class="header-anchor" href="#第二阶段-深入安全模型-2-3-天" aria-label="Permalink to &quot;第二阶段：深入安全模型（2-3 天）&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>4. macOS Seatbelt → 理解 OS 级沙箱实现</span></span>
<span class="line"><span>5. Linux Landlock → 理解 Linux 沙箱实现</span></span>
<span class="line"><span>6. 网络代理隔离 → 理解网络层安全</span></span>
<span class="line"><span>7. 策略引擎 → 理解 Starlark 策略语言</span></span>
<span class="line"><span>8. 审批流程 → 理解用户交互</span></span>
<span class="line"><span>9. 权限升级 → 理解渐进式信任</span></span></code></pre></div><h3 id="第三阶段-工具和上下文-1-2-天" tabindex="-1">第三阶段：工具和上下文（1-2 天） <a class="header-anchor" href="#第三阶段-工具和上下文-1-2-天" aria-label="Permalink to &quot;第三阶段：工具和上下文（1-2 天）&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>10. Shell 工具 → 理解命令执行</span></span>
<span class="line"><span>11. Apply-Patch → 理解文件编辑</span></span>
<span class="line"><span>12. MCP 集成 → 理解外部工具</span></span>
<span class="line"><span>13. 自动压缩 → 理解上下文管理</span></span></code></pre></div><h3 id="第四阶段-ui-和数据-1-天" tabindex="-1">第四阶段：UI 和数据（1 天） <a class="header-anchor" href="#第四阶段-ui-和数据-1-天" aria-label="Permalink to &quot;第四阶段：UI 和数据（1 天）&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>14. TUI 架构 → 理解终端 UI</span></span>
<span class="line"><span>15. 会话持久化 → 理解状态管理</span></span>
<span class="line"><span>16. 配置层叠 → 理解配置系统</span></span>
<span class="line"><span>17. AGENTS.md → 理解项目指令</span></span></code></pre></div><h3 id="第五阶段-api-和模式-1-天" tabindex="-1">第五阶段：API 和模式（1 天） <a class="header-anchor" href="#第五阶段-api-和模式-1-天" aria-label="Permalink to &quot;第五阶段：API 和模式（1 天）&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>18. Responses API → 理解 OpenAI 新 API</span></span>
<span class="line"><span>19. 多 Agent 系统 → 理解 Agent 协作</span></span>
<span class="line"><span>20. 设计模式速查 → 提炼可复用模式</span></span></code></pre></div><h2 id="与-claude-code-学习的互补" tabindex="-1">与 Claude Code 学习的互补 <a class="header-anchor" href="#与-claude-code-学习的互补" aria-label="Permalink to &quot;与 Claude Code 学习的互补&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>如果你已经学了 Claude Code：</span></span>
<span class="line"><span>  重点看 Codex 的差异化部分：</span></span>
<span class="line"><span>  ├── 沙箱安全（Codex 最强）</span></span>
<span class="line"><span>  ├── Starlark 策略引擎（比 allow/deny 更强大）</span></span>
<span class="line"><span>  ├── Rust 实现（性能和安全性）</span></span>
<span class="line"><span>  ├── Responses API（OpenAI 新 API）</span></span>
<span class="line"><span>  └── 事件驱动 vs while loop</span></span>
<span class="line"><span></span></span>
<span class="line"><span>如果你还没学 Claude Code：</span></span>
<span class="line"><span>  建议先学 Codex（更简单），再学 Claude Code（更复杂）</span></span>
<span class="line"><span>  Codex 的上下文管理和记忆系统比 Claude Code 简单得多</span></span>
<span class="line"><span>  但沙箱和安全模型比 Claude Code 更完善</span></span></code></pre></div><h2 id="面试重点" tabindex="-1">面试重点 <a class="header-anchor" href="#面试重点" aria-label="Permalink to &quot;面试重点&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>如果面试 Agent Harness 架构师：</span></span>
<span class="line"><span>  1. 沙箱安全 — Codex 的三层体系是最佳实践</span></span>
<span class="line"><span>  2. 策略引擎 — Starlark vs 声明式规则的权衡</span></span>
<span class="line"><span>  3. 事件驱动 vs while loop — 各自的优缺点</span></span>
<span class="line"><span>  4. Rust vs TypeScript — 性能和安全性的权衡</span></span>
<span class="line"><span>  5. Responses API vs Messages API — 不同 Provider 的适配</span></span></code></pre></div>`,16)])])}const b=s(l,[["render",i]]);export{u as __pageData,b as default};

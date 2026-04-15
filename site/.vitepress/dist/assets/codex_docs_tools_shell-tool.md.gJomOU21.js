import{_ as a,o as n,c as l,a2 as e}from"./chunks/framework.D6tuaLBS.js";const k=JSON.parse('{"title":"14. Shell 工具","description":"","frontmatter":{},"headers":[],"relativePath":"codex_docs/tools/shell-tool.md","filePath":"codex_docs/tools/shell-tool.md"}'),p={name:"codex_docs/tools/shell-tool.md"};function i(t,s,c,o,h,r){return n(),l("div",null,[...s[0]||(s[0]=[e(`<h1 id="_14-shell-工具" tabindex="-1">14. Shell 工具 <a class="header-anchor" href="#_14-shell-工具" aria-label="Permalink to &quot;14. Shell 工具&quot;">​</a></h1><blockquote><p>源码位置: <code>codex-rs/core/src/shell.rs</code>, <code>codex-rs/core/src/exec.rs</code>, <code>codex-rs/core/src/sandboxing/</code></p></blockquote><h2 id="概述" tabindex="-1">概述 <a class="header-anchor" href="#概述" aria-label="Permalink to &quot;概述&quot;">​</a></h2><p>Shell 工具是 Codex 最核心的工具——执行终端命令。每次执行都经过 Exec Policy 检查 + 沙箱隔离。</p><h2 id="底层原理" tabindex="-1">底层原理 <a class="header-anchor" href="#底层原理" aria-label="Permalink to &quot;底层原理&quot;">​</a></h2><h3 id="执行流程" tabindex="-1">执行流程 <a class="header-anchor" href="#执行流程" aria-label="Permalink to &quot;执行流程&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Agent 请求执行命令</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ▼</span></span>
<span class="line"><span>1. 命令规范化（command_canonicalization.rs）</span></span>
<span class="line"><span>   - 展开别名</span></span>
<span class="line"><span>   - 解析管道和链接</span></span>
<span class="line"><span>   - 标准化路径</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ▼</span></span>
<span class="line"><span>2. Exec Policy 评估（exec_policy.rs）</span></span>
<span class="line"><span>   - Starlark 策略引擎评估</span></span>
<span class="line"><span>   - 返回 allow / prompt / deny</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ▼</span></span>
<span class="line"><span>3. 用户审批（如果需要）</span></span>
<span class="line"><span>   - 展示命令内容和原因</span></span>
<span class="line"><span>   - 等待用户决定</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ▼</span></span>
<span class="line"><span>4. 沙箱执行（sandboxing/）</span></span>
<span class="line"><span>   - macOS: Seatbelt</span></span>
<span class="line"><span>   - Linux: Landlock + Bubblewrap</span></span>
<span class="line"><span>   - 文件系统和网络隔离</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ▼</span></span>
<span class="line"><span>5. 结果收集</span></span>
<span class="line"><span>   - stdout / stderr</span></span>
<span class="line"><span>   - 退出码</span></span>
<span class="line"><span>   - 执行时间</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ▼</span></span>
<span class="line"><span>6. 结果返回给 Agent</span></span></code></pre></div><h3 id="shell-检测" tabindex="-1">Shell 检测 <a class="header-anchor" href="#shell-检测" aria-label="Permalink to &quot;Shell 检测&quot;">​</a></h3><div class="language-rust vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">rust</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// shell_detect.rs</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// Codex 自动检测用户的 shell 环境：</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// - bash / zsh / fish / sh</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// - 用于正确设置命令执行环境</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// - 确保 PATH 和其他环境变量正确</span></span></code></pre></div><h3 id="shell-快照" tabindex="-1">Shell 快照 <a class="header-anchor" href="#shell-快照" aria-label="Permalink to &quot;Shell 快照&quot;">​</a></h3><div class="language-rust vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">rust</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// shell_snapshot.rs</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// 在命令执行前后捕获 shell 状态：</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// - 环境变量变化</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// - 工作目录变化</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// - 用于调试和审计</span></span></code></pre></div><h2 id="关联知识点" tabindex="-1">关联知识点 <a class="header-anchor" href="#关联知识点" aria-label="Permalink to &quot;关联知识点&quot;">​</a></h2><ul><li><a href="/ai_harness/codex_docs/sandbox/architecture.html">沙箱架构</a> — 命令在沙箱中执行</li><li><a href="/ai_harness/codex_docs/execpolicy/policy-engine.html">策略引擎</a> — 命令执行前的策略检查</li></ul>`,13)])])}const u=a(p,[["render",i]]);export{k as __pageData,u as default};

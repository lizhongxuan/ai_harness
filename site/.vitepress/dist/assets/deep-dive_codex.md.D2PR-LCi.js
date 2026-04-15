import{_ as a,o as n,c as i,ag as e}from"./chunks/framework.BMy1X8j3.js";const r=JSON.parse('{"title":"OpenAI Codex 源码深度剖析","description":"","frontmatter":{"title":"OpenAI Codex 源码深度剖析"},"headers":[],"relativePath":"deep-dive/codex.md","filePath":"deep-dive/codex.md"}'),p={name:"deep-dive/codex.md"};function l(t,s,h,d,c,o){return n(),i("div",null,[...s[0]||(s[0]=[e(`<h1 id="openai-codex-源码深度剖析" tabindex="-1">OpenAI Codex 源码深度剖析 <a class="header-anchor" href="#openai-codex-源码深度剖析" aria-label="Permalink to &quot;OpenAI Codex 源码深度剖析&quot;">​</a></h1><blockquote><p>基于开源仓库 codex-rs/（Rust 核心）和 codex-cli/（TypeScript CLI），逐模块拆解</p></blockquote><div class="tip custom-block"><p class="custom-block-title">知识点导航</p><p>本文涉及的 Codex 源码分析文章：</p><ul><li><a href="/ai_harness/codex_docs/agent/event-loop.html">事件驱动循环架构</a> — Agent Loop 核心架构</li><li><a href="/ai_harness/codex_docs/agent/multi-agent.html">多 Agent 管理机制</a> — Agent 注册表与邮箱系统</li><li><a href="/ai_harness/codex_docs/context/auto-compact.html">自动上下文压缩机制</a> — 上下文管理策略</li><li><a href="/ai_harness/codex_docs/context/token-estimate.html">Token 用量估算</a> — Token Budget 管理</li><li><a href="/ai_harness/codex_docs/data/session.html">会话状态持久化</a> — 会话管理</li><li><a href="/ai_harness/codex_docs/data/agents-md.html">agents.md 配置体系</a> — 项目级指令配置</li><li><a href="/ai_harness/codex_docs/data/config-stack.html">配置栈架构</a> — 多层配置合并</li><li><a href="/ai_harness/codex_docs/agent/error-recovery.html">错误恢复与重试机制</a> — 错误恢复链路</li><li><a href="/ai_harness/codex_docs/sandbox/architecture.html">沙箱整体架构设计</a> — 三层沙箱体系</li><li><a href="/ai_harness/codex_docs/sandbox/seatbelt.html">macOS Seatbelt 沙箱</a> — macOS 沙箱实现</li><li><a href="/ai_harness/codex_docs/sandbox/landlock.html">Linux Landlock 沙箱</a> — Linux 沙箱实现</li><li><a href="/ai_harness/codex_docs/sandbox/network-proxy.html">网络代理与隔离</a> — 网络访问控制</li><li><a href="/ai_harness/codex_docs/execpolicy/policy-engine.html">策略引擎与执行控制</a> — Exec Policy 详解</li><li><a href="/ai_harness/codex_docs/execpolicy/approval-flow.html">审批流程设计</a> — 命令审批机制</li></ul></div><hr><h2 id="_1-状态机-agent-loop-★★★★★" tabindex="-1">1. 状态机 Agent Loop ★★★★★ <a class="header-anchor" href="#_1-状态机-agent-loop-★★★★★" aria-label="Permalink to &quot;1. 状态机 Agent Loop ★★★★★&quot;">​</a></h2><blockquote><p>📖 详细源码分析：<a href="/ai_harness/codex_docs/agent/event-loop.html">事件驱动循环架构</a> | <a href="/ai_harness/codex_docs/agent/multi-agent.html">多 Agent 管理机制</a></p></blockquote><h3 id="核心文件-codex-rs-core-src-codex-delegate-rs、codex-rs-exec-src-lib-rs" tabindex="-1">核心文件：<code>codex-rs/core/src/codex_delegate.rs</code>、<code>codex-rs/exec/src/lib.rs</code> <a class="header-anchor" href="#核心文件-codex-rs-core-src-codex-delegate-rs、codex-rs-exec-src-lib-rs" aria-label="Permalink to &quot;核心文件：\`codex-rs/core/src/codex_delegate.rs\`、\`codex-rs/exec/src/lib.rs\`&quot;">​</a></h3><p>Codex 的 Agent Loop 是<strong>事件驱动</strong>的，不是简单的 while loop。核心用 Rust 实现，通过 async/await + channel 通信。</p><h3 id="架构概览" tabindex="-1">架构概览 <a class="header-anchor" href="#架构概览" aria-label="Permalink to &quot;架构概览&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>codex-rs 架构：</span></span>
<span class="line"><span></span></span>
<span class="line"><span>用户输入</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ▼</span></span>
<span class="line"><span>codex-rs/exec/ → CLI 入口</span></span>
<span class="line"><span>  │ interactive mode → run_codex_thread_interactive()</span></span>
<span class="line"><span>  │ one-shot mode   → run_codex_thread_one_shot()</span></span>
<span class="line"><span>  ▼</span></span>
<span class="line"><span>codex-rs/core/ → 核心引擎</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ├── codex_delegate.rs → 事件循环 + 审批处理</span></span>
<span class="line"><span>  │     forward_events() → 接收 agent 事件</span></span>
<span class="line"><span>  │     handle_exec_approval() → 命令执行审批</span></span>
<span class="line"><span>  │     handle_patch_approval() → 文件修改审批</span></span>
<span class="line"><span>  │     handle_request_user_input() → 用户输入请求</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ├── agent/ → 多 Agent 管理</span></span>
<span class="line"><span>  │     registry.rs → Agent 注册表（深度限制）</span></span>
<span class="line"><span>  │     mailbox.rs → Agent 间消息传递</span></span>
<span class="line"><span>  │     control.rs → Agent 生命周期管理</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ├── session/ → 会话管理</span></span>
<span class="line"><span>  │     thread_manager.rs → 线程管理</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  └── tools/ → 工具执行</span></span>
<span class="line"><span>        sandboxing/ → 沙箱隔离</span></span>
<span class="line"><span>        exec/ → 命令执行</span></span></code></pre></div><h3 id="事件循环" tabindex="-1">事件循环 <a class="header-anchor" href="#事件循环" aria-label="Permalink to &quot;事件循环&quot;">​</a></h3><blockquote><p>📖 参见：<a href="/ai_harness/codex_docs/agent/event-loop.html">事件驱动循环架构</a> — 事件分发与处理流程</p></blockquote><div class="language-rust vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">rust</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// codex_delegate.rs — 简化版</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">pub</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> async</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> fn</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> run_codex_thread_interactive</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(codex</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> &amp;</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">Codex</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, delegate</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> &amp;</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">Delegate</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">) {</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">    loop</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">        // 接收事件（来自 agent 或用户）</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">        match</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> forward_events</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(codex, delegate)</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">            Event</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">::</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">ExecApproval</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(approval) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">                // 命令执行需要用户审批</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">                handle_exec_approval</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(codex, delegate, approval)</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.await</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">            }</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">            Event</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">::</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">PatchApproval</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(patch) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">                // 文件修改需要用户审批</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">                handle_patch_approval</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(codex, delegate, patch)</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.await</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">            }</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">            Event</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">::</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">RequestUserInput</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(request) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">                // Agent 请求用户输入</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">                handle_request_user_input</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(codex, delegate, request)</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.await</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">            }</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">            Event</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">::</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">RequestPermissions</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(request) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">                // 权限请求</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">                handle_request_permissions</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(codex, delegate, request)</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.await</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">            }</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">            Event</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">::</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">Shutdown</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =&gt;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> break</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    }</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">    shutdown_delegate</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(codex)</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.await</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre></div><h3 id="与-claude-code-的关键差异" tabindex="-1">与 Claude Code 的关键差异 <a class="header-anchor" href="#与-claude-code-的关键差异" aria-label="Permalink to &quot;与 Claude Code 的关键差异&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Claude Code: while(true) { callModel → executeTools → continue }</span></span>
<span class="line"><span>  - 模型决定下一步</span></span>
<span class="line"><span>  - 工具执行是循环的一部分</span></span>
<span class="line"><span>  - 单线程</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Codex: loop { receive_event → handle_event }</span></span>
<span class="line"><span>  - 事件驱动</span></span>
<span class="line"><span>  - 审批是显式的事件（不是工具执行的副作用）</span></span>
<span class="line"><span>  - Rust async runtime（tokio）管理并发</span></span>
<span class="line"><span>  - Agent 间通过 mailbox 通信</span></span></code></pre></div><h3 id="agent-注册表和深度限制" tabindex="-1">Agent 注册表和深度限制 <a class="header-anchor" href="#agent-注册表和深度限制" aria-label="Permalink to &quot;Agent 注册表和深度限制&quot;">​</a></h3><blockquote><p>📖 参见：<a href="/ai_harness/codex_docs/agent/multi-agent.html">多 Agent 管理机制</a> — 注册表与深度控制</p></blockquote><div class="language-rust vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">rust</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// agent/registry.rs</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">struct</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> AgentRegistry</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    active_agents</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> ActiveAgents</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">struct</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> AgentMetadata</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    thread_id</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> ThreadId</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // ... 其他元数据</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// 深度限制：防止递归生成 Agent</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">fn</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> session_depth</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(session_source</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> &amp;</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">SessionSource</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">-&gt;</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> i32</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // 计算当前 Agent 的嵌套深度</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // 超过限制 → 拒绝生成新 Agent</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre></div><h3 id="agent-邮箱系统" tabindex="-1">Agent 邮箱系统 <a class="header-anchor" href="#agent-邮箱系统" aria-label="Permalink to &quot;Agent 邮箱系统&quot;">​</a></h3><blockquote><p>📖 参见：<a href="/ai_harness/codex_docs/agent/multi-agent.html">多 Agent 管理机制</a> — 邮箱通信机制</p></blockquote><div class="language-rust vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">rust</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// agent/mailbox.rs</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">struct</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> Mailbox</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // Agent 间异步消息传递</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">struct</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> MailboxReceiver</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // 接收端</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">impl</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> Mailbox</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">    fn</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> send</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">&amp;</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">self</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, communication</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">:</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> InterAgentCommunication</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">-&gt;</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> u64</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">        // 发送消息给其他 Agent</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    </span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">    fn</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> subscribe</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">&amp;</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">self</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">-&gt;</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> watch</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">::</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">Receiver</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&lt;</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">u64</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">&gt; {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">        // 订阅消息通知</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre></div><hr><h2 id="_2-多级上下文压缩-★★★★★" tabindex="-1">2. 多级上下文压缩 ★★★★★ <a class="header-anchor" href="#_2-多级上下文压缩-★★★★★" aria-label="Permalink to &quot;2. 多级上下文压缩 ★★★★★&quot;">​</a></h2><blockquote><p>📖 详细源码分析：<a href="/ai_harness/codex_docs/context/auto-compact.html">自动上下文压缩机制</a></p></blockquote><p>Codex 的上下文管理相对简单，没有 Claude Code 那样的 7 层防御。</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>主要策略：</span></span>
<span class="line"><span>1. 消息历史长度限制</span></span>
<span class="line"><span>2. 超出时截断旧消息</span></span>
<span class="line"><span>3. 没有 LLM 摘要机制</span></span>
<span class="line"><span>4. 依赖模型自身的上下文窗口</span></span>
<span class="line"><span></span></span>
<span class="line"><span>原因：Codex 的设计重心在沙箱和安全，不在上下文管理。</span></span>
<span class="line"><span>它假设大多数编码任务不需要超长会话。</span></span></code></pre></div><hr><h2 id="_3-跨会话记忆系统-★★★★" tabindex="-1">3. 跨会话记忆系统 ★★★★ <a class="header-anchor" href="#_3-跨会话记忆系统-★★★★" aria-label="Permalink to &quot;3. 跨会话记忆系统 ★★★★&quot;">​</a></h2><blockquote><p>📖 详细源码分析：<a href="/ai_harness/codex_docs/data/agents-md.html">agents.md 配置体系</a> | <a href="/ai_harness/codex_docs/data/session.html">会话状态持久化</a> | <a href="/ai_harness/codex_docs/data/config-stack.html">配置栈架构</a></p></blockquote><h3 id="核心文件-codex-rs-instructions-、codex-rs-config" tabindex="-1">核心文件：<code>codex-rs/instructions/</code>、<code>codex-rs/config/</code> <a class="header-anchor" href="#核心文件-codex-rs-instructions-、codex-rs-config" aria-label="Permalink to &quot;核心文件：\`codex-rs/instructions/\`、\`codex-rs/config/\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Codex 的记忆系统基于配置文件：</span></span>
<span class="line"><span></span></span>
<span class="line"><span>1. AGENTS.md（类似 CLAUDE.md）</span></span>
<span class="line"><span>   - 项目级指令</span></span>
<span class="line"><span>   - 放在仓库根目录</span></span>
<span class="line"><span>   - 每次会话开始时加载</span></span>
<span class="line"><span></span></span>
<span class="line"><span>2. 配置文件（codex-rs/config/）</span></span>
<span class="line"><span>   - 用户偏好</span></span>
<span class="line"><span>   - 模型设置</span></span>
<span class="line"><span>   - exec policy 规则</span></span>
<span class="line"><span>   - 持久化到 ~/.codex/</span></span>
<span class="line"><span></span></span>
<span class="line"><span>3. 没有自动记忆学习</span></span>
<span class="line"><span>   - 不像 Claude Code 的 Auto Memory</span></span>
<span class="line"><span>   - 不像 Hermes 的 memory tool</span></span>
<span class="line"><span>   - 用户需要手动维护 AGENTS.md</span></span>
<span class="line"><span></span></span>
<span class="line"><span>4. 没有 Dream Mode</span></span>
<span class="line"><span>   - 没有记忆整合循环</span></span>
<span class="line"><span>   - 没有过期清理</span></span>
<span class="line"><span>   - 没有矛盾解决</span></span></code></pre></div><hr><h2 id="_4-多级错误恢复-★★★★" tabindex="-1">4. 多级错误恢复 ★★★★ <a class="header-anchor" href="#_4-多级错误恢复-★★★★" aria-label="Permalink to &quot;4. 多级错误恢复 ★★★★&quot;">​</a></h2><blockquote><p>📖 详细源码分析：<a href="/ai_harness/codex_docs/agent/error-recovery.html">错误恢复与重试机制</a></p></blockquote><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Codex 的错误恢复：</span></span>
<span class="line"><span></span></span>
<span class="line"><span>1. 命令执行失败</span></span>
<span class="line"><span>   - 沙箱捕获错误</span></span>
<span class="line"><span>   - 错误信息回填给模型</span></span>
<span class="line"><span>   - 模型决定是否重试</span></span>
<span class="line"><span></span></span>
<span class="line"><span>2. API 错误</span></span>
<span class="line"><span>   - 基础重试逻辑</span></span>
<span class="line"><span>   - 没有模型 fallback 链</span></span>
<span class="line"><span></span></span>
<span class="line"><span>3. 沙箱违规</span></span>
<span class="line"><span>   - 命令被沙箱阻止</span></span>
<span class="line"><span>   - 错误信息包含违规原因</span></span>
<span class="line"><span>   - 用户可以选择放宽沙箱限制</span></span>
<span class="line"><span></span></span>
<span class="line"><span>4. 审批超时</span></span>
<span class="line"><span>   - await_approval_with_cancel() 支持取消</span></span>
<span class="line"><span>   - 超时后通知 Agent</span></span></code></pre></div><hr><h2 id="_5-token-budget-管理-★★★" tabindex="-1">5. Token Budget 管理 ★★★ <a class="header-anchor" href="#_5-token-budget-管理-★★★" aria-label="Permalink to &quot;5. Token Budget 管理 ★★★&quot;">​</a></h2><blockquote><p>📖 详细源码分析：<a href="/ai_harness/codex_docs/context/token-estimate.html">Token 用量估算</a></p></blockquote><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Codex 的 token 管理相对简单：</span></span>
<span class="line"><span>- 基础的 usage 追踪</span></span>
<span class="line"><span>- 没有跨压缩边界追踪（因为没有压缩）</span></span>
<span class="line"><span>- 没有成本预算（maxBudgetUsd）</span></span></code></pre></div><hr><h2 id="_6-推测执行-★★★" tabindex="-1">6. 推测执行 ★★★ <a class="header-anchor" href="#_6-推测执行-★★★" aria-label="Permalink to &quot;6. 推测执行 ★★★&quot;">​</a></h2><blockquote><p>📖 详细源码分析：<a href="/ai_harness/codex_docs/sandbox/architecture.html">沙箱整体架构设计</a> | <a href="/ai_harness/codex_docs/execpolicy/policy-engine.html">策略引擎与执行控制</a></p></blockquote><h3 id="codex-的沙箱本身就是一种推测执行" tabindex="-1">Codex 的沙箱本身就是一种推测执行 <a class="header-anchor" href="#codex-的沙箱本身就是一种推测执行" aria-label="Permalink to &quot;Codex 的沙箱本身就是一种推测执行&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>概念：所有命令在沙箱中执行 = 在隔离环境中&quot;推测&quot;执行</span></span>
<span class="line"><span></span></span>
<span class="line"><span>流程：</span></span>
<span class="line"><span>  1. Agent 决定执行命令</span></span>
<span class="line"><span>  2. 命令在沙箱中运行（文件系统隔离）</span></span>
<span class="line"><span>  3. 用户审查结果</span></span>
<span class="line"><span>  4. 确认 → 变更生效</span></span>
<span class="line"><span>  5. 拒绝 → 沙箱状态丢弃</span></span>
<span class="line"><span></span></span>
<span class="line"><span>与 Claude Code 的 overlay 推测执行类似，但实现层面不同：</span></span>
<span class="line"><span>  Claude Code: 应用层 overlay（虚拟文件系统）</span></span>
<span class="line"><span>  Codex: 操作系统级沙箱（landlock/seatbelt）</span></span></code></pre></div><hr><h2 id="_7-沙箱-★★★-—-codex-的核心差异化" tabindex="-1">7. 沙箱 ★★★ — Codex 的核心差异化 <a class="header-anchor" href="#_7-沙箱-★★★-—-codex-的核心差异化" aria-label="Permalink to &quot;7. 沙箱 ★★★ — Codex 的核心差异化&quot;">​</a></h2><blockquote><p>📖 详细源码分析：<a href="/ai_harness/codex_docs/sandbox/architecture.html">沙箱整体架构设计</a> | <a href="/ai_harness/codex_docs/sandbox/seatbelt.html">macOS Seatbelt 沙箱</a> | <a href="/ai_harness/codex_docs/sandbox/landlock.html">Linux Landlock 沙箱</a> | <a href="/ai_harness/codex_docs/sandbox/network-proxy.html">网络代理与隔离</a></p></blockquote><h3 id="核心文件-codex-rs-sandboxing-、codex-rs-exec-、codex-rs-execpolicy-、go-sandbox" tabindex="-1">核心文件：<code>codex-rs/sandboxing/</code>、<code>codex-rs/exec/</code>、<code>codex-rs/execpolicy/</code>、<code>go_sandbox/</code> <a class="header-anchor" href="#核心文件-codex-rs-sandboxing-、codex-rs-exec-、codex-rs-execpolicy-、go-sandbox" aria-label="Permalink to &quot;核心文件：\`codex-rs/sandboxing/\`、\`codex-rs/exec/\`、\`codex-rs/execpolicy/\`、\`go_sandbox/\`&quot;">​</a></h3><p>这是 Codex 最独特的部分，也是它和其他 Agent Runtime 的核心差异。</p><h3 id="沙箱架构" tabindex="-1">沙箱架构 <a class="header-anchor" href="#沙箱架构" aria-label="Permalink to &quot;沙箱架构&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>三层沙箱体系：</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Layer 1: Exec Policy（策略层）</span></span>
<span class="line"><span>  codex-rs/execpolicy/</span></span>
<span class="line"><span>  - 命令模式匹配</span></span>
<span class="line"><span>  - always-allow / ask / deny 规则</span></span>
<span class="line"><span>  - 比 Claude Code 的 allow/deny 更细粒度</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Layer 2: OS-Level Sandbox（系统级隔离）</span></span>
<span class="line"><span>  codex-rs/sandboxing/</span></span>
<span class="line"><span>  - Linux: landlock + seccomp</span></span>
<span class="line"><span>  - macOS: seatbelt (App Sandbox)</span></span>
<span class="line"><span>  - Windows: Windows Sandbox RS</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Layer 3: Go Sandbox（额外隔离层）</span></span>
<span class="line"><span>  go_sandbox/</span></span>
<span class="line"><span>  - Go 实现的沙箱管理器</span></span>
<span class="line"><span>  - 策略文件定义允许的操作</span></span>
<span class="line"><span>  - seatbelt 策略生成</span></span></code></pre></div><h3 id="exec-policy-详解" tabindex="-1">Exec Policy 详解 <a class="header-anchor" href="#exec-policy-详解" aria-label="Permalink to &quot;Exec Policy 详解&quot;">​</a></h3><blockquote><p>📖 参见：<a href="/ai_harness/codex_docs/execpolicy/policy-engine.html">策略引擎与执行控制</a> — 规则匹配与策略级别</p></blockquote><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>codex-rs/execpolicy/ 定义了细粒度的命令执行策略：</span></span>
<span class="line"><span></span></span>
<span class="line"><span>策略级别：</span></span>
<span class="line"><span>  sandbox-strict    — 最严格，只允许白名单命令</span></span>
<span class="line"><span>  sandbox-permissive — 允许大部分命令，限制危险操作</span></span>
<span class="line"><span>  no-sandbox        — 不隔离（仅用于信任环境）</span></span>
<span class="line"><span></span></span>
<span class="line"><span>规则匹配：</span></span>
<span class="line"><span>  - 基于命令名 + 参数模式</span></span>
<span class="line"><span>  - 支持通配符</span></span>
<span class="line"><span>  - 支持正则表达式</span></span>
<span class="line"><span>  - 第一条匹配的规则生效</span></span>
<span class="line"><span></span></span>
<span class="line"><span>示例：</span></span>
<span class="line"><span>  allow: [&quot;git status&quot;, &quot;git diff *&quot;, &quot;npm test&quot;]</span></span>
<span class="line"><span>  ask:   [&quot;git commit *&quot;, &quot;npm install *&quot;]</span></span>
<span class="line"><span>  deny:  [&quot;rm -rf *&quot;, &quot;curl *&quot;, &quot;wget *&quot;]</span></span></code></pre></div><h3 id="linux-沙箱实现" tabindex="-1">Linux 沙箱实现 <a class="header-anchor" href="#linux-沙箱实现" aria-label="Permalink to &quot;Linux 沙箱实现&quot;">​</a></h3><blockquote><p>📖 参见：<a href="/ai_harness/codex_docs/sandbox/landlock.html">Linux Landlock 沙箱</a> — landlock + seccomp 详细实现</p></blockquote><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>codex-rs/linux-sandbox/</span></span>
<span class="line"><span></span></span>
<span class="line"><span>使用 landlock + seccomp：</span></span>
<span class="line"><span></span></span>
<span class="line"><span>landlock（文件系统隔离）：</span></span>
<span class="line"><span>  - Linux 5.13+ 内核特性</span></span>
<span class="line"><span>  - 限制进程可以访问的文件路径</span></span>
<span class="line"><span>  - 规则：允许读 /usr, /lib, /etc</span></span>
<span class="line"><span>  - 规则：允许读写 /tmp/codex-sandbox/</span></span>
<span class="line"><span>  - 规则：禁止访问 ~/.ssh, ~/.aws</span></span>
<span class="line"><span></span></span>
<span class="line"><span>seccomp（系统调用过滤）：</span></span>
<span class="line"><span>  - 限制进程可以使用的系统调用</span></span>
<span class="line"><span>  - 禁止：ptrace, mount, reboot, ...</span></span>
<span class="line"><span>  - 允许：read, write, open, close, ...</span></span>
<span class="line"><span></span></span>
<span class="line"><span>子进程继承：</span></span>
<span class="line"><span>  - 所有子进程自动继承沙箱约束</span></span>
<span class="line"><span>  - 无法通过 fork/exec 逃逸</span></span></code></pre></div><h3 id="macos-沙箱实现" tabindex="-1">macOS 沙箱实现 <a class="header-anchor" href="#macos-沙箱实现" aria-label="Permalink to &quot;macOS 沙箱实现&quot;">​</a></h3><blockquote><p>📖 参见：<a href="/ai_harness/codex_docs/sandbox/seatbelt.html">macOS Seatbelt 沙箱</a> — seatbelt 策略文件与动态生成</p></blockquote><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>go_sandbox/seatbelt.go</span></span>
<span class="line"><span></span></span>
<span class="line"><span>使用 macOS Seatbelt (App Sandbox)：</span></span>
<span class="line"><span></span></span>
<span class="line"><span>seatbelt 策略文件（.sb 格式）：</span></span>
<span class="line"><span>  (version 1)</span></span>
<span class="line"><span>  (deny default)                    ; 默认拒绝所有</span></span>
<span class="line"><span>  (allow file-read* (subpath &quot;/usr&quot;))  ; 允许读 /usr</span></span>
<span class="line"><span>  (allow file-read-write* (subpath &quot;/tmp/codex&quot;))  ; 允许读写 /tmp/codex</span></span>
<span class="line"><span>  (allow network-outbound (remote tcp &quot;github.com:443&quot;))  ; 允许访问 github</span></span>
<span class="line"><span>  (deny network* (local udp))       ; 禁止本地 UDP</span></span>
<span class="line"><span></span></span>
<span class="line"><span>策略生成：</span></span>
<span class="line"><span>  go_sandbox/seatbelt_policies.go</span></span>
<span class="line"><span>  - 根据 exec policy 动态生成 .sb 文件</span></span>
<span class="line"><span>  - 不同的命令可以有不同的沙箱策略</span></span>
<span class="line"><span></span></span>
<span class="line"><span>执行：</span></span>
<span class="line"><span>  sandbox-exec -f policy.sb -- command args</span></span></code></pre></div><h3 id="网络隔离" tabindex="-1">网络隔离 <a class="header-anchor" href="#网络隔离" aria-label="Permalink to &quot;网络隔离&quot;">​</a></h3><blockquote><p>📖 参见：<a href="/ai_harness/codex_docs/sandbox/network-proxy.html">网络代理与隔离</a> — 域名白名单与数据泄露防护</p></blockquote><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>codex-rs/network-proxy/</span></span>
<span class="line"><span></span></span>
<span class="line"><span>网络访问控制：</span></span>
<span class="line"><span>  - 代理所有网络请求</span></span>
<span class="line"><span>  - 白名单域名检查</span></span>
<span class="line"><span>  - 阻止未授权的外部访问</span></span>
<span class="line"><span>  - 防止数据泄露</span></span>
<span class="line"><span></span></span>
<span class="line"><span>配置：</span></span>
<span class="line"><span>  allowedDomains: [&quot;github.com&quot;, &quot;*.npmjs.org&quot;, &quot;api.openai.com&quot;]</span></span>
<span class="line"><span>  denyDomains: [&quot;*&quot;]  ; 默认拒绝</span></span></code></pre></div><h3 id="进程加固" tabindex="-1">进程加固 <a class="header-anchor" href="#进程加固" aria-label="Permalink to &quot;进程加固&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>codex-rs/process-hardening/</span></span>
<span class="line"><span></span></span>
<span class="line"><span>额外的安全措施：</span></span>
<span class="line"><span>  - 禁止 ptrace（防止调试器附加）</span></span>
<span class="line"><span>  - 限制 /proc 访问</span></span>
<span class="line"><span>  - 清理环境变量（移除敏感信息）</span></span>
<span class="line"><span>  - 设置资源限制（CPU、内存、文件描述符）</span></span></code></pre></div><h3 id="审批流程" tabindex="-1">审批流程 <a class="header-anchor" href="#审批流程" aria-label="Permalink to &quot;审批流程&quot;">​</a></h3><blockquote><p>📖 参见：<a href="/ai_harness/codex_docs/execpolicy/approval-flow.html">审批流程设计</a> — 完整审批链路与取消机制</p></blockquote><div class="language-rust vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">rust</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// codex_delegate.rs</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">async</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> fn</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> handle_exec_approval</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(codex, delegate, approval) {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // 1. 检查 exec policy</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">    let</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> policy_decision </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> check_exec_policy</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">&amp;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">approval</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">command);</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    </span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">    match</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> policy_decision {</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">        AlwaysAllow</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">            // 自动批准</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">            codex</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">approve_exec</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(approval</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">id)</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        }</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">        Ask</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">            // 展示给用户，等待确认</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">            let</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> user_decision </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> await_approval_with_cancel</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">                delegate</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">prompt_user</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(approval),</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">                codex</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">cancellation_token</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(),</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">            )</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">            </span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">            match</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> user_decision {</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">                Approved</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> codex</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">approve_exec</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(approval</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">id)</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">                Denied</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> codex</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">deny_exec</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(approval</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">id)</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">                Cancelled</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> { </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">/* 用户取消 */</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">            }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        }</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">        Deny</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">            // 自动拒绝</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">            codex</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">deny_exec</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(approval</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">id)</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">.await</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">async</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> fn</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> handle_patch_approval</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(codex, delegate, patch) {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // 类似流程，但针对文件修改</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // 展示 diff 给用户</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // 用户确认后才应用</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre></div><h3 id="与-claude-code-沙箱的对比" tabindex="-1">与 Claude Code 沙箱的对比 <a class="header-anchor" href="#与-claude-code-沙箱的对比" aria-label="Permalink to &quot;与 Claude Code 沙箱的对比&quot;">​</a></h3><table tabindex="0"><thead><tr><th>维度</th><th>Codex</th><th>Claude Code</th></tr></thead><tbody><tr><td>实现层面</td><td>操作系统级（landlock/seatbelt）</td><td>操作系统级（seatbelt/bubblewrap）</td></tr><tr><td>语言</td><td>Rust + Go</td><td>TypeScript（调用系统命令）</td></tr><tr><td>策略粒度</td><td>exec policy（命令级）</td><td>allow/deny 规则（工具级）</td></tr><tr><td>网络隔离</td><td>有（network-proxy）</td><td>有（allowedDomains）</td></tr><tr><td>进程加固</td><td>有（process-hardening）</td><td>无</td></tr><tr><td>审批 UI</td><td>事件驱动（handle_exec_approval）</td><td>权限系统（checkPermission）</td></tr><tr><td>子进程</td><td>自动继承沙箱</td><td>自动继承沙箱</td></tr><tr><td>escape hatch</td><td>无（更严格）</td><td>有（dangerouslyDisableSandbox）</td></tr></tbody></table><hr><h2 id="深入阅读" tabindex="-1">深入阅读 <a class="header-anchor" href="#深入阅读" aria-label="Permalink to &quot;深入阅读&quot;">​</a></h2><p>以下是 Codex 项目文档站中与本文各章节对应的详细源码分析文章：</p><h3 id="agent-核心架构" tabindex="-1">Agent 核心架构 <a class="header-anchor" href="#agent-核心架构" aria-label="Permalink to &quot;Agent 核心架构&quot;">​</a></h3><ul><li><a href="/ai_harness/codex_docs/agent/event-loop.html">事件驱动循环架构</a> — codex_delegate 事件循环、forward_events 分发机制</li><li><a href="/ai_harness/codex_docs/agent/multi-agent.html">多 Agent 管理机制</a> — Agent 注册表、邮箱系统、深度限制</li><li><a href="/ai_harness/codex_docs/agent/error-recovery.html">错误恢复与重试机制</a> — 沙箱错误、API 重试、审批超时处理</li><li><a href="/ai_harness/codex_docs/agent/hook-system.html">Hook 系统</a> — 事件钩子与扩展点</li></ul><h3 id="上下文管理" tabindex="-1">上下文管理 <a class="header-anchor" href="#上下文管理" aria-label="Permalink to &quot;上下文管理&quot;">​</a></h3><ul><li><a href="/ai_harness/codex_docs/context/auto-compact.html">自动上下文压缩机制</a> — 消息历史截断策略</li><li><a href="/ai_harness/codex_docs/context/token-estimate.html">Token 用量估算</a> — 基础 usage 追踪</li></ul><h3 id="数据与记忆" tabindex="-1">数据与记忆 <a class="header-anchor" href="#数据与记忆" aria-label="Permalink to &quot;数据与记忆&quot;">​</a></h3><ul><li><a href="/ai_harness/codex_docs/data/agents-md.html">agents.md 配置体系</a> — 项目级指令、AGENTS.md 加载机制</li><li><a href="/ai_harness/codex_docs/data/session.html">会话状态持久化</a> — 会话管理与线程状态</li><li><a href="/ai_harness/codex_docs/data/config-stack.html">配置栈架构</a> — 多层配置合并、用户偏好持久化</li></ul><h3 id="沙箱与安全" tabindex="-1">沙箱与安全 <a class="header-anchor" href="#沙箱与安全" aria-label="Permalink to &quot;沙箱与安全&quot;">​</a></h3><ul><li><a href="/ai_harness/codex_docs/sandbox/architecture.html">沙箱整体架构设计</a> — 三层沙箱体系总览</li><li><a href="/ai_harness/codex_docs/sandbox/seatbelt.html">macOS Seatbelt 沙箱</a> — seatbelt 策略文件、动态生成</li><li><a href="/ai_harness/codex_docs/sandbox/landlock.html">Linux Landlock 沙箱</a> — landlock + seccomp 实现</li><li><a href="/ai_harness/codex_docs/sandbox/network-proxy.html">网络代理与隔离</a> — 域名白名单、数据泄露防护</li></ul><h3 id="执行策略" tabindex="-1">执行策略 <a class="header-anchor" href="#执行策略" aria-label="Permalink to &quot;执行策略&quot;">​</a></h3><ul><li><a href="/ai_harness/codex_docs/execpolicy/policy-engine.html">策略引擎与执行控制</a> — 命令模式匹配、策略级别</li><li><a href="/ai_harness/codex_docs/execpolicy/approval-flow.html">审批流程设计</a> — exec/patch 审批、取消机制</li><li><a href="/ai_harness/codex_docs/execpolicy/escalation.html">权限升级机制</a> — 沙箱限制放宽流程</li></ul><h3 id="工具与-api" tabindex="-1">工具与 API <a class="header-anchor" href="#工具与-api" aria-label="Permalink to &quot;工具与 API&quot;">​</a></h3><ul><li><a href="/ai_harness/codex_docs/tools/shell-tool.html">Shell 工具实现</a> — 命令执行与沙箱集成</li><li><a href="/ai_harness/codex_docs/tools/apply-patch.html">Apply Patch 工具</a> — 文件修改与 diff 审批</li><li><a href="/ai_harness/codex_docs/tools/mcp-integration.html">MCP 集成</a> — MCP 协议支持</li></ul><h3 id="附录" tabindex="-1">附录 <a class="header-anchor" href="#附录" aria-label="Permalink to &quot;附录&quot;">​</a></h3><ul><li><a href="/ai_harness/codex_docs/appendix/patterns.html">设计模式总结</a> — Codex 架构模式与最佳实践</li></ul>`,87)])])}const g=a(p,[["render",l]]);export{r as __pageData,g as default};

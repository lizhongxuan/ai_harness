import{_ as a,o as n,c as e,ag as i}from"./chunks/framework.BMy1X8j3.js";const u=JSON.parse('{"title":"18. 流式渲染","description":"","frontmatter":{},"headers":[],"relativePath":"codex_docs/ui/streaming.md","filePath":"codex_docs/ui/streaming.md"}'),t={name:"codex_docs/ui/streaming.md"};function p(l,s,r,o,c,d){return n(),e("div",null,[...s[0]||(s[0]=[i(`<h1 id="_18-流式渲染" tabindex="-1">18. 流式渲染 <a class="header-anchor" href="#_18-流式渲染" aria-label="Permalink to &quot;18. 流式渲染&quot;">​</a></h1><blockquote><p>源码位置: <code>codex-rs/core/src/stream_events_utils.rs</code>, <code>codex-rs/tui/src/chatwidget.rs</code></p></blockquote><h2 id="概述" tabindex="-1">概述 <a class="header-anchor" href="#概述" aria-label="Permalink to &quot;概述&quot;">​</a></h2><p>Codex 的流式渲染将模型的 SSE 事件实时渲染到终端。Rust 的性能优势在这里体现——即使在高速输出时也能保持流畅。</p><h2 id="底层原理" tabindex="-1">底层原理 <a class="header-anchor" href="#底层原理" aria-label="Permalink to &quot;底层原理&quot;">​</a></h2><h3 id="事件处理" tabindex="-1">事件处理 <a class="header-anchor" href="#事件处理" aria-label="Permalink to &quot;事件处理&quot;">​</a></h3><div class="language-rust vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">rust</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// stream_events_utils.rs</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// 处理 OpenAI Responses API 的 SSE 事件流：</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// - response.created</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// - response.output_item.added</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// - response.content_part.added</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// - response.content_part.delta（文本增量）</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// - response.function_call_arguments.delta（工具参数增量）</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// - response.completed</span></span></code></pre></div><h3 id="tui-渲染" tabindex="-1">TUI 渲染 <a class="header-anchor" href="#tui-渲染" aria-label="Permalink to &quot;TUI 渲染&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>SSE 事件流</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ▼</span></span>
<span class="line"><span>stream_events_utils.rs（解析事件）</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ▼</span></span>
<span class="line"><span>chatwidget.rs（渲染到终端）</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ├── 文本增量 → 追加到当前消息</span></span>
<span class="line"><span>  ├── 工具调用 → 显示工具名和参数</span></span>
<span class="line"><span>  ├── 工具结果 → 显示执行结果</span></span>
<span class="line"><span>  └── 完成 → 更新状态栏</span></span></code></pre></div><h2 id="关联知识点" tabindex="-1">关联知识点 <a class="header-anchor" href="#关联知识点" aria-label="Permalink to &quot;关联知识点&quot;">​</a></h2><ul><li><a href="/ai_harness/codex_docs/ui/tui-architecture.html">TUI 架构</a> — 渲染框架</li><li><a href="/ai_harness/codex_docs/api/responses-api.html">Responses API</a> — SSE 事件格式</li></ul>`,11)])])}const _=a(t,[["render",p]]);export{u as __pageData,_ as default};

import{_ as s,o as n,c as p,ag as i}from"./chunks/framework.BMy1X8j3.js";const k=JSON.parse('{"title":"8. 网络代理隔离","description":"","frontmatter":{},"headers":[],"relativePath":"codex_docs/sandbox/network-proxy.md","filePath":"codex_docs/sandbox/network-proxy.md"}'),e={name:"codex_docs/sandbox/network-proxy.md"};function l(t,a,o,r,c,h){return n(),p("div",null,[...a[0]||(a[0]=[i(`<h1 id="_8-网络代理隔离" tabindex="-1">8. 网络代理隔离 <a class="header-anchor" href="#_8-网络代理隔离" aria-label="Permalink to &quot;8. 网络代理隔离&quot;">​</a></h1><blockquote><p>源码位置: <code>codex-rs/network-proxy/</code></p></blockquote><h2 id="概述" tabindex="-1">概述 <a class="header-anchor" href="#概述" aria-label="Permalink to &quot;概述&quot;">​</a></h2><p>Codex 的网络隔离不仅依赖沙箱的网络限制，还有一个专用的网络代理层。所有网络请求通过代理转发，代理负责域名白名单检查和流量审计。</p><h2 id="底层原理" tabindex="-1">底层原理 <a class="header-anchor" href="#底层原理" aria-label="Permalink to &quot;底层原理&quot;">​</a></h2><h3 id="架构" tabindex="-1">架构 <a class="header-anchor" href="#架构" aria-label="Permalink to &quot;架构&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>命令执行</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ▼</span></span>
<span class="line"><span>沙箱（Seatbelt/Landlock）</span></span>
<span class="line"><span>  │ 网络请求被重定向到本地代理</span></span>
<span class="line"><span>  ▼</span></span>
<span class="line"><span>NetworkProxy（codex-rs/network-proxy/）</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ├── 域名白名单检查</span></span>
<span class="line"><span>  │   ├── 允许 → 转发请求</span></span>
<span class="line"><span>  │   └── 拒绝 → 返回错误</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  ├── 流量审计</span></span>
<span class="line"><span>  │   └── 记录所有网络请求（域名、端口、时间）</span></span>
<span class="line"><span>  │</span></span>
<span class="line"><span>  └── 转发到目标服务器</span></span></code></pre></div><h3 id="配置" tabindex="-1">配置 <a class="header-anchor" href="#配置" aria-label="Permalink to &quot;配置&quot;">​</a></h3><div class="language-toml vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">toml</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 在 SandboxPolicy 中配置</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">[</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">network</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">allowed_domains = [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;github.com&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;*.npmjs.org&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;api.openai.com&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">allow_local_binding = </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">true</span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  # 允许绑定本地端口（如 dev server）</span></span></code></pre></div><h3 id="与沙箱的协作" tabindex="-1">与沙箱的协作 <a class="header-anchor" href="#与沙箱的协作" aria-label="Permalink to &quot;与沙箱的协作&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>沙箱层面：</span></span>
<span class="line"><span>  - Seatbelt: (deny network*) 禁止直接网络访问</span></span>
<span class="line"><span>  - Landlock: seccomp 过滤网络系统调用</span></span>
<span class="line"><span>  - 但允许连接到本地代理端口</span></span>
<span class="line"><span></span></span>
<span class="line"><span>代理层面：</span></span>
<span class="line"><span>  - 接收沙箱内的网络请求</span></span>
<span class="line"><span>  - 检查目标域名是否在白名单中</span></span>
<span class="line"><span>  - 白名单内 → 转发</span></span>
<span class="line"><span>  - 白名单外 → 拒绝 + 记录</span></span>
<span class="line"><span></span></span>
<span class="line"><span>效果：双重隔离</span></span>
<span class="line"><span>  - 即使沙箱有漏洞，代理仍然限制网络访问</span></span>
<span class="line"><span>  - 即使代理有漏洞，沙箱仍然限制文件系统访问</span></span></code></pre></div><h2 id="设计原因" tabindex="-1">设计原因 <a class="header-anchor" href="#设计原因" aria-label="Permalink to &quot;设计原因&quot;">​</a></h2><ul><li><strong>纵深防御</strong>：沙箱 + 代理双重网络隔离</li><li><strong>可审计</strong>：所有网络请求都经过代理，可以记录和审查</li><li><strong>灵活</strong>：白名单可以动态更新，不需要重启沙箱</li><li><strong>防数据泄露</strong>：即使模型被 prompt injection 操纵，也无法将数据发送到未授权的域名</li></ul><h2 id="关联知识点" tabindex="-1">关联知识点 <a class="header-anchor" href="#关联知识点" aria-label="Permalink to &quot;关联知识点&quot;">​</a></h2><ul><li><a href="/ai_harness/codex_docs/sandbox/architecture.html">沙箱架构总览</a> — 网络代理在三层体系中的位置</li><li><a href="/ai_harness/codex_docs/execpolicy/policy-engine.html">策略引擎</a> — 网络策略的配置</li></ul>`,15)])])}const u=s(e,[["render",l]]);export{k as __pageData,u as default};

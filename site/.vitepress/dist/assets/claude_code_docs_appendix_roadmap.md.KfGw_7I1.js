import{_ as a,o as n,c as t,ag as i}from"./chunks/framework.BMy1X8j3.js";const E=JSON.parse('{"title":"学习路线","description":"","frontmatter":{},"headers":[],"relativePath":"claude_code_docs/appendix/roadmap.md","filePath":"claude_code_docs/appendix/roadmap.md"}'),p={name:"claude_code_docs/appendix/roadmap.md"};function l(e,s,d,h,r,o){return n(),t("div",null,[...s[0]||(s[0]=[i(`<h1 id="学习路线" tabindex="-1">学习路线 <a class="header-anchor" href="#学习路线" aria-label="Permalink to &quot;学习路线&quot;">​</a></h1><blockquote><p>推荐的 Claude Code 源码阅读顺序与学习路径</p></blockquote><h2 id="概述" tabindex="-1">概述 <a class="header-anchor" href="#概述" aria-label="Permalink to &quot;概述&quot;">​</a></h2><p>24 个知识点之间有明确的依赖关系。按照正确的顺序阅读可以避免&quot;看不懂&quot;的挫败感。本文提供三种学习路径：1 天速览、1 周精读、2-3 周深入，以及完整的依赖关系图。</p><h2 id="模块依赖图" tabindex="-1">模块依赖图 <a class="header-anchor" href="#模块依赖图" aria-label="Permalink to &quot;模块依赖图&quot;">​</a></h2><div class="language-mermaid vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">mermaid</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">flowchart TD</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    subgraph Core[&quot;核心（必读）&quot;]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        A1[1. ReAct 循环] --&gt; A2[2. 错误恢复]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        A1 --&gt; C5[5. 五层防爆]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        C5 --&gt; C6[6. 工具结果预算]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        C5 --&gt; C7[7. 压缩意图保持]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        C5 --&gt; C8[8. Prompt Cache]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    subgraph Tools[&quot;工具系统&quot;]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        T9[9. 工具类型系统] --&gt; T10[10. 权限模式]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        T9 --&gt; T11[11. 工具结果落盘]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        T11 --&gt; C6</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    subgraph Agent[&quot;Agent 架构&quot;]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        A1 --&gt; A3[3. 子 Agent]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        A1 --&gt; A4[4. Hook 系统]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    subgraph Prompt[&quot;提示词工程&quot;]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        P22[22. 编码约束]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        P23[23. 风险框架]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        P24[24. 输出效率]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        P22 --&gt; P23</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    subgraph API[&quot;API 交互&quot;]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        API19[19. 多 Provider] --&gt; API20[20. Token 估算]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        API19 --&gt; API21[21. MCP 协议]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        API20 --&gt; C5</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    subgraph Build[&quot;构建 &amp; 数据&quot;]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        B14[14. Feature Flag]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        B15[15. Prompt 分区]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        D16[16. 会话持久化]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        D17[17. CLAUDE.md]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        D18[18. 状态管理]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        U12[12. Ink 引擎]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        U13[13. 全屏消息]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    end</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    A1 --&gt; T9</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    C8 --&gt; B15</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    T10 --&gt; P23</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    style A1 fill:#9b2c2c,color:#fff</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    style C5 fill:#9b2c2c,color:#fff</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    style T9 fill:#744210,color:#fff</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    style P22 fill:#276749,color:#fff</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    style API19 fill:#1a365d,color:#fff</span></span></code></pre></div><h2 id="_8-个学习模块" tabindex="-1">8 个学习模块 <a class="header-anchor" href="#_8-个学习模块" aria-label="Permalink to &quot;8 个学习模块&quot;">​</a></h2><table tabindex="0"><thead><tr><th>优先级</th><th>模块</th><th>包含知识点</th><th>预计时间</th><th>前置要求</th></tr></thead><tbody><tr><td>🔴 P0</td><td>Agent 核心循环</td><td>1. ReAct 循环、2. 错误恢复</td><td>2-3 小时</td><td>了解 LLM API 基本概念</td></tr><tr><td>🔴 P0</td><td>上下文管理</td><td>5. 五层防爆、6. 预算、7. 压缩、8. Cache</td><td>3-4 小时</td><td>完成 Agent 核心循环</td></tr><tr><td>🟡 P1</td><td>工具系统</td><td>9. 类型系统、10. 权限、11. 落盘</td><td>2-3 小时</td><td>完成 Agent 核心循环</td></tr><tr><td>🟡 P1</td><td>提示词工程</td><td>22. 编码约束、23. 风险框架、24. 输出效率</td><td>1-2 小时</td><td>无（可独立阅读）</td></tr><tr><td>🟡 P1</td><td>Agent 进阶</td><td>3. 子 Agent、4. Hook 系统</td><td>2 小时</td><td>完成 Agent 核心循环</td></tr><tr><td>🟢 P2</td><td>API 交互</td><td>19. 多 Provider、20. Token 估算、21. MCP</td><td>2-3 小时</td><td>完成上下文管理</td></tr><tr><td>🟢 P2</td><td>构建系统</td><td>14. Feature Flag、15. Prompt 分区</td><td>1-2 小时</td><td>完成上下文管理</td></tr><tr><td>🟢 P2</td><td>数据与 UI</td><td>16. 会话、17. CLAUDE.md、18. 状态、12-13. UI</td><td>2-3 小时</td><td>无（可独立阅读）</td></tr></tbody></table><h2 id="三种学习路径" tabindex="-1">三种学习路径 <a class="header-anchor" href="#三种学习路径" aria-label="Permalink to &quot;三种学习路径&quot;">​</a></h2><h3 id="🚀-如果你只有-1-天" tabindex="-1">🚀 如果你只有 1 天 <a class="header-anchor" href="#🚀-如果你只有-1-天" aria-label="Permalink to &quot;🚀 如果你只有 1 天&quot;">​</a></h3><p><strong>目标</strong>：理解 Claude Code 的核心架构，能回答&quot;它是怎么工作的&quot;。</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>上午（3 小时）：</span></span>
<span class="line"><span>  1. ReAct 循环工程化 ← 理解整体架构</span></span>
<span class="line"><span>  5. 五层防爆体系    ← 理解上下文管理的核心思想</span></span>
<span class="line"><span></span></span>
<span class="line"><span>下午（3 小时）：</span></span>
<span class="line"><span>  22. 编码行为约束   ← 理解 prompt 设计哲学</span></span>
<span class="line"><span>  23. 风险评估框架   ← 理解安全设计</span></span>
<span class="line"><span>  附录：设计模式速查  ← 快速浏览所有模式</span></span></code></pre></div><p><strong>收获</strong>：掌握 ReAct 循环 + 五层防御 + prompt 设计三大支柱，能向他人解释 Claude Code 的核心设计。</p><h3 id="📚-如果你有-1-周" tabindex="-1">📚 如果你有 1 周 <a class="header-anchor" href="#📚-如果你有-1-周" aria-label="Permalink to &quot;📚 如果你有 1 周&quot;">​</a></h3><p><strong>目标</strong>：深入理解每个子系统，能在自己的项目中复用关键设计。</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Day 1: Agent 核心</span></span>
<span class="line"><span>  1. ReAct 循环 → 2. 错误恢复</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Day 2: 上下文管理</span></span>
<span class="line"><span>  5. 五层防爆 → 6. 工具结果预算 → 7. 压缩意图保持</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Day 3: 上下文管理 + 工具</span></span>
<span class="line"><span>  8. Prompt Cache → 9. 工具类型系统</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Day 4: 工具 + Agent 进阶</span></span>
<span class="line"><span>  10. 权限模式 → 11. 落盘 → 3. 子 Agent → 4. Hook</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Day 5: 提示词 + API</span></span>
<span class="line"><span>  22-24. 提示词三篇 → 19. 多 Provider → 20. Token 估算</span></span></code></pre></div><p><strong>收获</strong>：能够在自己的 AI agent 项目中复用五层防御、决策冻结、草稿纸模式等核心设计。</p><h3 id="🔬-如果你有-2-3-周" tabindex="-1">🔬 如果你有 2-3 周 <a class="header-anchor" href="#🔬-如果你有-2-3-周" aria-label="Permalink to &quot;🔬 如果你有 2-3 周&quot;">​</a></h3><p><strong>目标</strong>：完整掌握所有 24 个知识点，能独立分析和修改 Claude Code 源码。</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>Week 1: 核心架构（知识点 1-8）</span></span>
<span class="line"><span>  按依赖顺序逐篇精读</span></span>
<span class="line"><span>  每篇对照源码阅读</span></span>
<span class="line"><span>  尝试在本地运行关键代码路径</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Week 2: 工具 + 提示词 + API（知识点 9-11, 19-24）</span></span>
<span class="line"><span>  重点关注工具系统和 prompt 设计</span></span>
<span class="line"><span>  尝试修改 prompt 观察行为变化</span></span>
<span class="line"><span>  阅读 MCP 协议实现</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Week 3: 构建 + 数据 + UI + 实践（知识点 12-18）</span></span>
<span class="line"><span>  阅读构建系统和状态管理</span></span>
<span class="line"><span>  完成设计模式速查表的所有模式</span></span>
<span class="line"><span>  尝试实现一个简化版的 ReAct 循环</span></span></code></pre></div><p><strong>收获</strong>：完整理解 Claude Code 的设计哲学，能独立分析源码中的任何模块。</p><h2 id="前置知识" tabindex="-1">前置知识 <a class="header-anchor" href="#前置知识" aria-label="Permalink to &quot;前置知识&quot;">​</a></h2><table tabindex="0"><thead><tr><th>知识领域</th><th>需要程度</th><th>说明</th></tr></thead><tbody><tr><td>TypeScript</td><td>必须</td><td>源码语言，需要理解泛型、类型体操</td></tr><tr><td>LLM API 基础</td><td>必须</td><td>messages API、tool_use、streaming</td></tr><tr><td>React / Ink</td><td>建议</td><td>UI 部分使用 Ink（终端 React），不影响核心理解</td></tr><tr><td>Prompt Engineering</td><td>建议</td><td>有助于理解提示词设计的&quot;为什么&quot;</td></tr><tr><td>AWS / GCP / Azure</td><td>可选</td><td>仅在阅读多 Provider 和 Bedrock/Vertex 时需要</td></tr><tr><td>MCP 协议</td><td>可选</td><td>阅读 MCP 章节前建议了解基本概念</td></tr></tbody></table><h2 id="阅读建议" tabindex="-1">阅读建议 <a class="header-anchor" href="#阅读建议" aria-label="Permalink to &quot;阅读建议&quot;">​</a></h2><ol><li><strong>先看概述再看源码</strong>：每篇文章的&quot;概述&quot;和&quot;设计原因&quot;比代码细节更重要</li><li><strong>关注 Mermaid 图</strong>：流程图是理解架构的最快方式</li><li><strong>对照源码</strong>：文章中的代码片段都标注了源文件位置，建议对照完整源码阅读</li><li><strong>关注注释</strong>：Claude Code 源码中的注释质量很高，经常包含设计决策的背景</li><li><strong>从&quot;应用场景&quot;倒推</strong>：如果你有具体的应用需求，从&quot;可借鉴场景&quot;找到最相关的知识点开始</li></ol>`,25)])])}const k=a(p,[["render",l]]);export{E as __pageData,k as default};

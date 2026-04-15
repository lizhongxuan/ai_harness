# 8. 网络代理隔离

> 源码位置: `codex-rs/network-proxy/`

## 概述

Codex 的网络隔离不仅依赖沙箱的网络限制，还有一个专用的网络代理层。所有网络请求通过代理转发，代理负责域名白名单检查和流量审计。

## 底层原理

### 架构

```
命令执行
  │
  ▼
沙箱（Seatbelt/Landlock）
  │ 网络请求被重定向到本地代理
  ▼
NetworkProxy（codex-rs/network-proxy/）
  │
  ├── 域名白名单检查
  │   ├── 允许 → 转发请求
  │   └── 拒绝 → 返回错误
  │
  ├── 流量审计
  │   └── 记录所有网络请求（域名、端口、时间）
  │
  └── 转发到目标服务器
```

### 配置

```toml
# 在 SandboxPolicy 中配置
[network]
allowed_domains = ["github.com", "*.npmjs.org", "api.openai.com"]
allow_local_binding = true  # 允许绑定本地端口（如 dev server）
```

### 与沙箱的协作

```
沙箱层面：
  - Seatbelt: (deny network*) 禁止直接网络访问
  - Landlock: seccomp 过滤网络系统调用
  - 但允许连接到本地代理端口

代理层面：
  - 接收沙箱内的网络请求
  - 检查目标域名是否在白名单中
  - 白名单内 → 转发
  - 白名单外 → 拒绝 + 记录

效果：双重隔离
  - 即使沙箱有漏洞，代理仍然限制网络访问
  - 即使代理有漏洞，沙箱仍然限制文件系统访问
```

## 设计原因

- **纵深防御**：沙箱 + 代理双重网络隔离
- **可审计**：所有网络请求都经过代理，可以记录和审查
- **灵活**：白名单可以动态更新，不需要重启沙箱
- **防数据泄露**：即使模型被 prompt injection 操纵，也无法将数据发送到未授权的域名

## 关联知识点

- [沙箱架构总览](/codex_docs/sandbox/architecture) — 网络代理在三层体系中的位置
- [策略引擎](/codex_docs/execpolicy/policy-engine) — 网络策略的配置

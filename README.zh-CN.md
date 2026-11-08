<div align="center">
  <img src="./public/assets/logo.png" alt="Simprint Logo" width="120" />
  <h1>Simprint</h1>
  <p>本地优先的指纹浏览器工作台：每个环境都是全新、严格隔离的浏览器环境。</p>
  <p>
    <img alt="License AGPLv3" src="https://img.shields.io/badge/license-AGPLv3-67e8f9?style=flat-square&labelColor=0f172a" />
    <img alt="Desktop Tauri 2" src="https://img.shields.io/badge/desktop-Tauri%202-f59e0b?style=flat-square&labelColor=0f172a" />
    <img alt="UI React 19" src="https://img.shields.io/badge/ui-React%2019-60a5fa?style=flat-square&labelColor=0f172a" />
    <img alt="Runtime Rust 2024" src="https://img.shields.io/badge/runtime-Rust%202024-f97316?style=flat-square&labelColor=0f172a" />
    <img alt="Chromium 156" src="https://img.shields.io/badge/chromium-156-34d399?style=flat-square&labelColor=0f172a" />
  </p>
  <p>
    <a href="./README.md">English</a> | <strong>简体中文</strong>
  </p>
</div>

<p align="center">
  <img src="./docs/assets/demo-gif.gif" alt="Simprint product demo" width="100%" />
</p>

---

## 简介

Simprint 是一个运行在本机的桌面工作台，用来创建、运行和管理多个相互隔离的浏览器环境，并为每个环境配置代理、指纹和自动化流程。

它的目标很明确：**指纹质量**。每个新建环境都有独立的用户数据目录、独立的指纹种子和一套自洽的设备画像，
环境之间的 Canvas、WebGL、音频指纹互不相同，也无法通过时区、语言、屏幕、硬件等信息互相关联；
同一个环境重启后指纹保持不变。

核心数据默认只保存在本机，日常使用与开发都不依赖任何云端服务。

## 功能

### 环境与隔离

- **严格隔离的环境**：每个环境独立的用户数据目录，localStorage、cookie、IndexedDB 互不可见。
- **环境级指纹种子**：由环境 ID 派生，Canvas / WebGL / 音频噪声各环境不同、重启不变。
- **持久化配置**：长期保存环境配置与账号上下文，支持分组、标签、批量操作。
- **启动保证**：指纹配置由浏览器确认已应用后环境才算启动成功；确认失败或超时则启动失败，不会带着默认指纹打开页面。
- **默认浏览器**：在环境的菜单里把某个环境设为默认浏览器，其他软件里点开的链接就固定在这个环境里打开，不询问，可随时取消。Windows 只允许用户自己选择默认浏览器，设置后需要在系统“默认应用”里选一次 Simprint。软件已在运行时链接直接交给它，没运行就静默启动，不弹出主窗口。
- **纯本地单人使用**：没有用户、团队、工作空间、登录、锁屏和数量配额，打开就能用。

### 指纹

| 方面 | 做法 |
| --- | --- |
| UA 与客户端提示 | `User-Agent`、`Sec-CH-UA` 请求头、`navigator.userAgentData` 同源生成，品牌、平台、版本一致 |
| 语言与地区 | 语言、`Accept-Language`、`Intl`、时区、地理位置按环境生效，页面与 Worker 一致；可设为"跟随代理出口 IP"自动匹配 |
| 屏幕 | `screen`、`devicePixelRatio`、CSS 媒体查询（`device-width`、`resolution`、指针类型）使用同一套配置 |
| 硬件 | `hardwareConcurrency`、`deviceMemory`（最大 8，与真实 Chrome 一致）、WebGL 供应商/渲染器、WebGPU 适配器信息成套匹配 |
| Canvas / WebGL / 音频 | 按环境种子加入稳定噪声，不破坏页面渲染 |
| 字体 | 只向网页暴露白名单内的系统字体，网页字体不受影响 |
| WebRTC | 默认禁用，不收集 host/srflx 候选，SDP、事件和 `getStats()` 都拿不到真实 IP |
| 其他 | 语音列表、媒体设备、触摸点、Do Not Track、浏览器界面语言均跟随环境配置 |

新建环境时，GPU、核心数、内存、分辨率和缩放比例来自同一套按档位生成的设备画像，不会出现"4 核配旗舰显卡"这类矛盾组合。

### 代理与网络

- **代理管理**：在不同环境中接入、分配和管理代理资源。
- **出口信息自动匹配**：语言、时区、地理位置可设为"跟随代理出口 IP"。

### 自动化与扩展

- **RPA 工作流**：构建并运行可重复执行的浏览器自动化流程。
- **同步器（Syncer）**：选择主控窗口，把交互同步到其他运行中的窗口。
- **本地 API**：通过本机 API 控制环境、代理、标签、分组和浏览器内核，使用 API Key 鉴权；默认开启。
- **MCP**：可选的本地 Model Context Protocol 服务（默认关闭），让外部 AI 客户端使用你的环境。

### 浏览器内核

- 使用定制的 Chromium 内核（当前为 **156**，计划同时支持 158、159），内核只能由 Simprint 启动。
- 内核通过内核目录（`config/browser-kernels.json`）注册，目录里记录名称、版本、校验信息和下载地址，下载地址可配置。
- 内核补丁与构建产物不在本仓库。

## 快速开始

完整的 Windows 从零开发配置步骤见 [开发配置文档](./docs/development-setup.zh-CN.md)。

### 环境要求

- Node.js 20 及以上
- `pnpm` 9
- Rust 工具链
- 目标平台所需的 Tauri 系统依赖
- 一个可用的浏览器内核（Windows x86_64）

### 本地运行

```powershell
pnpm install --frozen-lockfile
cargo tauri dev
```

启动桌面端无需预先配置或运行额外服务。

## 文档

- [开发配置](./docs/development-setup.zh-CN.md)
- [实施记录 04：内核 156 与指纹隔离加固](./docs/implementation-04.zh-CN.md)：本轮修复的 bug、新增功能、验证结果和已知不足
- [静态检查基线](./docs/baseline/README.zh-CN.md)
- [贡献指南](./CONTRIBUTING.md)

## 当前状态

个人自用、本地优先。早期遗留的计费、升级提示等商业化界面仍会逐步清理；环境数量上限已放开。

已知不足：

- 内核目前仅在 Windows x86_64 上验证，且只有 156 完成；158、159 待移植。
- 代理丢失或检测失败时回退直连的行为尚未处理。
- 机房 IP 会被 IP 信誉类检测识别，建议使用住宅代理。
- 旧版本创建的环境保存的是旧的硬件配置，新建环境才会使用新的设备画像。

## 数据说明

核心业务数据默认保存在本机。内核下载、应用更新、代理以及外部网站等需要联网的功能，仍会访问相应的第三方服务。

## 许可

本项目采用 GNU Affero General Public License v3.0 (AGPLv3) 进行许可，详见 [LICENSE](./LICENSE)。

<div align="center">
  <img src="./public/assets/logo.png" alt="MZ指纹浏览器 Logo" width="120" />
  <h1>MZ指纹浏览器</h1>
  <p>本地优先的指纹浏览器工作台：每个环境都是一个独立、隔离、指纹自洽的浏览器。</p>
  <p>
    <img alt="License AGPLv3" src="https://img.shields.io/badge/license-AGPLv3-67e8f9?style=flat-square&labelColor=0f172a" />
    <img alt="Desktop Tauri 2" src="https://img.shields.io/badge/desktop-Tauri%202-f59e0b?style=flat-square&labelColor=0f172a" />
    <img alt="UI React 19" src="https://img.shields.io/badge/ui-React%2019-60a5fa?style=flat-square&labelColor=0f172a" />
    <img alt="Runtime Rust 2024" src="https://img.shields.io/badge/runtime-Rust%202024-f97316?style=flat-square&labelColor=0f172a" />
    <img alt="Kernels" src="https://img.shields.io/badge/kernels-Chromium%20155--157%20%7C%20Firefox%20158-34d399?style=flat-square&labelColor=0f172a" />
  </p>
  <p>
    <a href="./README.md">English</a> | <strong>简体中文</strong>
  </p>
</div>

---

## 简介

MZ指纹浏览器是一款运行在你自己电脑上的桌面软件，用来创建、运行和管理大量相互隔离的浏览器环境。每个环境有自己的数据目录、代理、指纹和账号，并可以用 RPA 任务流或 AI（MCP）自动操作。

数据默认只保存在本机。没有账号体系、没有云端服务、没有环境数量限制，打开就能用。

## 特点

- **内核级指纹**：指纹在浏览器内核的 C++ 层修改，不是向页面注入 JS，页面脚本无法通过检查函数或原型发现改动。
- **指纹自洽**：UA、Client Hints、平台、GPU、核心数、内存、分辨率来自同一份设备档案，不会出现“4 核配旗舰显卡”这样的矛盾组合。
- **环境稳定**：指纹由环境 ID 派生，重启不变；真实的浏览器完整版本号在创建时固定；内核不会被强制更新，什么时候升级由你决定。
- **启动有保证**：浏览器确认指纹配置已生效，环境才算启动成功。确认失败就直接启动失败，不会带着默认指纹打开页面。
- **严格隔离**：每个环境独立的数据目录，Cookie、localStorage、IndexedDB 互不共享。
- **真实操作**：RPA 使用真实的鼠标键盘事件，带拟人轨迹和打字节奏，页面看到的是 `isTrusted=true` 的事件；脚本在隔离环境执行，页面感知不到。
- **本地优先**：单用户工作台，业务数据存在本地 SQLite，日常使用和开发都不依赖任何云服务。

## 功能

### 环境管理

- 单个或批量创建环境，支持分组、标签、批量操作、导入导出和回收站。
- 每个环境可配置启动网址、Cookie、绑定账号和代理。
- 可把某个环境设为系统默认浏览器，其他软件里点击的链接直接在这个环境打开。

### 浏览器内核

| 内核 | 版本 | 平台 |
| --- | --- | --- |
| Chromium（定制） | 155、156、157 | Windows x64 |
| Firefox（基于 Camoufox） | 158 | Windows x64 |

内核按需从 [browser-kernel](https://github.com/mouzhai163/browser-kernel) 的 Releases 下载并校验。有新版本时在“设置 → 浏览器与自动化 → 浏览器内核”提示，手动更新。

### 指纹

| 项目 | 做法 |
| --- | --- |
| UA 与 Client Hints | `User-Agent`、`Sec-CH-UA` 请求头和 `navigator.userAgentData` 同源，品牌、平台、版本一致 |
| 语言与地区 | 语言、`Accept-Language`、`Intl`、时区、地理位置在页面和 Worker 中一致，可跟随代理出口 IP |
| 屏幕 | `screen`、`devicePixelRatio` 和 CSS 媒体查询使用同一份配置 |
| 硬件 | 核心数、内存、WebGL 厂商与渲染器、WebGPU 信息成套匹配 |
| Canvas / WebGL / 音频 | 按环境种子加入稳定噪声，不破坏页面渲染 |
| 字体 | 只向页面暴露白名单内的系统字体，不影响网页字体 |
| WebRTC | 可选真实、替换（走代理）、禁用。替换模式下使用 SOCKS5 代理时，UDP 经代理转发，不会暴露真实 IP 和局域网 IP |
| 其他 | 语音、媒体设备、触控点、Do Not Track、浏览器界面语言跟随环境 |

环境启动时自动打开检测页，集中显示出口 IP、WebRTC 和各项参数。

### 代理与账号

- 代理中心：添加、批量导入导出、检测并分配给环境。
- 内置 Mihomo 支持，可连接本地 Clash 内核使用节点。
- 账号管理：保存账号并绑定到环境，支持批量导入导出。

### 浏览器插件

本地插件库，可通过 CRX 文件或商店链接导入，导入后可以启用、停用和卸载。

### RPA 任务流

- **步骤列表编辑器**：点击添加、拖动排序，条件和循环缩进显示，支持撤销。
- **21 种步骤**：打开网页、点击、输入、悬停、按键、下拉选择、滚动、截图、刷新、前进后退、切换和关闭标签、等待、条件、循环、退出循环、提取数据、设置变量、上传文件、执行脚本。
- **拾取元素**：在浏览器里点一下记录目标，自动生成备选选择器，支持同源 iframe 和 shadow DOM。
- **提取列表**：拾取列表里任意一项，自动匹配同类元素，一次提取全部。
- **单步调试**：运行单步或从某一步开始运行，页面和变量在几次运行之间保留。
- **多环境执行**：逐个或并发运行，支持失败重试、超时、出错时停止，同一环境不会被同时占用。
- **定时任务**：每小时、每天、每周或自定义 Cron。软件没开时错过的不补跑。
- **运行记录**：每一步的结果和截图，提取的数据可导出 CSV，完成或失败时可发系统通知。

### 同步器

选择一个主控窗口，把操作同步到其他正在运行的窗口。

### AI 接入（MCP）

内置本地 Model Context Protocol 服务（默认关闭，仅监听 `127.0.0.1`，需要访问密钥），让外部 AI 客户端使用你的环境。权限分档，由你逐项开启：

| 权限档 | 能做什么 |
| --- | --- |
| 基础 | 查看已授权的环境及其状态 |
| 页面读取 | 读取已授权环境的标签和页面结构，输入框内容和密码隐藏 |
| 页面操作 | 在已授权环境中打开网页、点击、输入、按键 |
| 完全页面访问 | 读取和填写输入框、密码框；允许 RPA 脚本和上传步骤 |
| 管理 | 管理环境、分组、代理、标签、内核和 RPA 任务 |

运行 RPA 任务要求页面操作权限，且任务绑定的环境都已授权。在本机执行的脚本不能通过 MCP 使用。

## 快速开始

### 使用

运行安装包 `MZ指纹浏览器_x.y.z_x64-setup.exe`，打开后点“创建环境”。首次启动环境时会自动下载所需内核。

系统要求：Windows 10 / 11 x64。

### 从源码运行

需要 Node.js 20+、pnpm、Rust 工具链和 Tauri 的系统依赖。

```powershell
pnpm install --frozen-lockfile
cargo tauri dev
```

常用检查：

```powershell
pnpm test
pnpm lint
pnpm rust:check
```

## 已知限制

- 内核只在 Windows x64 上验证过。
- 跨域 iframe 内的元素暂不支持 RPA 操作。
- 代理断开或检测失败时的处理还不完善。
- 旧版本创建的环境保留原来的硬件配置，只有新环境使用新的设备档案。

## 数据与隐私

业务数据默认保存在本机。下载内核、使用代理、访问网站等需要联网的功能，会按需连接相应的第三方服务。

## 使用须知

本软件用于隐私保护、多账号管理、测试和自动化等合法用途。使用时请遵守当地法律和目标网站的服务条款。任何指纹方案都不保证不被检测。

## 来源与致谢

MZ指纹浏览器基于 Simprint 团队的 [Simprint](https://github.com/Simprint/simprint) 二次开发并独立维护，内核补丁同样来自 [simprint-browser-kernel](https://github.com/Simprint/simprint-browser-kernel)。感谢原项目开源。

在原项目之上的主要改动：Chromium 155–157 内核和指纹加固、Firefox 内核、WebRTC 经 SOCKS5 转发、默认浏览器、移除用户/团队/工作区/登录/环境配额、重做 RPA 任务流、MCP 分档权限和 RPA 工具、改名和新图标。

原项目的名称和商标不属于本项目。

## 许可证

本项目以 [GNU Affero General Public License v3.0](./LICENSE)（AGPLv3）授权，沿用原项目的许可证，并保留原有的版权和许可声明。

**允许**：个人或公司使用、修改、再分发.

**要求**：

- 把软件（含修改版）提供给他人时，必须同时提供完整的对应源码（包括修改和构建脚本），并同样以 AGPLv3 授权。
- 保留版权和许可声明，并标明你做的修改。
- 通过网络向用户提供修改版的服务时，必须向这些用户提供源码。
- 不得附加许可证之外的限制。

闭源分发或闭源服务需要取得全部版权人的单独授权。

**第三方组件**各有自己的许可证：Chromium（BSD 风格及其第三方组件）、Firefox 和 Camoufox（MPL-2.0）、其余依赖主要为 MIT、Apache-2.0、BSD、MPL-2.0。Chrome、Firefox 等名称是各自权利人的商标。内核启用了 H.264、AAC 等专有编解码器，这些编解码器可能涉及专利授权。

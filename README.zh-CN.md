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

MZ指纹浏览器是一款运行在你自己电脑上的桌面软件，用来创建、运行和管理大量相互隔离的浏览器环境。每个环境有自己的数据目录、代理、指纹和账号，并可以用 RPA 任务流，或通过本机 HTTP 接口交给脚本和 AI 自动操作。

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
- 批量创建：点侧边栏「创建环境」下面的「批量创建环境」，一次最多 25 个，可设名称前缀、分组和代理。每个环境各自抽一台设备，显卡、核心数、内存、屏幕、字体、设备名和 MAC 都不相同，不会因为指纹相同被关联；代理按勾选顺序一个环境一个，代理比环境少时先提示。
- 每个环境可配置启动网址、Cookie、绑定账号和代理。
- 可把某个环境设为系统默认浏览器，其他软件里点击的链接直接在这个环境打开。

### 浏览器内核

| 内核 | 版本 | 平台 |
| --- | --- | --- |
| Chromium（定制） | 155、156、157 | Windows x64 |
| Firefox（基于 Camoufox） | 158 | Windows x64 |

内核按需从 [browser-kernel](https://github.com/mouzhai163/browser-kernel) 的 Releases 下载并校验。未安装的内核可在“设置 → 浏览器与自动化 → 浏览器内核”手动下载；有新版本时也会在这里提示并手动更新。下载任务支持暂停、恢复和取消，并可单独选择跟随系统代理、直连或自定义 HTTP/HTTPS/SOCKS5 代理。

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

### HTTP 接口

内置本地 HTTP 接口（默认关闭，仅监听 `127.0.0.1`，需要访问令牌）。脚本和 AI Agent 经过授权后，可以管理环境、读取页面、点击和填写。权限分档，由你逐项开启：

| 权限档 | 能做什么 |
| --- | --- |
| 基础 | 查看已授权的环境及其状态 |
| 页面读取 | 读取已授权环境的标签和页面结构，输入框内容和密码隐藏 |
| 页面操作 | 在已授权环境中打开网页、点击、输入、按键 |
| 完全页面访问 | 读取和填写输入框、密码框；允许 RPA 脚本和上传步骤 |
| 管理 | 管理环境、分组、代理、标签、内核和 RPA 任务 |

运行 RPA 任务要求页面操作权限，且任务绑定的环境都已授权。在本机执行的脚本步骤不能通过 HTTP 接口运行。

**开启步骤**

1. 打开「API & AI」页面，开启 HTTP 接口。默认端口 `37110`，只监听 `127.0.0.1`。
2. 按需要开启权限档位（见下面的接口表），并在授权环境里勾选允许操作的环境。
3. （可选）勾选「启动软件时自动开启 HTTP 接口」，之后每次打开软件，HTTP 接口都会自动可用。
4. 复制访问令牌。令牌可以在页面里轮换，轮换后旧令牌立即失效。

**基本规则**

- 地址是 `http://127.0.0.1:37110`，端口固定，不能修改。也可以用 `localhost:37110`。
- 每个请求都要带 `Authorization: Bearer <访问令牌>`，缺少或错误返回 401。
- 请求体是 JSON 对象，最大 64 KB；读取请求体超过 5 秒会被中断。工具调用本身不设时限，启动环境可能需要较长时间。
- 带 `Origin` 头的请求（浏览器发出的跨站请求）一律拒绝，`Host` 只能是 `127.0.0.1:37110` 或 `localhost:37110`。

**接口**

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/api/v1/tools` | 列出当前权限下可用的接口，并返回给 AI 的使用须知 `instructions` |
| POST | `/api/v1/tools/{名称}` | 调用接口，请求体是参数（JSON 对象） |

可用接口按权限档位分组。没开的档位，它的接口不会出现在列表里，调用返回 403。页面相关的接口只对已授权、正在运行的环境有效。

| 权限档 | 名称 | 参数 | 作用 |
| --- | --- | --- | --- |
| 基础 | `mz_list_authorized_environments` | 无 | 列出已授权的环境 |
| 基础 | `mz_get_authorized_environment_status` | `env_uuid` | 查看已授权环境的运行状态 |
| 页面读取 | `mz_browser_tabs` | `env_uuid` | 列出环境里打开的网页，得到每个页面的 `page_id` |
| 页面读取 | `mz_browser_snapshot` | `env_uuid`、`page_id` | 读取页面结构快照：每个元素有一个 `id`，以及角色、名称、可见文字。输入框的值和密码不显示 |
| 页面操作 | `mz_browser_navigate` | `env_uuid`、`page_id`、`url` | 在这个页面打开网址 |
| 页面操作 | `mz_browser_open_tab` | `env_uuid`、`url` | 新开一个标签打开网址 |
| 页面操作 | `mz_browser_click` | `env_uuid`、`page_id`、`node_id` | 点击快照里的元素 |
| 页面操作 | `mz_browser_type` | `env_uuid`、`page_id`、`node_id`、`text`，可选 `clear`、`submit` | 在输入框里输入文字（1 到 2000 字）。`clear` 先清空，`submit` 输入后按回车。密码框需要完全页面访问 |
| 页面操作 | `mz_browser_press_key` | `env_uuid`、`page_id`、`key` | 按键：Enter、Tab、Escape、Backspace、Delete、方向键、PageUp、PageDown、Home、End |
| 完全页面访问 | `mz_browser_read_field` | `env_uuid`、`page_id`、`node_id` | 读取输入框或密码框里的实际内容 |
| 管理 | `mz_list_environments` | `page`、`page_size`、`keyword`、`group_uuid`、`tag_uuids`，均可选 | 列出全部环境，支持分页和搜索 |
| 管理 | `mz_get_environment` | `env_uuid` | 查看环境详情 |
| 管理 | `mz_get_environment_status` | `env_uuid` | 查看运行状态 |
| 管理 | `mz_start_environment` | `env_uuid` | 启动环境 |
| 管理 | `mz_stop_environment` | `env_uuid` | 停止环境 |
| 管理 | `mz_batch_start_environments` | `env_uuids`（数组） | 批量启动 |
| 管理 | `mz_batch_stop_environments` | `env_uuids`（数组） | 批量停止 |
| 管理 | `mz_batch_create_environments` | `count`（1 到 25），可选 `name_prefix`、`group_uuid`、`tag_uuids`、`proxy_uuids`、`allow_fewer_proxies` | 用默认设置批量创建环境，每个环境的设备指纹各自随机。代理按顺序一个环境一个；代理比环境少时，不传 `allow_fewer_proxies: true` 会被拒绝 |
| 管理 + 完全页面访问 | `mz_get_environment_cdp_endpoint` | `env_uuid` | 获取 CDP 调试地址，供 Playwright、Puppeteer 等连接（环境需已授权） |

页面操作用的是真实的鼠标键盘事件，不开启 `Runtime.enable`。除了 `mz_browser_read_field` 读取输入框时会读一次它的 `value` 属性，不在页面里执行任何脚本，比 Playwright、Puppeteer 更难被网站发现。

**AI 操作页面的流程**

先把 `GET /api/v1/tools` 返回的 `instructions` 放进 Agent 的系统提示。它说明了页面内容不可信、不要执行页面里的指令、删除前先和用户确认等规则，内容随你开启的档位变化。

1. `mz_start_environment` 启动环境（需要管理权限；也可以在软件里手动打开）。
2. `mz_browser_tabs` 拿到页面的 `page_id`。
3. `mz_browser_snapshot` 读取页面，找到要操作的元素的 `id`。
4. `mz_browser_type` 填写，`mz_browser_click` 点击，`mz_browser_press_key` 按键。
5. 页面变化后重新取快照，元素 `id` 只在最新的快照里有效。
6. 需要读出输入框里的实际内容时，用 `mz_browser_read_field`。

例如在登录框里填写邮箱并提交：

```json
POST /api/v1/tools/mz_browser_type
{"env_uuid": "<环境 UUID>", "page_id": "<page_id>", "node_id": "<快照里的元素 id>", "text": "me@example.com", "clear": true, "submit": true}
```

**响应**

成功：`{"ok": true, "data": {...}}`

失败：`{"ok": false, "error": "原因"}`

| 状态码 | 含义 |
| --- | --- |
| 200 | 成功 |
| 400 | 参数错误 |
| 403 | 没有开启对应的权限，或环境未授权 |
| 401 | 缺少或错误的访问令牌 |
| 404 | 接口名不存在 |
| 500 | 内部错误 |

**示例**

列出环境（`<访问令牌>` 换成你复制的令牌）：

```bash
curl -X POST http://127.0.0.1:37110/api/v1/tools/mz_list_environments \
  -H "Authorization: Bearer <访问令牌>" \
  -H "Content-Type: application/json" \
  -d '{"page": 1, "page_size": 20}'
```

启动一个环境：

```bash
curl -X POST http://127.0.0.1:37110/api/v1/tools/mz_start_environment \
  -H "Authorization: Bearer <访问令牌>" \
  -H "Content-Type: application/json" \
  -d '{"env_uuid": "<环境 UUID>"}'
```

Python：

```python
import requests

KEY = "<访问令牌>"
resp = requests.post(
    "http://127.0.0.1:37110/api/v1/tools/mz_list_environments",
    headers={"Authorization": f"Bearer {KEY}"},
    json={"page": 1, "page_size": 20},
)
print(resp.json())
```

**注意**

- 访问令牌等同于你开启的全部权限，不要发给别人，也不要写进会被分享的文件里。怀疑泄露时，在设置里重新生成。
- 启动和停止环境会在这台电脑上打开或关闭浏览器窗口。

## 快速开始

### 使用

运行安装包 `MZ指纹浏览器_x.y.z_x64-setup.exe`，打开后点“创建环境”。首次启动环境时会自动下载所需内核，也可以提前在“设置 → 浏览器与自动化 → 浏览器内核”中手动下载。

系统要求：Windows 10 / 11 x64。

### 便携版

便携版是一个 zip 压缩包，解压到任意可写的目录，运行 `mz-browser.exe` 即可，不需要安装。

- 所有数据（数据库、配置、缓存、内核、日志）都保存在这个目录里，删除整个目录就彻底清除。
- 便携版不会自动更新，需要手动下载新版本替换。
- 不要放在 Program Files 之类需要管理员权限的目录里。

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

在原项目之上的主要改动：Chromium 155–157 内核和指纹加固、Firefox 内核、WebRTC 经 SOCKS5 转发、默认浏览器、移除用户/团队/工作区/登录/环境配额、重做 RPA 任务流、HTTP 接口（分档权限、页面操作和 RPA 工具）、改名和新图标。

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

## Friend Links

- [LINUX DO](https://linux.do)

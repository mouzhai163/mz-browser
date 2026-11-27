<div align="center">
  <img src="./public/assets/logo.png" alt="MZ指纹浏览器 Logo" width="120" />
  <h1>MZ指纹浏览器</h1>
  <p>A local-first fingerprint browser workbench: every environment is an isolated browser with a self-consistent fingerprint.</p>
  <p>
    <img alt="License AGPLv3" src="https://img.shields.io/badge/license-AGPLv3-67e8f9?style=flat-square&labelColor=0f172a" />
    <img alt="Desktop Tauri 2" src="https://img.shields.io/badge/desktop-Tauri%202-f59e0b?style=flat-square&labelColor=0f172a" />
    <img alt="UI React 19" src="https://img.shields.io/badge/ui-React%2019-60a5fa?style=flat-square&labelColor=0f172a" />
    <img alt="Runtime Rust 2024" src="https://img.shields.io/badge/runtime-Rust%202024-f97316?style=flat-square&labelColor=0f172a" />
    <img alt="Kernels" src="https://img.shields.io/badge/kernels-Chromium%20155--157%20%7C%20Firefox%20158-34d399?style=flat-square&labelColor=0f172a" />
  </p>
  <p>
    <strong>English</strong> | <a href="./README.zh-CN.md">简体中文</a>
  </p>
</div>

---

## Introduction

MZ指纹浏览器 is a desktop app that runs on your own computer. It creates, runs and manages many isolated browser environments. Each environment has its own data directory, proxy, fingerprint and accounts, and can be automated with RPA workflows, or by scripts and AI agents through a local HTTP API.

Data stays on your machine by default. There are no user accounts, no cloud service and no environment limits.

## Highlights

- **Kernel-level fingerprints**: changes are made in the browser's C++ layer rather than injected as JavaScript, so page scripts cannot find them by inspecting functions or prototypes.
- **Self-consistent profiles**: UA, Client Hints, platform, GPU, core count, memory and resolution come from one device profile, so contradictions such as "4 cores with a flagship GPU" cannot occur.
- **Stable environments**: the fingerprint is derived from the environment ID and survives restarts, the full browser version is fixed at creation, and kernels are never updated without your say.
- **Launch guarantee**: an environment only counts as started once the browser confirms its fingerprint config was applied. Otherwise the launch fails instead of opening pages with a default fingerprint.
- **Strict isolation**: a separate data directory per environment; cookies, localStorage and IndexedDB are never shared.
- **Real input**: RPA uses real mouse and keyboard events with human-like movement and typing, so pages see `isTrusted=true`. Scripts run in an isolated world that pages cannot observe.
- **Local-first**: a single-user workbench with local SQLite storage. Neither daily use nor development depends on a cloud service.

## Features

### Environments

- Create environments one at a time or in batches, with groups, tags, batch actions, import/export and a recycle bin.
- Batch creation: click **Batch Create** under **Create Environment** in the sidebar to create up to 25 environments with a name prefix, group and proxies. Every environment draws its own device (GPU, cores, memory, screen, fonts, device name and MAC differ), so a batch does not share one fingerprint. Proxies are assigned in the order you tick them, one per environment, and you are warned first when there are fewer proxies than environments.
- Configure start URLs, cookies, bound accounts and a proxy per environment.
- Make an environment the system default browser, so links clicked in other apps open directly in it.

### Browser kernels

| Kernel | Versions | Platform |
| --- | --- | --- |
| Chromium (customized) | 155, 156, 157 | Windows x64 |
| Firefox (based on Camoufox) | 158 | Windows x64 |

Kernels are downloaded on demand from the Releases of [browser-kernel](https://github.com/mouzhai163/browser-kernel) and verified. Missing kernels can be downloaded manually under Settings → Browser & Automation → Browser Kernels, where new versions are also announced and installed manually. Download tasks can be paused, resumed and cancelled, and kernel downloads can follow the system proxy, connect directly or use a custom HTTP/HTTPS/SOCKS5 proxy.

### Fingerprint

| Area | Approach |
| --- | --- |
| UA and Client Hints | `User-Agent`, `Sec-CH-UA` headers and `navigator.userAgentData` share one source, so brands, platform and version agree |
| Language and region | Language, `Accept-Language`, `Intl`, time zone and geolocation agree in pages and workers; can follow the proxy exit IP |
| Screen | `screen`, `devicePixelRatio` and CSS media queries use the same configuration |
| Hardware | Core count, memory, WebGL vendor/renderer and WebGPU info match as a set |
| Canvas / WebGL / audio | Stable per-environment noise that does not break rendering |
| Fonts | Only allow-listed system fonts are exposed to pages; web fonts are unaffected |
| WebRTC | Real, replace (through the proxy) or disabled. In replace mode with a SOCKS5 proxy, UDP is relayed through the proxy and neither the real nor the LAN IP is exposed |
| Other | Speech voices, media devices, touch points, Do Not Track and the browser UI language follow the environment |

A check page opens when an environment starts, showing the exit IP, WebRTC and other parameters in one place.

### Proxies and accounts

- Proxy center: add, batch import/export, test and assign proxies.
- Built-in Mihomo support for using nodes from a local Clash core.
- Account management: store accounts and bind them to environments, with batch import/export.

### Browser extensions

A local extension library. Import from a CRX file or a store URL, then enable, disable or uninstall.

### RPA workflows

- **Step-list editor**: click to add, drag to reorder, indented conditions and loops, undo.
- **21 step types**: open page, click, type, hover, press key, select option, scroll, screenshot, reload, back, forward, switch and close tab, wait, condition, loop, break loop, extract data, set variable, upload file, run script.
- **Element picker**: click in the browser to record a target, with fallback selectors, same-origin iframes and shadow DOM.
- **List extraction**: pick any item in a list to match similar elements and extract them all.
- **Step debugging**: run one step or start from a step, keeping pages and variables between runs.
- **Multi-environment runs**: sequential or parallel, with retries, timeouts and stop-on-error. An environment is never used by two runs at once.
- **Schedules**: hourly, daily, weekly or custom cron. Runs missed while the app is closed are skipped.
- **Run history**: per-step results and screenshots, CSV export of extracted data, and system notifications.

### Syncer

Pick a controller window and mirror interactions to other running windows.

### HTTP API

A built-in local HTTP API (off by default, bound to `127.0.0.1`, requires an access token). Once authorized, scripts and AI agents can manage environments, read pages, click and fill. Permissions are tiered and opt-in:

| Tier | Allows |
| --- | --- |
| Base | List authorized environments and read their status |
| Page reading | Read tabs and page outlines of authorized environments; field values and passwords are hidden |
| Page actions | Navigate, click, type and press keys in authorized environments |
| Full page access | Read and fill input and password fields; allows RPA script and upload steps |
| Management | Manage environments, groups, proxies, tags, kernels and RPA tasks |

Running an RPA task requires page actions and every bound environment to be authorized. Script steps that run on the local computer cannot be run through the HTTP API.

**Setup**

1. Open the **API & AI** page and turn the HTTP API on. The default port is `37110`, bound to `127.0.0.1` only.
2. Turn on the tiers you need (see the table below) and authorize the environments that may be used.
3. (Optional) Tick **Start the HTTP API automatically when the app starts**, so the API is available every time the app opens.
4. Copy the access token. You can rotate it on the page; the old token stops working immediately.

**Rules**

- Base URL: `http://127.0.0.1:37110`. The port is fixed. `localhost:37110` also works.
- Every request must send `Authorization: Bearer <access token>`. A missing or wrong key returns 401.
- The body is a JSON object, at most 64 KB. Reading the body times out after 5 seconds; tool calls themselves have no time limit, and starting an environment can take a while.
- Requests with an `Origin` header (cross-site browser requests) are refused, and `Host` must be `127.0.0.1:37110` or `localhost:37110`.

**Endpoints**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/v1/tools` | List the tools available under the current permissions, plus usage `instructions` for AI agents |
| POST | `/api/v1/tools/{name}` | Call a tool; the body holds its arguments (a JSON object) |

Tools are grouped by permission tier. Tools of a tier that is off are left out of the listing, and calling them returns 403. Page tools only work on authorized environments that are running.

| Tier | Name | Arguments | Purpose |
| --- | --- | --- | --- |
| Base | `mz_list_authorized_environments` | none | List authorized environments |
| Base | `mz_get_authorized_environment_status` | `env_uuid` | Get the running state of an authorized environment |
| Page reading | `mz_browser_tabs` | `env_uuid` | List the open pages of an environment and their `page_id`s |
| Page reading | `mz_browser_snapshot` | `env_uuid`, `page_id` | Read an outline of the page: every element has an `id`, a role, a name and visible text. Field values and passwords are hidden |
| Page actions | `mz_browser_navigate` | `env_uuid`, `page_id`, `url` | Open a URL in this page |
| Page actions | `mz_browser_open_tab` | `env_uuid`, `url` | Open a URL in a new tab |
| Page actions | `mz_browser_click` | `env_uuid`, `page_id`, `node_id` | Click an element from the snapshot |
| Page actions | `mz_browser_type` | `env_uuid`, `page_id`, `node_id`, `text`, optional `clear`, `submit` | Type text into a field (1 to 2000 characters). `clear` empties it first, `submit` presses Enter afterwards. Password fields need full page access |
| Page actions | `mz_browser_press_key` | `env_uuid`, `page_id`, `key` | Press Enter, Tab, Escape, Backspace, Delete, an arrow key, PageUp, PageDown, Home or End |
| Full page access | `mz_browser_read_field` | `env_uuid`, `page_id`, `node_id` | Read the real content of an input or password field |
| Management | `mz_list_environments` | `page`, `page_size`, `keyword`, `group_uuid`, `tag_uuids` (all optional) | List all environments, with paging and search |
| Management | `mz_get_environment` | `env_uuid` | Get environment details |
| Management | `mz_get_environment_status` | `env_uuid` | Get the running state |
| Management | `mz_start_environment` | `env_uuid` | Start an environment |
| Management | `mz_stop_environment` | `env_uuid` | Stop an environment |
| Management | `mz_batch_start_environments` | `env_uuids` (array) | Start several environments |
| Management | `mz_batch_stop_environments` | `env_uuids` (array) | Stop several environments |
| Management | `mz_batch_create_environments` | `count` (1 to 25), optional `name_prefix`, `group_uuid`, `tag_uuids`, `proxy_uuids`, `allow_fewer_proxies` | Create environments with default settings, each with its own random device fingerprint. Proxies are assigned in order, one per environment; with fewer proxies than environments the call is refused unless `allow_fewer_proxies` is true |
| Management + full page access | `mz_get_environment_cdp_endpoint` | `env_uuid` | Get the CDP debugging address for Playwright, Puppeteer and similar tools (the environment must be authorized) |

Page actions use real mouse and keyboard events and do not turn on `Runtime.enable`. Apart from `mz_browser_read_field` reading a field's `value` property once, no script runs in the page, so they are harder for sites to detect than Playwright or Puppeteer.

**How an AI works a page**

First put the `instructions` returned by `GET /api/v1/tools` into the agent's system prompt. They say that page content is untrusted, that instructions inside pages must not be followed, and that destructive actions need the user's confirmation; the text follows the tiers you turned on.

1. Start the environment with `mz_start_environment` (needs Management), or open it in the app.
2. Get the `page_id` from `mz_browser_tabs`.
3. Read the page with `mz_browser_snapshot` and find the `id` of the element to use.
4. Fill with `mz_browser_type`, click with `mz_browser_click`, press keys with `mz_browser_press_key`.
5. Take a new snapshot after the page changes; element ids are only valid in the latest snapshot.
6. Use `mz_browser_read_field` to read what a field actually contains.

For example, fill an email field and submit:

```json
POST /api/v1/tools/mz_browser_type
{"env_uuid": "<environment UUID>", "page_id": "<page_id>", "node_id": "<element id from the snapshot>", "text": "me@example.com", "clear": true, "submit": true}
```

**Responses**

Success: `{"ok": true, "data": {...}}`

Failure: `{"ok": false, "error": "reason"}`

| Status | Meaning |
| --- | --- |
| 200 | Success |
| 400 | Bad arguments |
| 403 | The required tier is not enabled, or the environment is not authorized |
| 401 | Missing or wrong access token |
| 404 | No such tool |
| 500 | Internal error |

**Examples**

List environments (replace `<access token>` with your key):

```bash
curl -X POST http://127.0.0.1:37110/api/v1/tools/mz_list_environments \
  -H "Authorization: Bearer <access token>" \
  -H "Content-Type: application/json" \
  -d '{"page": 1, "page_size": 20}'
```

Start one environment:

```bash
curl -X POST http://127.0.0.1:37110/api/v1/tools/mz_start_environment \
  -H "Authorization: Bearer <access token>" \
  -H "Content-Type: application/json" \
  -d '{"env_uuid": "<environment UUID>"}'
```

Python:

```python
import requests

KEY = "<access token>"
resp = requests.post(
    "http://127.0.0.1:37110/api/v1/tools/mz_list_environments",
    headers={"Authorization": f"Bearer {KEY}"},
    json={"page": 1, "page_size": 20},
)
print(resp.json())
```

**Notes**

- The access token carries every permission you turned on. Do not share it or put it in files that get shared. If it may have leaked, regenerate it in the settings.
- Starting and stopping environments opens and closes browser windows on this computer.

## Quick Start

### Install

Run `MZ指纹浏览器_x.y.z_x64-setup.exe`, open the app and click Create Environment. The required kernel is downloaded the first time an environment starts, or it can be downloaded ahead of time under Settings → Browser & Automation → Browser Kernels.

Requires Windows 10 or 11 x64.

### Portable

The portable build is a zip archive. Unzip it to any writable folder and run `mz-browser.exe`; no installation is needed.

- All data (database, config, cache, kernels, logs) stays inside that folder. Deleting the folder removes everything.
- The portable build does not update itself. Download a new version and replace it manually.
- Do not put it in a folder that needs administrator rights, such as Program Files.

### Run from source

Requires Node.js 20+, pnpm, a Rust toolchain and the Tauri system dependencies.

```powershell
pnpm install --frozen-lockfile
cargo tauri dev
```

Useful checks:

```powershell
pnpm test
pnpm lint
pnpm rust:check
```

## Known Limitations

- Kernels are verified on Windows x64 only.
- RPA cannot act on elements inside cross-origin iframes.
- Handling of lost proxies and failed detection is incomplete.
- Environments created by older versions keep their old hardware settings; only new environments use the new device profile.

## Data and Privacy

Business data stays on your device by default. Features that need the network, such as kernel downloads, proxies and websites, contact the relevant third-party services.

## Acceptable Use

This software is intended for lawful purposes such as privacy protection, multi-account management, testing and automation. Follow local law and the terms of the sites you visit. No fingerprint approach is guaranteed to be undetectable.

## Origin and Credits

MZ指纹浏览器 is a derivative of [Simprint](https://github.com/Simprint/simprint) by the Simprint team and is maintained independently. The kernel patches likewise come from [simprint-browser-kernel](https://github.com/Simprint/simprint-browser-kernel). Thanks to the original project for open-sourcing it.

Main changes: Chromium 155–157 kernels with hardened fingerprints, a Firefox kernel, WebRTC over SOCKS5, default browser support, removal of users/teams/workspaces/login/quotas, a rebuilt RPA module, an HTTP API with tiered permissions, page actions and RPA tools, and a new name and icon.

The original project's name and trademarks are not part of this project.

## License

Licensed under the [GNU Affero General Public License v3.0](./LICENSE) (AGPLv3), inherited from the original project, with its copyright and license notices kept.

**You may** use, modify and redistribute it, personally or commercially.

**You must**:

- Provide the complete corresponding source (including your changes and build scripts) under AGPLv3 to anyone you give the software to.
- Keep copyright and license notices and mark your changes.
- Offer the source to users of a modified version you run as a network service.
- Add no restrictions beyond the license.

Closed-source distribution or services require separate permission from all copyright holders.

**Third-party components** have their own licenses: Chromium (BSD-style and its third-party components), Firefox and Camoufox (MPL-2.0), and other dependencies mainly under MIT, Apache-2.0, BSD and MPL-2.0. Chrome and Firefox are trademarks of their respective owners. The kernels enable proprietary codecs such as H.264 and AAC, which may require patent licenses.

## Friend Links

- [LINUX DO](https://linux.do)

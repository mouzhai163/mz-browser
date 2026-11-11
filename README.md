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

MZ指纹浏览器 is a desktop app that runs on your own computer. It creates, runs and manages many isolated browser environments. Each environment has its own data directory, proxy, fingerprint and accounts, and can be automated with RPA workflows or AI clients over MCP.

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
- Configure start URLs, cookies, bound accounts and a proxy per environment.
- Make an environment the system default browser, so links clicked in other apps open directly in it.

### Browser kernels

| Kernel | Versions | Platform |
| --- | --- | --- |
| Chromium (customized) | 155, 156, 157 | Windows x64 |
| Firefox (based on Camoufox) | 158 | Windows x64 |

Kernels are downloaded on demand from the Releases of [browser-kernel](https://github.com/mouzhai163/browser-kernel) and verified. New versions are announced under Settings → Browser & Automation → Browser Kernels and installed manually.

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

### AI access (MCP)

A built-in local Model Context Protocol server (off by default, bound to `127.0.0.1`, requires an access key) lets external AI clients use your environments. Permissions are tiered and opt-in:

| Tier | Allows |
| --- | --- |
| Base | List authorized environments and read their status |
| Page reading | Read tabs and page outlines of authorized environments; field values and passwords are hidden |
| Page actions | Navigate, click, type and press keys in authorized environments |
| Full page access | Read and fill input and password fields; allows RPA script and upload steps |
| Management | Manage environments, groups, proxies, tags, kernels and RPA tasks |

Running an RPA task requires page actions and every bound environment to be authorized. Scripts that run on the local computer cannot be used over MCP.

## Quick Start

### Install

Run `MZ指纹浏览器_x.y.z_x64-setup.exe`, open the app and click Create Environment. The required kernel is downloaded the first time an environment starts.

Requires Windows 10 or 11 x64.

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

Main changes: Chromium 155–157 kernels with hardened fingerprints, a Firefox kernel, WebRTC over SOCKS5, default browser support, removal of users/teams/workspaces/login/quotas, a rebuilt RPA module, tiered MCP permissions and RPA tools, and a new name and icon.

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

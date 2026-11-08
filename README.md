<div align="center">
  <img src="./public/assets/logo.png" alt="MZ指纹浏览器 Logo" width="120" />
  <h1>MZ指纹浏览器</h1>
  <p>A local-first fingerprint browser workbench: every environment is a fresh, strictly isolated browser environment.</p>
  <p>
    <img alt="License AGPLv3" src="https://img.shields.io/badge/license-AGPLv3-67e8f9?style=flat-square&labelColor=0f172a" />
    <img alt="Desktop Tauri 2" src="https://img.shields.io/badge/desktop-Tauri%202-f59e0b?style=flat-square&labelColor=0f172a" />
    <img alt="UI React 19" src="https://img.shields.io/badge/ui-React%2019-60a5fa?style=flat-square&labelColor=0f172a" />
    <img alt="Runtime Rust 2024" src="https://img.shields.io/badge/runtime-Rust%202024-f97316?style=flat-square&labelColor=0f172a" />
    <img alt="Chromium 156" src="https://img.shields.io/badge/chromium-156-34d399?style=flat-square&labelColor=0f172a" />
  </p>
  <p>
    <strong>English</strong> | <a href="./README.zh-CN.md">简体中文</a>
  </p>
</div>

---

## Introduction

MZ指纹浏览器 is a desktop workbench that runs on your own machine. It creates, runs and manages many isolated browser
environments and gives each one its own proxy, fingerprint and automation workflows.

The goal is **fingerprint quality**. Every new environment gets its own user-data directory, its own fingerprint seed
and a self-consistent device profile. Canvas, WebGL and audio fingerprints differ between environments, environments
cannot be linked through time zone, language, screen or hardware, and an environment keeps the same fingerprint across restarts.

Core data stays on your machine by default; neither daily use nor development depends on any cloud service.

## Features

### Environments and isolation

- **Strictly isolated environments**: a separate user-data directory per environment; localStorage, cookies and IndexedDB are never shared.
- **Per-environment fingerprint seed**: derived from the environment ID, so Canvas / WebGL / audio noise differs between environments and stays stable across restarts.
- **Persistent configuration**: environment settings and account context are kept long term, with groups, tags and batch operations.
- **Launch guarantee**: an environment only counts as started after the browser confirms the fingerprint config was applied. If the confirmation fails or times out, the launch fails instead of opening pages with a default fingerprint.
- **Default browser**: mark one environment as the default browser in its menu and links clicked in other apps open in it directly, without asking; unset it any time. Windows only lets the user pick the default browser, so after setting it you choose MZ指纹浏览器 once under Default apps. If MZ指纹浏览器 is already running the link is handed to it, otherwise it starts quietly without showing the main window.
- **Single-user and local**: MZ指纹浏览器 is a personal workbench. There are no users, teams, workspaces, login, lock screen or quotas; it just opens.

### Fingerprint

| Area | Approach |
| --- | --- |
| UA and client hints | `User-Agent`, the `Sec-CH-UA` headers and `navigator.userAgentData` come from one source, so brands, platform and version agree |
| Language and region | Language, `Accept-Language`, `Intl`, time zone and geolocation follow the environment in pages and workers; can be set to follow the proxy exit IP |
| Screen | `screen`, `devicePixelRatio` and CSS media queries (`device-width`, `resolution`, pointer type) use the same configuration |
| Hardware | `hardwareConcurrency`, `deviceMemory` (capped at 8 like real Chrome), WebGL vendor/renderer and WebGPU adapter info match as a set |
| Canvas / WebGL / audio | Stable per-environment-seed noise that does not break page rendering |
| Fonts | Only allow-listed system fonts are exposed to pages; web fonts are unaffected |
| WebRTC | Disabled by default; no host/srflx candidates are gathered, so SDP, events and `getStats()` never reveal the real IP |
| Other | Speech voices, media devices, touch points, Do Not Track and the browser UI language all follow the environment |

New environments get GPU, core count, memory, resolution and scaling from one tiered device profile, so combinations such as
"4 cores with a flagship GPU" cannot occur.

### Proxy and network

- **Proxy management**: attach, assign and manage proxy resources per environment.
- **Exit-IP matching**: language, time zone and geolocation can be set to follow the proxy exit IP.

### Automation and extensibility

- **RPA workflows**: build and run repeatable browser automation flows.
- **Syncer**: pick a controller window and mirror interactions to other running windows.
- **Local API**: control environments, proxies, tags, groups and browser kernels through a local API protected by an API key. Enabled by default.
- **MCP**: an optional local Model Context Protocol server (off by default) that lets external AI clients use your environments.

### Browser kernel

- A customized Chromium kernel (currently **156**; 158 and 159 are planned). It can only be launched by MZ指纹浏览器.
- The app ships a kernel catalog with name, version, verification data and download URL. Kernels are downloaded from the Releases of [browser-kernel](https://github.com/mouzhai163/browser-kernel), and both the archive and the core DLL are verified. Locally built kernels can still be registered through `config/browser-kernels.json`.
- Kernel patches live in the [browser-kernel](https://github.com/mouzhai163/browser-kernel) repository, not in this one.

## Quick Start

### Prerequisites

- Node.js 20 or newer
- `pnpm` 9
- A Rust toolchain
- The Tauri system dependencies for your platform
- A usable browser kernel (Windows x86_64)

### Run locally

```powershell
pnpm install --frozen-lockfile
cargo tauri dev
```

No extra service has to be configured or started for the desktop app.

## Documentation

- [Contributing](./CONTRIBUTING.md)

## Status

Personal use, local-first. Leftover billing and upgrade UI from the earlier commercial product is being removed gradually; the environment limit has been lifted.

Known gaps:

- The kernel is verified on Windows x86_64 only, and only 156 is finished; 158 and 159 still need porting.
- Falling back to a direct connection when the proxy is lost or detection fails is not handled yet.
- Datacenter IPs are flagged by IP-reputation checks; residential proxies are recommended.
- Environments created by older versions keep their old hardware settings; only new environments use the new device profile.

## Data Use

Core data stays on your device by default. Features that need the network, such as kernel downloads, proxies and external websites, still contact the relevant third-party services.

## Origin and credits

MZ指纹浏览器 is a derivative of [Simprint](https://github.com/Simprint/simprint) by the Simprint team and is maintained independently on top of its source; the kernel patches likewise come from the original [simprint-browser-kernel](https://github.com/Simprint/simprint-browser-kernel). Thanks to the original project for open-sourcing it.

Main changes on top of the original: Chromium 156 kernel with hardened fingerprints and environment isolation, a "default browser" feature, removal of users/teams/workspaces/login/environment quotas (now a single-user local workbench), kernel download from GitHub Releases, and a new name and icon.

The original project's name and trademarks are not part of this project; it keeps the original AGPL-3.0 license and the existing copyright and license notices.

## License

Licensed under the GNU Affero General Public License v3.0 (AGPLv3). See [LICENSE](./LICENSE).

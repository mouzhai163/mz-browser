# Contributing to Simprint

Thanks for considering a contribution to Simprint.

This repository is in an active open-source transition. We welcome bug reports, documentation improvements, CI and packaging fixes, frontend refinements, test coverage, and well-scoped product improvements.

## Before You Start

- Search existing issues and discussions before opening a new one.
- For larger changes, open an issue or discussion first so the direction can be aligned before implementation.
- Keep pull requests focused. Small, reviewable changes move faster than broad refactors.

## Development Setup

Windows 从零配置、桌面端启动和本地数据目录说明请先阅读 [开发配置文档](./docs/development-setup.zh-CN.md)。

### Prerequisites

- Node.js 20+
- `pnpm` 9
- Rust toolchain
- Tauri system prerequisites for your platform

### Local Run

From the repository root:

```bash
pnpm install
cargo tauri dev
```

If you only need frontend iteration, you can also use:

```bash
pnpm dev
```

### Local Runtime and Data

The desktop application is local-first. Its business routes use the embedded SQLite layer in `src-tauri/crates/business`, and its environment runtime is embedded from `src-tauri/crates/runtime`. Starting the desktop application automatically initializes the local user, workspace, database, and runtime.

Do not configure a remote `base_url`, PostgreSQL, or Redis for normal desktop development. Features that use Tauri commands, workspace resources, browser kernels, the Local API, or MCP should be tested through the desktop application.

## Useful Commands

Run these from the repository root unless noted otherwise:

```bash
pnpm lint
pnpm format:check
pnpm rust:fmt:check
pnpm rust:check
```

If you changed build, packaging, or release-related code, also run:

```bash
node build.cjs
```

## Pull Request Expectations

- Describe what changed and why.
- Mention any user-facing behavior changes.
- Include validation steps you ran locally.
- Attach screenshots or recordings for UI changes when helpful.
- Avoid mixing unrelated refactors into the same PR.

If your change touches build, release, or workflow files, call that out explicitly in the PR description.

## Issues and Bug Reports

Good bug reports usually include:

- Operating system and environment details
- What you expected to happen
- What actually happened
- Clear reproduction steps
- Screenshots, logs, or error messages when available

## Scope and Collaboration

Current high-value contribution areas include:

- Reproducible bug reports and targeted bug fixes
- Build, packaging, and CI improvements
- Documentation and onboarding improvements
- Frontend UX polish and workflow consistency
- Tests, regression coverage, and release verification

The environment runtime is maintained in this repository under `src-tauri/crates/runtime`; the browser-kernel layer (`simprint-browser-kernel`) remains a separate component. Changes to environment lifecycle behavior should include tests in the embedded runtime crate whenever possible.

## Communication

- English and Chinese are both acceptable in issues and pull requests.
- If you want to contribute on a longer horizon, open an issue or discussion and briefly introduce the areas you want to help maintain.

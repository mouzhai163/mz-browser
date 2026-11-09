import fs from 'node:fs';
import path from 'node:path';

/**
 * Prepare versions for release builds.
 *
 * Sources of version:
 * - GITHUB_REF_NAME (tag name on GitHub Actions, e.g. v0.1.0)
 * - RELEASE_TAG (explicit, e.g. v0.1.0)
 * - VERSION (explicit, e.g. 0.1.0)
 *
 * Outputs:
 * - update src-tauri/tauri.conf.json -> version
 * - update src-tauri/Cargo.toml -> [package].version
 * - update package.json -> version (optional but keeps repo consistent)
 */

function normalizeTagToVersion(input) {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const v = raw.startsWith('v') ? raw.slice(1) : raw;
  // Basic semver-ish validation: 1.2.3 or 1.2.3-rc.1(+build ignored)
  if (!/^\d+\.\d+\.\d+([\-+].+)?$/.test(v)) {
    // 在非版本分支（如 main）上运行时，允许跳过版本更新，而不是直接报错中断 CI
    console.log(
      `[prepare-version] Ignore non-version input "${raw}". Expected like v1.2.3 or 1.2.3`
    );
    return null;
  }
  return v;
}

function repoRoot() {
  return path.resolve(process.cwd());
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function updateCargoTomlVersion(cargoTomlPath, version) {
  const content = fs.readFileSync(cargoTomlPath, 'utf8');
  // Replace only the first [package] version = "..."
  const re = /(\[package\][\s\S]*?\nversion\s*=\s*")([^"]+)(")/m;
  const m = content.match(re);
  if (!m) {
    throw new Error(`Failed to locate [package].version in ${cargoTomlPath}`);
  }
  const current = m[2];
  if (current === version) {
    return false;
  }
  const updated = content.replace(re, `$1${version}$3`);
  fs.writeFileSync(cargoTomlPath, updated, 'utf8');
  return true;
}

const version =
  normalizeTagToVersion(process.env.VERSION) ??
  normalizeTagToVersion(process.env.RELEASE_TAG) ??
  normalizeTagToVersion(process.env.GITHUB_REF_NAME);

if (!version) {
  console.log('[prepare-version] No tag/version detected. Skipping version update.');
  process.exit(0);
}

const root = repoRoot();
// 打包时 prepare-tauri-config 会用后两个文件覆盖 tauri.conf.json，版本号必须三个一起改
const tauriConfPaths = [
  'tauri.conf.json',
  'tauri.conf.embed-bootstrapper.json',
  'tauri.conf.fixed-runtime.json',
].map((name) => path.join(root, 'src-tauri', name));
const cargoTomlPath = path.join(root, 'src-tauri', 'Cargo.toml');
const packageJsonPath = path.join(root, 'package.json');

console.log(`[prepare-version] Using version: ${version}`);

// tauri.conf*.json
for (const tauriConfPath of tauriConfPaths) {
  const tauriConf = readJson(tauriConfPath);
  if (tauriConf.version !== version) {
    tauriConf.version = version;
    writeJson(tauriConfPath, tauriConf);
    console.log(`[prepare-version] Updated ${path.relative(root, tauriConfPath)} -> version=${version}`);
  } else {
    console.log(`[prepare-version] Kept ${path.relative(root, tauriConfPath)} -> version=${version}`);
  }
}

// Cargo.toml
const cargoChanged = updateCargoTomlVersion(cargoTomlPath, version);
console.log(
  `[prepare-version] ${cargoChanged ? 'Updated' : 'Kept'} ${path.relative(root, cargoTomlPath)} -> package.version=${version}`
);

// package.json
const pkg = readJson(packageJsonPath);
if (pkg.version !== version) {
  pkg.version = version;
  writeJson(packageJsonPath, pkg);
  console.log(`[prepare-version] Updated ${path.relative(root, packageJsonPath)} -> version=${version}`);
} else {
  console.log(`[prepare-version] Kept ${path.relative(root, packageJsonPath)} -> version=${version}`);
}


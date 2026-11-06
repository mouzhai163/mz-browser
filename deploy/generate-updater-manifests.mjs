import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const [releaseMetadataPath, releaseAssetsPath, signaturesDir, outputDir, repository, configPath] =
  process.argv.slice(2);

if (!releaseMetadataPath || !releaseAssetsPath || !signaturesDir || !outputDir || !repository) {
  throw new Error(
    'Usage: node deploy/generate-updater-manifests.mjs <release-json> <assets-json> <signatures-dir> <output-dir> <owner/repository> [config-json]'
  );
}

if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
  throw new Error(`Invalid GitHub repository name: "${repository}"`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

const release = readJson(releaseMetadataPath);
const releaseAssetPages = readJson(releaseAssetsPath);
const config = readJson(configPath ?? path.join(scriptDir, 'updater-manifests.json'));
const tag = release.tag_name;

if (!/^v\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(tag ?? '')) {
  throw new Error(`${releaseMetadataPath} contains an invalid release tag`);
}

const version = tag.slice(1);
const notes = release.body?.trim();
const publicationDate = release.published_at ?? release.created_at;

if (!notes) {
  throw new Error(`${releaseMetadataPath} does not contain release notes`);
}

if (!publicationDate || Number.isNaN(Date.parse(publicationDate))) {
  throw new Error(`${releaseMetadataPath} does not contain a valid release date`);
}

if (!Array.isArray(releaseAssetPages) || releaseAssetPages.some((page) => !Array.isArray(page))) {
  throw new Error(`${releaseAssetsPath} does not contain paginated release assets`);
}

if (!config.channels || !Array.isArray(config.targets)) {
  throw new Error('Updater manifest configuration must contain channels and targets');
}

const releaseAssets = new Map(releaseAssetPages.flat().map((asset) => [asset.name, asset]));
const manifests = new Map();

for (const [channel, channelConfig] of Object.entries(config.channels)) {
  if (!channelConfig.file || path.basename(channelConfig.file) !== channelConfig.file) {
    throw new Error(`Updater channel "${channel}" has an invalid output file`);
  }

  manifests.set(channel, {
    file: channelConfig.file,
    data: {
      version,
      notes,
      pub_date: new Date(publicationDate).toISOString(),
      platforms: {},
    },
  });
}

for (const target of config.targets) {
  const manifest = manifests.get(target.channel);
  if (!manifest) {
    throw new Error(`Updater target references unknown channel "${target.channel}"`);
  }
  if (!Array.isArray(target.keys) || target.keys.length === 0 || !target.asset) {
    throw new Error(`Updater target in channel "${target.channel}" is incomplete`);
  }

  const assetName = target.asset.replaceAll('{version}', version);
  const signatureName = `${assetName}.sig`;
  if (!releaseAssets.has(assetName)) {
    throw new Error(`Release is missing installer asset "${assetName}"`);
  }
  if (!releaseAssets.has(signatureName)) {
    throw new Error(`Release is missing updater signature asset "${signatureName}"`);
  }

  const signaturePath = path.join(signaturesDir, signatureName);
  if (!fs.existsSync(signaturePath)) {
    throw new Error(`Downloaded updater signature is missing: ${signaturePath}`);
  }

  const signature = fs.readFileSync(signaturePath, 'utf8').trim();
  if (!signature) {
    throw new Error(`Downloaded updater signature is empty: ${signaturePath}`);
  }

  const entry = {
    signature,
    url: `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/${encodeURIComponent(assetName)}`,
  };

  for (const platformKey of target.keys) {
    if (!platformKey || manifest.data.platforms[platformKey]) {
      throw new Error(
        `Updater channel "${target.channel}" contains an invalid or duplicate platform key "${platformKey}"`
      );
    }
    manifest.data.platforms[platformKey] = entry;
  }
}

fs.mkdirSync(outputDir, { recursive: true });

for (const [channel, manifest] of manifests) {
  if (Object.keys(manifest.data.platforms).length === 0) {
    throw new Error(`Updater channel "${channel}" does not contain any platforms`);
  }

  const outputPath = path.join(outputDir, manifest.file);
  fs.writeFileSync(outputPath, `${JSON.stringify(manifest.data, null, 2)}\n`, 'utf8');
  console.log(
    `[generate-updater-manifests] Wrote ${outputPath} with ${Object.keys(manifest.data.platforms).length} platform entries`
  );
}

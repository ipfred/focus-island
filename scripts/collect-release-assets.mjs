import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const releaseTag = process.env.RELEASE_TAG
const repo = process.env.GITHUB_REPOSITORY
const platformName = process.env.PLATFORM_NAME
const targetDir = path.resolve(process.env.TARGET_DIR ?? 'src-tauri/target')
const metadataOut = path.resolve(process.env.METADATA_OUT ?? `release-metadata/${platformName}.json`)

if (!releaseTag) throw new Error('RELEASE_TAG is required')
if (!repo) throw new Error('GITHUB_REPOSITORY is required')
if (!platformName) throw new Error('PLATFORM_NAME is required')

const assetMatchers = [
  /\.app\.tar\.gz$/i,
  /\.dmg$/i,
  /\.AppImage$/i,
  /\.deb$/i,
  /\.rpm$/i,
  /-setup\.exe$/i,
]

function updaterKeyForAsset(filename, basePlatform) {
  if (/\.app\.tar\.gz$/i.test(filename)) return basePlatform
  if (/-setup\.exe$/i.test(filename)) return basePlatform
  if (/\.AppImage$/i.test(filename)) return `${basePlatform}-appimage`
  if (/\.deb$/i.test(filename)) return `${basePlatform}-deb`
  if (/\.rpm$/i.test(filename)) return `${basePlatform}-rpm`
  return null
}

async function walk(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walk(full, out)
      continue
    }
    if (assetMatchers.some((re) => re.test(entry.name))) {
      out.push(full)
    }
  }
  return out
}

function runGhUpload(filePath) {
  const result = spawnSync('gh', ['release', 'upload', releaseTag, filePath, '--clobber'], {
    stdio: 'inherit',
    env: process.env,
  })
  if (result.status !== 0) {
    throw new Error(`failed to upload ${filePath} to release ${releaseTag}`)
  }
}

async function readSignature(filePath) {
  const sigPath = `${filePath}.sig`
  try {
    const raw = await fs.readFile(sigPath, 'utf8')
    const signature = raw.trim()
    if (!signature) {
      throw new Error(`signature file is empty: ${sigPath}`)
    }
    return signature
  } catch (error) {
    throw new Error(`missing updater signature for ${filePath}: ${String(error)}`)
  }
}

const files = (await walk(targetDir)).sort()
if (files.length === 0) {
  throw new Error(`no release assets found under ${targetDir}`)
}

const entries = []
const uploadedAssets = []

for (const file of files) {
  const basename = path.basename(file)
  runGhUpload(file)
  uploadedAssets.push(basename)

  const updaterKey = updaterKeyForAsset(basename, platformName)
  if (!updaterKey) continue

  const signature = await readSignature(file)
  entries.push({
    key: updaterKey,
    url: `https://github.com/${repo}/releases/download/${releaseTag}/${basename}`,
    signature,
  })
}

await fs.mkdir(path.dirname(metadataOut), { recursive: true })
await fs.writeFile(
  metadataOut,
  `${JSON.stringify(
    {
      platform: platformName,
      uploadedAssets,
      entries,
    },
    null,
    2,
  )}\n`,
)

console.log(`uploaded ${uploadedAssets.length} assets for ${platformName}`)
console.log(`collected ${entries.length} updater entries -> ${metadataOut}`)

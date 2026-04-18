import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'

const releaseTag = process.env.RELEASE_TAG
const repo = process.env.GITHUB_REPOSITORY
const platformName = process.env.PLATFORM_NAME
const targetDir = path.resolve(process.env.TARGET_DIR ?? 'src-tauri/target')
const metadataOut = path.resolve(process.env.METADATA_OUT ?? `release-metadata/${platformName}.json`)
const productNameCn = process.env.PRODUCT_NAME_CN ?? '专注岛'
const productNameEn = process.env.PRODUCT_NAME_EN ?? 'FocusIsland'

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
    const dir = path.dirname(filePath)
    const basename = path.basename(filePath)
    const normalized = basename.normalize('NFC')
    const entries = await fs.readdir(dir)
    const sigFiles = entries.filter((name) => name.endsWith('.sig'))
    const normalizedCandidates = sigFiles.filter((name) => {
      const n = name.normalize('NFC')
      return (
        n === `${normalized}.sig` ||
        n.startsWith(`${normalized}.`) ||
        n.includes(normalized.replace(/\.tar\.gz$/i, '')) ||
        (basename.endsWith('.app.tar.gz') && n.endsWith('.app.tar.gz.sig')) ||
        (basename.endsWith('.AppImage') && n.endsWith('.AppImage.sig')) ||
        (basename.endsWith('.deb') && n.endsWith('.deb.sig')) ||
        (basename.endsWith('.rpm') && n.endsWith('.rpm.sig')) ||
        (basename.endsWith('-setup.exe') && n.endsWith('-setup.exe.sig'))
      )
    })

    if (normalizedCandidates.length === 1) {
      const fallbackSigPath = path.join(dir, normalizedCandidates[0])
      const raw = await fs.readFile(fallbackSigPath, 'utf8')
      const signature = raw.trim()
      if (signature) {
        return signature
      }
    }

    throw new Error(
      `missing updater signature for ${filePath}. expected ${sigPath}. found sig files: ${sigFiles.join(', ') || '(none)'}; root error: ${String(error)}`,
    )
  }
}

/**
 * 重命名文件：将中文产品名替换为英文产品名
 * 同时处理对应的 .sig 文件
 */
async function renameAssetToEnglish(filePath) {
  const dir = path.dirname(filePath)
  const basename = path.basename(filePath)

  // 如果文件名已经不包含中文产品名，直接返回
  if (!basename.includes(productNameCn)) {
    return filePath
  }

  // 替换中文为英文
  const newBasename = basename.replace(productNameCn, productNameEn)
  const newPath = path.join(dir, newBasename)

  // 重命名主文件
  await fs.rename(filePath, newPath)
  console.log(`Renamed: ${basename} -> ${newBasename}`)

  // 重命名对应的 .sig 文件
  const sigPath = `${filePath}.sig`
  try {
    await fs.access(sigPath)
    const newSigPath = `${newPath}.sig`
    await fs.rename(sigPath, newSigPath)
    console.log(`Renamed: ${basename}.sig -> ${newBasename}.sig`)
  } catch {
    // .sig 文件可能不存在，忽略
  }

  return newPath
}

const files = (await walk(targetDir)).sort()
if (files.length === 0) {
  throw new Error(`no release assets found under ${targetDir}`)
}

const entries = []
const uploadedAssets = []

for (const file of files) {
  // 重命名文件（中文 -> 英文）
  const renamedFile = await renameAssetToEnglish(file)
  const basename = path.basename(renamedFile)

  // 上传重命名后的文件
  runGhUpload(renamedFile)
  uploadedAssets.push(basename)

  const updaterKey = updaterKeyForAsset(basename, platformName)
  if (!updaterKey) continue

  const signature = await readSignature(renamedFile)
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

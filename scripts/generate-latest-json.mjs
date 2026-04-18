import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const releaseTag = process.env.RELEASE_TAG
const repo = process.env.GITHUB_REPOSITORY
const metadataDir = path.resolve(process.env.METADATA_DIR ?? 'release-metadata')
const outputPath = path.resolve(process.env.LATEST_JSON_OUT ?? 'latest.json')

if (!releaseTag) throw new Error('RELEASE_TAG is required')
if (!repo) throw new Error('GITHUB_REPOSITORY is required')

const version = releaseTag.replace(/^v/, '')

async function walkJsonFiles(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      await walkJsonFiles(full, out)
      continue
    }
    if (entry.name.endsWith('.json')) {
      out.push(full)
    }
  }
  return out
}

const files = (await walkJsonFiles(metadataDir)).sort()
if (files.length === 0) {
  throw new Error(`no metadata json files found under ${metadataDir}`)
}

const platformMap = new Map()
for (const file of files) {
  const raw = await fs.readFile(file, 'utf8')
  const parsed = JSON.parse(raw)
  const entries = Array.isArray(parsed.entries) ? parsed.entries : []
  for (const entry of entries) {
    if (!entry?.key || !entry?.url || !entry?.signature) {
      throw new Error(`invalid updater metadata entry in ${file}`)
    }
    if (!platformMap.has(entry.key)) {
      platformMap.set(entry.key, {
        url: entry.url,
        signature: entry.signature,
      })
    }
  }
}

for (const linuxBase of ['linux-x86_64', 'linux-aarch64']) {
  if (platformMap.has(linuxBase)) continue
  for (const suffix of ['appimage', 'deb', 'rpm']) {
    const fromKey = `${linuxBase}-${suffix}`
    if (platformMap.has(fromKey)) {
      platformMap.set(linuxBase, platformMap.get(fromKey))
      break
    }
  }
}

if (platformMap.size === 0) {
  throw new Error('no updater platforms were collected')
}

const orderedPlatforms = Object.fromEntries(
  [...platformMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => [key, value]),
)

const latest = {
  version,
  notes: `See https://github.com/${repo}/releases/tag/${releaseTag} for release notes.`,
  pub_date: new Date().toISOString(),
  platforms: orderedPlatforms,
}

await fs.writeFile(outputPath, `${JSON.stringify(latest, null, 2)}\n`)
console.log(`generated ${outputPath}`)
console.log(JSON.stringify(latest, null, 2))

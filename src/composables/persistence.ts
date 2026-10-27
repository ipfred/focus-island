import { ref, watch, type Ref } from 'vue'
import {
  BaseDirectory,
  copyFile,
  exists,
  mkdir,
  readTextFile,
  rename,
  writeTextFile,
} from '@tauri-apps/plugin-fs'
import { emitTo, listen } from '@tauri-apps/api/event'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

const DATA_DIR = 'focus-island'
const baseDir = BaseDirectory.AppData
const WRITE_DEBOUNCE_MS = 300

let dataDirReady: Promise<void> | null = null

function ensureDataDir(): Promise<void> {
  if (!dataDirReady) {
    dataDirReady = mkdir(DATA_DIR, { baseDir, recursive: true }).catch((e) => {
      dataDirReady = null
      throw e
    })
  }
  return dataDirReady
}

type ReadResult =
  | { status: 'ok'; data: unknown }
  | { status: 'missing' }
  | { status: 'unreadable' }

interface JsonFile {
  read(): Promise<ReadResult>
  /** Back up an unreadable file before it can be overwritten. */
  quarantine(): Promise<void>
  /** Debounced; writes for the same file are applied strictly in order. */
  write(json: string): void
}

function createJsonFile(name: string): JsonFile {
  const path = `${DATA_DIR}/${name}`
  let pending: string | null = null
  let timer: ReturnType<typeof setTimeout> | null = null
  let queue: Promise<void> = Promise.resolve()
  // Set when an unreadable file could not be backed up: overwriting it would destroy the only copy.
  let writeBlocked = false

  async function read(): Promise<ReadResult> {
    try {
      if (!(await exists(path, { baseDir }))) return { status: 'missing' }
      const raw = await readTextFile(path, { baseDir })
      return { status: 'ok', data: JSON.parse(raw) }
    } catch (e) {
      console.error(`[persistence] failed to read ${name}`, e)
      return { status: 'unreadable' }
    }
  }

  async function quarantine() {
    try {
      await copyFile(path, `${path}.corrupt-${Date.now()}`, {
        fromPathBaseDir: baseDir,
        toPathBaseDir: baseDir,
      })
    } catch (e) {
      writeBlocked = true
      console.error(`[persistence] failed to back up ${name}; saving disabled to protect it`, e)
    }
  }

  function flush() {
    timer = null
    if (pending === null) return
    const json = pending
    pending = null
    queue = queue
      .then(async () => {
        if (writeBlocked) return
        await ensureDataDir()
        // Both windows may save the same file; separate temp files keep their renames from colliding.
        const tmpPath = `${path}.${getCurrentWebviewWindow().label}.tmp`
        // Write-then-rename keeps the previous file intact if the app dies mid-write.
        await writeTextFile(tmpPath, json, { baseDir })
        await rename(tmpPath, path, { oldPathBaseDir: baseDir, newPathBaseDir: baseDir })
      })
      .catch((e) => console.error(`[persistence] failed to save ${name}`, e))
  }

  function write(json: string) {
    pending = json
    if (timer !== null) clearTimeout(timer)
    timer = setTimeout(flush, WRITE_DEBOUNCE_MS)
  }

  return { read, quarantine, write }
}

function emitToOtherWindow(event: string, payload: string) {
  const self = getCurrentWebviewWindow().label
  const target = self === 'main' ? 'panel' : 'main'
  emitTo(target, event, payload).catch(() => {})
}

export interface PersistedStoreOptions {
  /** File name inside the app data directory. */
  file: string
  /** Reactive getter for the data to persist. */
  snapshot: () => unknown
  /** Apply parsed file (or cross-window) data to the reactive state. Throw if the data is invalid. */
  restore: (data: unknown) => void
  /** Event used to mirror changes into the other window. */
  syncEvent?: string
}

export interface PersistedStore {
  loaded: Ref<boolean>
  ensureLoaded(): Promise<void>
}

export function createPersistedStore(opts: PersistedStoreOptions): PersistedStore {
  const file = createJsonFile(opts.file)
  const loaded = ref(false)
  let loadPromise: Promise<void> | null = null
  // JSON of the state as last loaded, received or saved; unchanged state is never written back.
  let lastJson: string | null = null

  async function load() {
    const result = await file.read()
    // Data from the other window arrived first and is newer than the (possibly debounced) file.
    if (loaded.value) return

    let restored = false
    if (result.status === 'ok') {
      try {
        opts.restore(result.data)
        restored = true
      } catch (e) {
        console.error(`[persistence] invalid data in ${opts.file}`, e)
        await file.quarantine()
      }
    } else if (result.status === 'unreadable') {
      await file.quarantine()
    }

    lastJson = JSON.stringify(opts.snapshot())
    loaded.value = true
    // Persist migrations/normalization applied by restore().
    if (restored && result.status === 'ok' && lastJson !== JSON.stringify(result.data)) {
      file.write(lastJson)
    }
  }

  function ensureLoaded(): Promise<void> {
    if (!loadPromise) loadPromise = load()
    return loadPromise
  }

  watch(
    opts.snapshot,
    () => {
      if (!loaded.value) return
      const json = JSON.stringify(opts.snapshot())
      if (json === lastJson) return
      lastJson = json
      file.write(json)
      if (opts.syncEvent) emitToOtherWindow(opts.syncEvent, json)
    },
    { deep: true },
  )

  if (opts.syncEvent) {
    const event = opts.syncEvent
    listen<string>(event, ({ payload }) => {
      try {
        opts.restore(JSON.parse(payload))
        lastJson = JSON.stringify(opts.snapshot())
        loaded.value = true
      } catch (e) {
        console.error(`[persistence] invalid ${event} payload`, e)
      }
    }).catch(() => {})
  }

  return { loaded, ensureLoaded }
}

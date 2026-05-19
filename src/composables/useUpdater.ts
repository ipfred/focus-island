import { computed, ref, shallowRef, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-shell'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

type AvailableUpdate = Awaited<ReturnType<typeof check>>

interface MacosUpdateHealth {
  app_path: string
  quarantined: boolean
  repair_command: string
}

const AUTO_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000
const LAST_AUTO_CHECK_KEY = 'focus-island:last-update-check'
const GITHUB_RELEASES_URL = 'https://github.com/ipfred/focus-island/releases/latest'
const UPDATE_CHECK_TIMEOUT_MS = 12000
const UPDATE_DOWNLOAD_TIMEOUT_MS = 120000

const checking = ref(false)
const checked = ref(false)
const updateAvailable = ref(false)
const downloading = ref(false)
const installing = ref(false)
const downloadProgress = ref(0)
const error = ref<string | null>(null)
const updateInfo = ref<{ version: string; body?: string } | null>(null)
const availableUpdate = shallowRef<AvailableUpdate | null>(null)
const installFinished = ref(false)
const installFailed = ref(false)
const downloadFailed = ref(false)
const updateNoticeDismissed = ref(false)

const isMacOS = navigator.userAgent.toLowerCase().includes('mac')
const isWindows = navigator.userAgent.toLowerCase().includes('win')
const macQuarantined = ref(false)
const macRepairCommand = ref('')
const macRepairStatus = ref('')
const copiedRepairCommand = ref(false)
const resolvedUpdateProxy = ref<string | null>(null)

const hasVisibleUpdateWork = computed(() =>
  updateAvailable.value || downloading.value || installing.value || (installFinished.value && isMacOS),
)

watch(updateAvailable, value => {
  if (value) updateNoticeDismissed.value = false
})

function markAutoCheckAttempt() {
  try {
    localStorage.setItem(LAST_AUTO_CHECK_KEY, String(Date.now()))
  } catch {
    // localStorage can be unavailable in restricted environments.
  }
}

function canRunAutoCheck() {
  try {
    const last = Number(localStorage.getItem(LAST_AUTO_CHECK_KEY) ?? 0)
    return !Number.isFinite(last) || Date.now() - last > AUTO_CHECK_INTERVAL_MS
  } catch {
    return true
  }
}

function resetCheckState() {
  error.value = null
  updateAvailable.value = false
  updateInfo.value = null
  availableUpdate.value = null
  installing.value = false
  installFinished.value = false
  installFailed.value = false
  downloadFailed.value = false
}

async function resolveUpdateProxy() {
  if (resolvedUpdateProxy.value !== null) return resolvedUpdateProxy.value
  try {
    const proxy = await invoke<string | null>('get_update_proxy')
    resolvedUpdateProxy.value = proxy && proxy.trim().length > 0 ? proxy.trim() : ''
    return resolvedUpdateProxy.value || null
  } catch {
    resolvedUpdateProxy.value = ''
    return null
  }
}

/**
 * Extract the most useful error message from Tauri updater errors.
 * Tauri's updater plugin can produce nested error structures.
 */
function formatUpdateError(e: unknown): string {
  if (!(e instanceof Error)) return '更新失败，请稍后重试'

  const message = e.message || String(e)

  // Signature verification failure
  if (/signature|签名|公钥|pub.?key|verif/i.test(message)) {
    return '更新包签名校验失败，请确认：\n1. GitHub Secrets 中的 TAURI_SIGNING_PRIVATE_KEY 是否正确\n2. tauri.conf.json 中的 pubkey 是否与私钥匹配\n3. 最近一次 release CI 是否成功生成了 latest.json'
  }

  // Network-related
  if (/network|fetch|connect|timeout|dns|ENOTFOUND/i.test(message)) {
    return `网络连接失败：无法获取更新信息。请检查网络连接后重试。\n(${message})`
  }

  // File/permission errors
  if (/permission|denied|EACCES|EPERM/i.test(message)) {
    return `权限不足：无法写入更新文件。请尝试以管理员身份运行应用。\n(${message})`
  }

  // NSIS/installer errors on Windows
  if (isWindows && (/install|setup|msi|nsis/i.test(message))) {
    return `安装更新失败。请手动从 GitHub Releases 页面下载最新版本安装。\n(${message})`
  }

  return `更新失败：${message}`
}

async function checkForUpdate(options: { silent?: boolean } = {}) {
  if (checking.value || downloading.value || installing.value) return availableUpdate.value

  checking.value = true
  resetCheckState()

  try {
    const proxy = await resolveUpdateProxy()
    const update = await check({
      timeout: UPDATE_CHECK_TIMEOUT_MS,
      proxy: proxy ?? undefined,
    })
    availableUpdate.value = update
    updateAvailable.value = Boolean(update)
    if (update) {
      updateInfo.value = {
        version: update.version,
        body: update.body,
      }
    }
    checked.value = true
    return update
  } catch (e) {
    if (!options.silent) {
      error.value = formatUpdateError(e)
    }
    return null
  } finally {
    checking.value = false
  }
}

async function autoCheckForUpdate() {
  if (!canRunAutoCheck()) return null
  markAutoCheckAttempt()
  return checkForUpdate({ silent: true })
}

async function downloadAndInstall() {
  if (!updateAvailable.value && !availableUpdate.value) return

  downloading.value = true
  installing.value = false
  downloadProgress.value = 0
  error.value = null
  installFailed.value = false
  downloadFailed.value = false
  macRepairStatus.value = ''
  copiedRepairCommand.value = false

  try {
    const proxy = await resolveUpdateProxy()
    const update = availableUpdate.value ?? await check({
      timeout: UPDATE_CHECK_TIMEOUT_MS,
      proxy: proxy ?? undefined,
    })
    if (!update) return

    let downloaded = 0
    let contentLength = 0

    try {
      await update.download(event => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength ?? 0
            break
          case 'Progress':
            downloaded += event.data.chunkLength
            if (contentLength > 0) {
              downloadProgress.value = Math.round((downloaded / contentLength) * 100)
            }
            break
          case 'Finished':
            downloadProgress.value = 100
            break
        }
      }, { timeout: UPDATE_DOWNLOAD_TIMEOUT_MS })
    } catch (e) {
      downloadFailed.value = true
      installFailed.value = true
      error.value = `下载更新失败：${formatUpdateError(e)}`
      return
    }

    downloading.value = false
    installing.value = true
    try {
      await update.install()
    } catch (e) {
      installFailed.value = true
      error.value = `安装更新失败：${formatUpdateError(e)}`
      return
    }

    installFinished.value = true
    updateAvailable.value = false
    availableUpdate.value = null

    if (isMacOS) {
      await refreshMacUpdateHealth(true)
      if (macQuarantined.value) {
        macRepairStatus.value = '更新已安装，但检测到系统隔离属性（com.apple.quarantine），请在终端执行下方命令后重新启动应用。'
        return
      }
    }

    // Brief delay to ensure the installer completes before relaunch
    await new Promise(resolve => setTimeout(resolve, isMacOS ? 800 : 500))
    await relaunch()
  } catch (e) {
    installFailed.value = true
    error.value = `更新失败：${formatUpdateError(e)}`
  } finally {
    downloading.value = false
    installing.value = false
  }
}

async function refreshMacUpdateHealth(showStatus = false) {
  if (!isMacOS) return
  try {
    const health = await invoke<MacosUpdateHealth | null>('get_macos_update_health')
    if (!health) return
    macRepairCommand.value = health.repair_command
    macQuarantined.value = health.quarantined
    if (showStatus) {
      macRepairStatus.value = health.quarantined
        ? '仍检测到隔离属性（com.apple.quarantine）。请在终端执行下方命令后重新启动应用。'
        : '检测通过，正在重启应用...'
    }
  } catch {
    if (showStatus) {
      macRepairStatus.value = '检测失败，请手动在终端执行 xattr 命令后再重试。'
    }
  }
}

async function copyRepairCommand() {
  if (!macRepairCommand.value) return
  try {
    await navigator.clipboard.writeText(macRepairCommand.value)
    copiedRepairCommand.value = true
  } catch {
    copiedRepairCommand.value = false
  }
}

async function recheckAfterRepair() {
  await refreshMacUpdateHealth(true)
  if (installFinished.value && isMacOS && !macQuarantined.value) {
    await relaunch()
  }
}

function dismissUpdateNotice() {
  updateNoticeDismissed.value = true
}

function openReleasePage() {
  void open(GITHUB_RELEASES_URL)
}

export function useUpdater() {
  return {
    checking,
    checked,
    updateAvailable,
    downloading,
    installing,
    downloadProgress,
    error,
    updateInfo,
    installFinished,
    installFailed,
    downloadFailed,
    updateNoticeDismissed,
    hasVisibleUpdateWork,
    isMacOS,
    macQuarantined,
    macRepairCommand,
    macRepairStatus,
    copiedRepairCommand,
    checkForUpdate,
    autoCheckForUpdate,
    downloadAndInstall,
    refreshMacUpdateHealth,
    copyRepairCommand,
    recheckAfterRepair,
    dismissUpdateNotice,
    openReleasePage,
  }
}

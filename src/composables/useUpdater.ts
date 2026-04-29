import { computed, ref, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'
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

const checking = ref(false)
const checked = ref(false)
const updateAvailable = ref(false)
const downloading = ref(false)
const downloadProgress = ref(0)
const error = ref<string | null>(null)
const updateInfo = ref<{ version: string; body?: string } | null>(null)
const availableUpdate = ref<AvailableUpdate | null>(null)
const installFinished = ref(false)
const updateNoticeDismissed = ref(false)

const isMacOS = navigator.userAgent.toLowerCase().includes('mac')
const macQuarantined = ref(false)
const macRepairCommand = ref('')
const macRepairStatus = ref('')
const copiedRepairCommand = ref(false)

const hasVisibleUpdateWork = computed(() =>
  updateAvailable.value || downloading.value || (installFinished.value && isMacOS),
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
  installFinished.value = false
}

async function checkForUpdate(options: { silent?: boolean } = {}) {
  if (checking.value || downloading.value) return availableUpdate.value

  checking.value = true
  resetCheckState()

  try {
    const update = await check()
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
      error.value = e instanceof Error ? e.message : '检查更新失败'
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
  downloadProgress.value = 0
  error.value = null
  macRepairStatus.value = ''
  copiedRepairCommand.value = false

  try {
    const update = availableUpdate.value ?? await check()
    if (!update) return

    let downloaded = 0
    let contentLength = 0

    await update.downloadAndInstall(event => {
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
    })

    installFinished.value = true
    updateAvailable.value = false
    availableUpdate.value = null

    if (isMacOS) {
      await refreshMacUpdateHealth(true)
      if (macQuarantined.value) {
        macRepairStatus.value = '更新已安装，但检测到系统隔离属性，请执行命令后重新检测。'
        return
      }
    }

    if (!isMacOS) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    await relaunch()
  } catch (e) {
    const message = e instanceof Error ? e.message : '下载更新失败'
    error.value = /signature|公钥|校验/i.test(message)
      ? '更新包签名校验失败，请先配置 updater pubkey 和 latest.json 的 signature。'
      : message
  } finally {
    downloading.value = false
  }
}

async function refreshMacUpdateHealth(showStatus = false) {
  if (!isMacOS) return
  try {
    const health = await invoke<MacosUpdateHealth | null>('get_macos_update_health')
    if (!health) return
    if (!macRepairCommand.value || macRepairCommand.value.startsWith('xattr -dr com.apple.quarantine')) {
      macRepairCommand.value = health.repair_command
    }
    macQuarantined.value = health.quarantined
    if (showStatus) {
      macRepairStatus.value = health.quarantined
        ? '仍检测到隔离属性，请在终端执行命令后再次检测。'
        : '检测通过，正在重启应用...'
    }
  } catch {
    if (showStatus) {
      macRepairStatus.value = '检测失败，请手动执行命令后再重试。'
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

export function useUpdater() {
  return {
    checking,
    checked,
    updateAvailable,
    downloading,
    downloadProgress,
    error,
    updateInfo,
    installFinished,
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
  }
}

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { open } from '@tauri-apps/plugin-shell'
import { getName, getVersion } from '@tauri-apps/api/app'
import { invoke } from '@tauri-apps/api/core'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

const emit = defineEmits<{ close: [] }>()

const appName = ref('专注岛')
const appVersion = ref('')

// 更新状态
const checking = ref(false)
const updateAvailable = ref(false)
const downloading = ref(false)
const downloadProgress = ref(0)
const error = ref<string | null>(null)
const updateInfo = ref<{ version: string; body?: string } | null>(null)
const checked = ref(false)  // 是否已检查过
const availableUpdate = ref<Awaited<ReturnType<typeof check>> | null>(null)
const installFinished = ref(false)

const isMacOS = navigator.userAgent.toLowerCase().includes('mac')
const macQuarantined = ref(false)
const macRepairCommand = ref('')
const macRepairStatus = ref('')
const copiedRepairCommand = ref(false)

const githubUrl = 'https://github.com/ipfred/focus-island'
import appIcon from '../../src-tauri/icons/128x128.png'

interface MacosUpdateHealth {
  app_path: string
  quarantined: boolean
  repair_command: string
}

onMounted(async () => {
  try {
    appName.value = await getName()
    appVersion.value = await getVersion()
  } catch {
    appName.value = '专注岛'
    appVersion.value = '1.3.3'
  }
  await refreshMacUpdateHealth()
})

function openGitHub() {
  open(githubUrl)
}

function onBackdropClick(event: MouseEvent) {
  if (event.target === event.currentTarget) {
    emit('close')
  }
}

async function checkForUpdate() {
  checking.value = true
  error.value = null
  updateAvailable.value = false
  updateInfo.value = null
  availableUpdate.value = null
  installFinished.value = false

  try {
    console.log('开始检查更新...')
    const update = await check()
    console.log('更新检查结果:', update)
    availableUpdate.value = update
    if (update) {
      updateAvailable.value = true
      updateInfo.value = {
        version: update.version,
        body: update.body
      }
    }
    checked.value = true
  } catch (e) {
    console.error('更新检查错误:', e)
    error.value = e instanceof Error ? e.message : '检查更新失败'
  } finally {
    checking.value = false
  }
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
    if (update) {
      let downloaded = 0
      let contentLength = 0

      await update.downloadAndInstall((event) => {
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

      await relaunch()
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : '下载更新失败'
    if (/signature|公钥|校验/i.test(message)) {
      error.value = '更新包签名校验失败，请先配置 updater pubkey 和 latest.json 的 signature。'
    } else {
      error.value = message
    }
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
</script>

<template>
  <div class="dialog-backdrop" @click="onBackdropClick">
    <div class="dialog-container" @click.stop>
      <!-- 应用图标 -->
      <div class="app-icon-wrapper">
        <img :src="appIcon" :alt="appName" class="app-icon" />
      </div>

      <!-- 应用名称和版本 -->
      <div class="app-info">
        <h2 class="app-name">{{ appName }}</h2>
        <span class="app-version">v{{ appVersion }}</span>
      </div>

      <!-- GitHub 链接 -->
      <button class="link-btn" @click="openGitHub">
        <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
        </svg>
        <span>GitHub</span>
      </button>

      <!-- 更新区域 -->
      <div class="update-area">
        <!-- 检查更新按钮 -->
        <button
          v-if="!updateAvailable && !downloading && !installFinished"
          class="link-btn"
          :disabled="checking"
          @click="checkForUpdate"
        >
          <template v-if="checking">
            <span class="loading-spinner"></span>
            <span>检查中...</span>
          </template>
          <template v-else>
            <span>检查更新</span>
          </template>
        </button>

        <!-- 有更新时显示 -->
        <template v-if="updateAvailable && !downloading">
          <div class="update-info">
            <span class="new-version">发现新版本 v{{ updateInfo?.version }}</span>
          </div>
          <button class="link-btn install-btn" @click="downloadAndInstall">
            <span>安装更新</span>
          </button>
        </template>

        <!-- 下载中 -->
        <template v-if="downloading">
          <div class="download-progress">
            <span class="loading-spinner"></span>
            <span>下载中 {{ downloadProgress }}%</span>
          </div>
        </template>

        <!-- macOS 安装后隔离属性修复 -->
        <template v-if="installFinished && isMacOS">
          <div class="status-hint">
            更新已安装
          </div>
          <div v-if="macQuarantined" class="mac-repair">
            <label class="repair-label">若更新后无法打开，请在终端执行（可编辑）：</label>
            <input v-model="macRepairCommand" class="repair-input" />
            <div class="repair-actions">
              <button class="link-btn" @click="copyRepairCommand">
                {{ copiedRepairCommand ? '已复制' : '复制命令' }}
              </button>
              <button class="link-btn install-btn" @click="recheckAfterRepair">
                重新检测并重启
              </button>
            </div>
            <div v-if="macRepairStatus" class="status-hint">{{ macRepairStatus }}</div>
          </div>
        </template>

        <!-- 无更新提示 -->
        <div v-if="checked && !updateAvailable && !error && !installFinished" class="status-hint">
          已是最新版本
        </div>

        <!-- 错误提示 -->
        <div v-if="error" class="error-msg">{{ error }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../styles.css";

.dialog-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fade-in 0.2s ease-out;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.dialog-container {
  width: 260px;
  padding: 28px 24px;
  background: linear-gradient(180deg, rgba(28, 28, 32, 0.98), rgba(22, 22, 26, 0.97));
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  animation: scale-in 0.25s cubic-bezier(0.2, 0.8, 0.22, 1);
}

@keyframes scale-in {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.app-icon-wrapper {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
}

.app-icon {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.app-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.app-name {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin: 0;
}

.app-version {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.4);
}

.link-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  cursor: pointer;
  transition: color 0.2s;
}

.link-btn:hover {
  color: var(--focus-color);
}

.link-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.link-btn .icon {
  width: 16px;
  height: 16px;
}

.update-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  min-height: 32px;
}

.update-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.new-version {
  font-size: 13px;
  color: var(--focus-color);
  font-weight: 500;
}

.install-btn {
  font-weight: 500;
}

.download-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
}

.error-msg {
  font-size: 12px;
  color: #f87171;
  text-align: center;
}

.loading-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: currentColor;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-hint {
  font-size: 12px;
  color: #4ade80;
}

.mac-repair {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.repair-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  text-align: left;
}

.repair-input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.14);
  background: rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  color: #fff;
  font-size: 11px;
  padding: 8px;
}

.repair-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
</style>

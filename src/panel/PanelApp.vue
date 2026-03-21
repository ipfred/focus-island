<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useTimerBridge } from '../composables/useTimerBridge'
import TaskArea from './TaskArea.vue'
import PanelTitleBar from './PanelTitleBar.vue'

const { startBridge } = useTimerBridge()
const isVisible = ref(true)
const isClosing = ref(false)
let unlistenResize: (() => void) | null = null
let resizeTimer: number | null = null
let closeTimer: number | null = null

onMounted(async () => {
  startBridge()
  await invoke('set_click_through', { ignore: false })

  const win = getCurrentWebviewWindow()
  const appWindow = getCurrentWindow()
  try {
    await win.setBackgroundColor([0, 0, 0, 0])
  } catch {
    // ignore if not supported or denied
  }
  const scheduleReposition = () => {
    if (resizeTimer) window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      invoke('position_panel_under_island')
    }, 120)
  }
  scheduleReposition()
  unlistenResize = await appWindow.onResized(() => {
    scheduleReposition()
  })
  await win.onFocusChanged(({ payload: focused }) => {
    if (focused) {
      isVisible.value = true
      isClosing.value = false
      if (closeTimer) {
        window.clearTimeout(closeTimer)
        closeTimer = null
      }
    }
  })
})

onUnmounted(() => {
  if (unlistenResize) unlistenResize()
})

async function closeWindow() {
  if (isClosing.value) return
  isClosing.value = true
  isVisible.value = false
  closeTimer = window.setTimeout(() => {
    invoke('hide_panel')
    closeTimer = null
  }, 200)
}
</script>

<template>
  <div class="panel-root" :class="isVisible ? 'animate-in' : 'animate-out'">
    <PanelTitleBar @close="closeWindow" />
    <div class="panel-body">
      <TaskArea category="today" @close="closeWindow" />
    </div>
  </div>
</template>

<style scoped>
.panel-root {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  background: #121216;
  border-radius: 12px;
  border: 1px solid rgba(255,255,255,0.08);
  overflow: hidden;
  color: #e8e8ea;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  transform-origin: top center;
  will-change: transform, opacity;
}

.animate-in {
  animation: panel-pop-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.animate-out {
  animation: panel-pop-out 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

@keyframes panel-pop-in {
  0% { transform: scale(0.92) translateY(-28px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

@keyframes panel-pop-out {
  0% { transform: scale(1) translateY(0); opacity: 1; }
  100% { transform: scale(0.92) translateY(-28px); opacity: 0; }
}

.panel-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  background: transparent;
}
</style>

<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useTimerBridge } from '../composables/useTimerBridge'
import { useSettings } from '../composables/useSettings'
import TaskArea from './TaskArea.vue'
import SettingsPage from './SettingsPage.vue'
import PanelTitleBar from './PanelTitleBar.vue'

const { startBridge } = useTimerBridge()
useSettings()

const currentView = ref<'tasks' | 'settings'>('tasks')
const isVisible = ref(true)
const isClosing = ref(false)
const isWindowAnimating = ref(false)
let unlistenResize: (() => void) | null = null
let unlistenAnim: (() => void) | null = null
let resizeTimer: number | null = null

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
    if (isWindowAnimating.value) return
    if (resizeTimer) window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      invoke('position_panel_under_island')
    }, 120)
  }
  scheduleReposition()
  unlistenResize = await appWindow.onResized(() => {
    scheduleReposition()
  })
  unlistenAnim = await listen<boolean>('panel-window-anim', event => {
    isWindowAnimating.value = !!event.payload
  })
  await win.onFocusChanged(({ payload: focused }) => {
    if (focused) {
      isVisible.value = true
      isClosing.value = false
    }
  })
})

onUnmounted(() => {
  if (unlistenResize) unlistenResize()
  if (unlistenAnim) unlistenAnim()
})

async function closeWindow() {
  if (isClosing.value) return
  isClosing.value = true
  await invoke('animate_panel_close')
}
</script>

<template>
  <div class="panel-root" :class="isVisible ? 'animate-in' : 'animate-out'">
    <PanelTitleBar @close="closeWindow" />
    <div class="panel-body">
      <transition name="slide-right" mode="out-in">
        <TaskArea v-if="currentView === 'tasks'" category="today" @close="closeWindow" @settings="currentView = 'settings'" />
        <SettingsPage v-else @back="currentView = 'tasks'" />
      </transition>
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
  animation: panel-fade-in 0.18s ease-out forwards;
}

.animate-out {
  animation: panel-fade-out 0.18s ease-in forwards;
}

@keyframes panel-fade-in {
  0% { opacity: 0; }
  100% { opacity: 1; }
}

@keyframes panel-fade-out {
  0% { opacity: 1; }
  100% { opacity: 0; }
}

.panel-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  background: transparent;
}
</style>

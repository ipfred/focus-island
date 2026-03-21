<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useTimerBridge } from '../composables/useTimerBridge'
import TaskArea from './TaskArea.vue'
import PanelTitleBar from './PanelTitleBar.vue'

const { startBridge } = useTimerBridge()
const isVisible = ref(true)

onMounted(async () => {
  startBridge()
  await invoke('set_click_through', { ignore: false })

  const win = getCurrentWebviewWindow()
  try {
    await win.setBackgroundColor([0, 0, 0, 0])
  } catch {
    // ignore if not supported or denied
  }
  await win.onFocusChanged(({ payload: focused }) => {
    if (focused) {
      isVisible.value = true
    }
  })
})

async function closeWindow() {
  isVisible.value = false
  // 立即通知后端隐藏，让灵动岛能及时响应
  await invoke('hide_panel')
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
  0% { transform: scale(0.9) translateY(-40px); opacity: 0; }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}

@keyframes panel-pop-out {
  0% { transform: scale(1) translateY(0); opacity: 1; }
  100% { transform: scale(0.9) translateY(-40px); opacity: 0; }
}

.panel-body {
  display: flex;
  flex: 1;
  overflow: hidden;
  background: transparent;
}
</style>

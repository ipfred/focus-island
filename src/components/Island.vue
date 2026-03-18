<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useIslandState } from '../composables/useIslandState'
import { useTimer } from '../composables/useTimer'
import CapsuleIdle from './CapsuleIdle.vue'
import CapsuleFocus from './CapsuleFocus.vue'
import LineHide from './LineHide.vue'
import type { TimerStatePayload } from '../composables/useTimerBridge'

const { state, setState } = useIslandState()
const timer = useTimer()

const isHovered = ref(false)
const islandHeight = ref(60.0) // 跟踪当前窗口高度

// 监听来自 panel 的计时器状态广播
let unlisten: (() => void) | null = null
let mouseInterval: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  unlisten = await listen<TimerStatePayload>('timer-state-update', ({ payload }) => {
    timer.remaining.value = payload.remaining
    timer.running.value = payload.running
    timer.activeTaskId.value = payload.activeTaskId
    if (payload.phase !== timer.phase.value) {
      timer.phase.value = payload.phase
    }

    // 只有在没被 hover 的情况下根据计时器同步状态
    if (!isHovered.value) {
      if (payload.running && payload.phase === 'focus' && state.value === 'idle') {
        setState('focus')
      } else if (payload.running && payload.phase === 'break' && state.value !== 'break') {
        setState('break')
      } else if (!payload.running && !payload.activeTaskId &&
                 state.value !== 'idle' && state.value !== 'hide' && state.value !== 'alert') {
        setState('idle')
      }
    }
  })

  // 持续轮询获取全局鼠标位置来检测 hover（因为窗口本身是鼠标穿透且透明的，无法接收 mouseenter）
  const win = getCurrentWebviewWindow()
  
  mouseInterval = setInterval(async () => {
    try {
      const [mouseX, mouseY] = await invoke<[number, number]>('get_mouse_position')
      const [winX, winY] = await invoke<[number, number]>('get_window_position', { window: win })
      const panelVisible = await invoke<boolean>('is_panel_visible')

      // 使用固定的检测区域（基于正常高度 60 时的位置）
      // 窗口宽度 360，胶囊宽度 320 居中
      // 检测区域：屏幕顶部中心，宽 340，高 50
      const islandCenterX = winX + 180
      const islandTop = winY
      const islandBottom = winY + 50 // 固定检测高度，不随窗口高度变化

      const dx = Math.abs(mouseX - islandCenterX)
      const inVerticalRange = mouseY >= islandTop && mouseY <= islandBottom

      // 鼠标是否在灵动岛范围内
      const hoveringIsland = dx < 170 && inVerticalRange

      if (panelVisible) {
        // 清单窗口打开时：强制显示灵动岛，不响应鼠标靠近
        if (state.value === 'hide') {
          // 从隐藏状态恢复
          isHovered.value = false
          islandHeight.value = 60.0
          invoke('set_island_height', { height: 60.0 })
          if (timer.running.value) {
            setState(timer.phase.value === 'focus' ? 'focus' : 'break')
          } else {
            setState('idle')
          }
        } else if (isHovered.value) {
          // 重置 isHovered 状态
          isHovered.value = false
        }
        // 清单打开时始终保持灵动岛显示，忽略鼠标位置
      } else {
        // 清单窗口关闭时：鼠标移到灵动岛则隐藏变细线，移走则恢复
        if (hoveringIsland && !isHovered.value) {
          isHovered.value = true
          islandHeight.value = 8.0
          setState('hide')
          invoke('set_island_height', { height: 8.0 })
        } else if (!hoveringIsland && isHovered.value) {
          isHovered.value = false
          islandHeight.value = 60.0
          invoke('set_island_height', { height: 60.0 })
          // 鼠标离开，恢复状态
          if (timer.running.value) {
            setState(timer.phase.value === 'focus' ? 'focus' : 'break')
          } else if (state.value !== 'alert') {
            setState('idle')
          }
        }
      }
    } catch (e) {
      console.error('get_mouse_position error', e)
    }
  }, 50)
})

onUnmounted(() => { 
  unlisten?.() 
  if (mouseInterval) clearInterval(mouseInterval)
})
</script>

<template>
  <div class="island-container w-full h-full flex items-start justify-center pt-[4px]">
    <Transition name="fade" mode="out-in">
      <LineHide v-if="state === 'hide'" key="hide" />
      <div
        v-else
        key="capsule"
        class="capsule-shell relative flex items-center justify-center"
        :class="{
          'ring-focus': timer.phase.value === 'focus' && timer.running.value,
          'ring-break': timer.phase.value === 'break' && timer.running.value,
        }"
      >
        <CapsuleIdle v-if="state === 'idle' || state === 'alert'" />
        <CapsuleFocus v-else-if="state === 'focus' || state === 'break'" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.island-container {
  /* items-start justify-center to stick to top edge */
}

.capsule-shell {
  width: 320px;
  height: 44px;
  border-radius: 22px;
  background: rgba(20, 20, 22, 0.92);
  backdrop-filter: blur(16px);
  box-shadow: 0 4px 32px rgba(0,0,0,0.45);
  transition: box-shadow 0.4s ease;
}

.ring-focus {
  box-shadow: 0 0 0 2px var(--focus-color), 0 4px 32px rgba(0,0,0,0.45);
}

.ring-break {
  box-shadow: 0 0 0 2px var(--break-color), 0 4px 32px rgba(0,0,0,0.45);
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

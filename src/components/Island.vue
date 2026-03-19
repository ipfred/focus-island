<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { useIslandState } from '../composables/useIslandState'
import { useTimer } from '../composables/useTimer'
import CapsuleIdle from './CapsuleIdle.vue'
import CapsuleFocus from './CapsuleFocus.vue'
import type { TimerStatePayload } from '../composables/useTimerBridge'

const { state, setState } = useIslandState()
const timer = useTimer()

let unlisten: (() => void) | null = null
const VISIBLE_HEIGHT = 42.0

const progressColor = computed(() => 'rgba(255,255,255,0.9)')

const progressScale = computed(() => {
  const v = timer.progress.value
  if (Number.isNaN(v) || v <= 0) return 0
  if (v >= 1) return 1
  return v
})

onMounted(async () => {
  // 灵动岛始终显示，且鼠标穿透
  invoke('set_island_height', { height: VISIBLE_HEIGHT })
  invoke('set_click_through', { ignore: true })

  unlisten = await listen<TimerStatePayload>('timer-state-update', ({ payload }) => {
    timer.remaining.value = payload.remaining
    timer.running.value = payload.running
    timer.activeTaskId.value = payload.activeTaskId
    if (payload.phase !== timer.phase.value) {
      timer.phase.value = payload.phase
    }

    if (payload.running && payload.phase === 'focus' && state.value === 'idle') {
      setState('focus')
    } else if (payload.running && payload.phase === 'break' && state.value !== 'break') {
      setState('break')
    } else if (!payload.running && !payload.activeTaskId &&
               state.value !== 'idle' && state.value !== 'alert') {
      setState('idle')
    }
  })
})

onUnmounted(() => {
  unlisten?.()
})
</script>

<template>
  <div
    class="island-container w-full h-full flex items-start justify-center"
  >
    <div
      class="capsule-shell relative flex items-center justify-center"
      :class="{
        'ring-focus': timer.phase.value === 'focus' && timer.running.value,
        'ring-break': timer.phase.value === 'break' && timer.running.value,
      }"
    >
      <CapsuleIdle v-if="state === 'idle' || state === 'alert'" />
      <CapsuleFocus v-else-if="state === 'focus' || state === 'break'" />
      <div class="progress-track">
        <div
          class="progress-bar"
          :style="{
            transform: `scaleX(${progressScale})`,
            backgroundColor: progressColor,
            opacity: timer.running.value ? 0.9 : 0.35,
          }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.island-container {
  /* items-start justify-center to stick to top edge */
}

.capsule-shell {
  width: 320px;
  height: 34px;
  border-radius: 17px;
  background: rgba(20, 20, 22, 0.82);
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

.progress-track {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 2px;
  height: 2px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
  pointer-events: none;
}

.progress-bar {
  height: 100%;
  width: 100%;
  transform-origin: left center;
  transition: transform 0.4s linear, opacity 0.3s ease;
}
</style>

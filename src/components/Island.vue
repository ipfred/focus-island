<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { useIslandState } from '../composables/useIslandState'
import { useTimer } from '../composables/useTimer'
import CapsuleIdle from './CapsuleIdle.vue'
import CapsuleFocus from './CapsuleFocus.vue'
import LineHide from './LineHide.vue'
import type { TimerStatePayload } from '../composables/useTimerBridge'

const { state, setState } = useIslandState()
const timer = useTimer()

// 监听来自 panel 的计时器状态广播
let unlisten: (() => void) | null = null
onMounted(async () => {
  unlisten = await listen<TimerStatePayload>('timer-state-update', ({ payload }) => {
    timer.remaining.value = payload.remaining
    timer.running.value = payload.running
    timer.activeTaskId.value = payload.activeTaskId
    if (payload.phase !== timer.phase.value) {
      timer.phase.value = payload.phase
    }

    // 同步 island 状态
    if (payload.running && payload.phase === 'focus' && state.value === 'idle') {
      setState('focus')
    } else if (payload.running && payload.phase === 'break' && state.value !== 'break') {
      setState('break')
    } else if (!payload.running && !payload.activeTaskId &&
               state.value !== 'idle' && state.value !== 'hide' && state.value !== 'alert') {
      setState('idle')
    }
  })
})

onUnmounted(() => { unlisten?.() })
</script>

<template>
  <div class="w-full h-full flex items-center justify-center">
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

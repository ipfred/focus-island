<script setup lang="ts">
import { computed } from 'vue'
import { useTimer } from '../composables/useTimer'
import { useTasks } from '../composables/useTasks'

const { displayTime, phase, activeTaskId, activeTaskTitle, running } = useTimer()
const { tasks } = useTasks()

defineProps<{ radioPlaying?: boolean }>()

const activeTask = computed(() =>
  tasks.value.find(t => t.id === activeTaskId.value)
)
const resolvedTitle = computed(() =>
  activeTaskTitle.value ?? activeTask.value?.title ?? null
)

const phaseColor = computed(() =>
  phase.value === 'focus' ? 'var(--focus-color)' : 'var(--break-color)'
)
</script>

<template>
  <div class="capsule-focus flex items-center justify-between w-full h-full px-4 gap-3">
    <!-- Phase indicator dot -->
    <div
      class="shrink-0 w-2 h-2 rounded-full"
      :class="running ? 'animate-pulse' : ''"
      :style="{ backgroundColor: phaseColor, width: `calc(8px * var(--island-scale, 1))`, height: `calc(8px * var(--island-scale, 1))` }"
    />

    <!-- Task name -->
    <div class="flex-1 min-w-0">
      <span
        class="text-white/90 font-medium truncate block"
        :style="{ fontSize: `calc(12px * var(--island-scale, 1))` }"
      >{{ resolvedTitle ?? (phase === 'break' ? '休息一下' : '专注中') }}</span>
    </div>

    <!-- Countdown -->
    <div class="shrink-0 flex items-center gap-1.5">
      <span :style="{ color: phaseColor, fontSize: `calc(14px * var(--island-scale, 1))` }" class="font-mono font-bold tabular-nums">
        {{ displayTime }}
      </span>
      <span class="text-white/20" :style="{ fontSize: `calc(10px * var(--island-scale, 1))` }">
        {{ running ? '' : '⏸' }}
      </span>
      <span v-if="radioPlaying" class="music-note" :style="{ fontSize: `calc(10px * var(--island-scale, 1))` }">♪</span>
    </div>
  </div>
</template>

<style scoped>
.music-note {
  color: var(--focus-color);
  opacity: 0.7;
  animation: note-pulse 2s ease-in-out infinite;
}

@keyframes note-pulse {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 0.9; }
}
</style>

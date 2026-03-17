<script setup lang="ts">
import { computed } from 'vue'
import { useTimer } from '../composables/useTimer'
import { useTasks } from '../composables/useTasks'

const { displayTime, phase, activeTaskId, running } = useTimer()
const { tasks } = useTasks()

const activeTask = computed(() =>
  tasks.value.find(t => t.id === activeTaskId.value)
)

const phaseColor = computed(() =>
  phase.value === 'focus' ? 'var(--focus-color)' : 'var(--break-color)'
)
</script>

<template>
  <div class="flex items-center justify-between w-full h-full px-4 gap-3">
    <!-- Phase indicator dot -->
    <div
      class="shrink-0 w-2 h-2 rounded-full"
      :class="running ? 'animate-pulse' : ''"
      :style="{ backgroundColor: phaseColor }"
    />

    <!-- Task name -->
    <div class="flex-1 min-w-0">
      <span
        class="text-white/90 text-xs font-medium truncate block"
      >{{ activeTask?.title ?? (phase === 'break' ? '休息一下' : '专注中') }}</span>
    </div>

    <!-- Countdown -->
    <div class="shrink-0 flex items-center gap-1.5">
      <span :style="{ color: phaseColor }" class="text-sm font-mono font-bold tabular-nums">
        {{ displayTime }}
      </span>
      <span class="text-white/20 text-[10px]">
        {{ running ? '' : '⏸' }}
      </span>
    </div>
  </div>
</template>

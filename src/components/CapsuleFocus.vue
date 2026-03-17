<script setup lang="ts">
import { computed } from 'vue'
import { useTimer } from '../composables/useTimer'
import { useTasks } from '../composables/useTasks'

const { displayTime, progress, phase, activeTaskId, running } = useTimer()
const { tasks } = useTasks()

const activeTask = computed(() =>
  tasks.value.find(t => t.id === activeTaskId.value)
)

// SVG progress ring
const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS
const strokeDashoffset = computed(() => CIRCUMFERENCE * (1 - progress.value))
const ringColor = computed(() =>
  phase.value === 'focus' ? 'var(--focus-color)' : 'var(--break-color)'
)
</script>

<template>
  <div class="flex items-center justify-between w-full h-full px-3 gap-2">
    <!-- Progress ring -->
    <svg class="shrink-0" width="36" height="36" viewBox="0 0 60 60">
      <circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="4" />
      <circle
        cx="30" cy="30" r="26"
        fill="none"
        :stroke="ringColor"
        stroke-width="4"
        stroke-linecap="round"
        :stroke-dasharray="CIRCUMFERENCE"
        :stroke-dashoffset="strokeDashoffset"
        transform="rotate(-90 30 30)"
        class="transition-all duration-1000 ease-linear"
      />
    </svg>

    <!-- Task name -->
    <div class="flex-1 min-w-0">
      <div class="text-white text-sm font-medium truncate">
        {{ activeTask?.title ?? (phase === 'break' ? 'Break time' : 'Focus') }}
      </div>
      <div class="text-white/40 text-xs">
        {{ phase === 'break' ? 'Rest' : 'Focus' }}
      </div>
    </div>

    <!-- Countdown -->
    <div class="shrink-0 text-right">
      <div :style="{ color: ringColor }" class="text-lg font-mono font-bold tabular-nums">
        {{ displayTime }}
      </div>
      <div class="text-white/30 text-xs">
        {{ running ? 'running' : 'paused' }}
      </div>
    </div>
  </div>
</template>

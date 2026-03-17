<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTasks } from '../composables/useTasks'
import { useTimer } from '../composables/useTimer'

const { activeTasks } = useTasks()
const { start } = useTimer()

const carouselIndex = ref(0)
let carouselTimer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  carouselTimer = setInterval(() => {
    if (activeTasks.value.length > 0) {
      carouselIndex.value = (carouselIndex.value + 1) % Math.min(activeTasks.value.length, 3)
    }
  }, 10000)
})

onUnmounted(() => {
  if (carouselTimer) clearInterval(carouselTimer)
})

const displayedTasks = computed(() => {
  const active = activeTasks.value
  if (active.length === 0) return []
  return [active[carouselIndex.value % active.length]]
})
</script>

<template>
  <div class="flex items-center justify-center w-full h-full px-4 gap-3">
    <div v-if="activeTasks.length === 0" class="text-white/40 text-sm">
      No tasks — right-click to add
    </div>
    <TransitionGroup
      v-else
      tag="div"
      name="slide"
      class="flex items-center gap-2 w-full overflow-hidden"
    >
      <div
        v-for="task in displayedTasks"
        :key="task.id"
        class="flex items-center gap-2 w-full cursor-pointer"
        @click="start(task.id)"
      >
        <span class="text-[var(--idle-color)] text-xs shrink-0">
          {{ '●'.repeat(Math.min(task.pomodoroCount, 4)) }}{{ task.pomodoroCount > 4 ? `+${task.pomodoroCount - 4}` : '' }}
        </span>
        <span class="text-white text-sm truncate flex-1">{{ task.title }}</span>
        <span class="text-white/30 text-xs shrink-0">click to start</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition: all 0.4s ease;
}
.slide-enter-from { opacity: 0; transform: translateY(8px); }
.slide-leave-to   { opacity: 0; transform: translateY(-8px); }
</style>

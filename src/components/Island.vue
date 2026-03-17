<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useIslandState } from '../composables/useIslandState'
import { useTimer } from '../composables/useTimer'
import { useTasks } from '../composables/useTasks'
import CapsuleIdle from './CapsuleIdle.vue'
import CapsuleFocus from './CapsuleFocus.vue'
import LineHide from './LineHide.vue'
import TaskList from './TaskList.vue'

const { state, setState } = useIslandState()
const { phase: _phase, running, activeTaskId, pause, resume, skipToBreak, skipBreak, abandon, onPhaseDoneCallback } = useTimer()
const { incrementPomodoro } = useTasks()

// When focus phase ends, increment the task's pomodoro count
onPhaseDoneCallback((completedPhase, taskId) => {
  if (completedPhase === 'focus' && taskId) {
    incrementPomodoro(taskId)
    setState('break')
  } else if (completedPhase === 'break') {
    setState('idle')
  }
})

// Sync timer state → island state
watch(activeTaskId, (id) => {
  if (id && state.value === 'idle') setState('focus')
})

// Context menu
const ctxMenu = ref(false)
const ctxX = ref(0)
const ctxY = ref(0)

function onRightClick(e: MouseEvent) {
  e.preventDefault()
  ctxX.value = e.clientX
  ctxY.value = e.clientY
  ctxMenu.value = true
}

function closeCtx() {
  ctxMenu.value = false
}

// Task list popover
const showTasks = ref(false)
function toggleTasks() {
  showTasks.value = !showTasks.value
}

// Island shape classes
const islandClass = computed(() => {
  if (state.value === 'hide') {
    return 'w-full h-[2px] rounded-full'
  }
  if (state.value === 'alert') {
    return 'w-[440px] h-[64px] rounded-[32px] ring-2 ring-[var(--alert-color)]'
  }
  return 'w-[420px] h-[64px] rounded-[32px]'
})

const bgClass = computed(() => {
  if (state.value === 'hide') return 'bg-transparent'
  if (state.value === 'alert') return 'bg-[var(--island-bg)]'
  return 'bg-[var(--island-bg)]'
})

const isFocusOrBreak = computed(() => state.value === 'focus' || state.value === 'break')
</script>

<template>
  <div class="flex items-start justify-center w-screen h-screen" @click.self="closeCtx">
    <!-- Island capsule -->
    <div
      class="relative transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden cursor-pointer mt-2"
      :class="[islandClass, bgClass]"
      @contextmenu="onRightClick"
      @click="showTasks = false"
    >
      <!-- Breathing glow for alert -->
      <div
        v-if="state === 'alert'"
        class="absolute inset-0 rounded-[32px] animate-pulse"
        style="box-shadow: 0 0 20px 4px var(--alert-color);"
      />

      <Transition name="fade" mode="out-in">
        <LineHide v-if="state === 'hide'" key="hide" />
        <CapsuleFocus v-else-if="isFocusOrBreak" key="focus" />
        <CapsuleIdle v-else key="idle" />
      </Transition>

      <!-- Alert overlay -->
      <Transition name="fade">
        <div
          v-if="state === 'alert'"
          class="absolute inset-0 flex items-center justify-center px-4"
        >
          <span class="text-[var(--alert-color)] text-sm font-medium text-center">
            Still working? Move mouse to continue
          </span>
        </div>
      </Transition>
    </div>

    <!-- Task list popover -->
    <Transition name="slide-down">
      <div
        v-if="showTasks"
        class="absolute top-[80px] left-1/2 -translate-x-1/2 z-50"
        @click.stop
      >
        <TaskList />
      </div>
    </Transition>

    <!-- Context menu -->
    <Transition name="fade">
      <div
        v-if="ctxMenu"
        class="fixed z-50 bg-[#111113] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[160px]"
        :style="{ left: ctxX + 'px', top: ctxY + 'px' }"
        @click.stop
      >
        <div class="px-3 py-1 text-white/30 text-xs uppercase tracking-widest">Timer</div>

        <button
          v-if="running"
          class="ctx-item"
          @click="pause(); closeCtx()"
        >Pause</button>
        <button
          v-else-if="activeTaskId"
          class="ctx-item"
          @click="resume(); closeCtx()"
        >Resume</button>

        <button
          v-if="state === 'focus'"
          class="ctx-item"
          @click="skipToBreak(); closeCtx()"
        >Skip to Break</button>
        <button
          v-if="state === 'break'"
          class="ctx-item"
          @click="skipBreak(); closeCtx()"
        >Skip Break</button>
        <button
          v-if="activeTaskId"
          class="ctx-item text-red-400"
          @click="abandon(); setState('idle'); closeCtx()"
        >Abandon</button>

        <div class="h-px bg-white/10 my-1" />

        <button class="ctx-item" @click="toggleTasks(); closeCtx()">Tasks...</button>
      </div>
    </Transition>

    <!-- Click outside context menu -->
    <div v-if="ctxMenu" class="fixed inset-0 z-40" @click="closeCtx" @contextmenu.prevent="closeCtx" />
  </div>
</template>

<style scoped>
@reference "../styles.css";
.ctx-item {
  @apply block w-full text-left px-4 py-1.5 text-sm text-white hover:bg-white/10 transition-colors;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.25s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1); }
.slide-down-enter-from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
.slide-down-leave-to  { opacity: 0; transform: translateX(-50%) translateY(-8px); }
</style>

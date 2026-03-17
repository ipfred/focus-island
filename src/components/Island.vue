<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useIslandState } from '../composables/useIslandState'
import { useTimer } from '../composables/useTimer'
import { useTasks } from '../composables/useTasks'
import CapsuleIdle from './CapsuleIdle.vue'
import CapsuleFocus from './CapsuleFocus.vue'
import LineHide from './LineHide.vue'
import TaskList from './TaskList.vue'

const { state, setState, setInteracting } = useIslandState()
const { running, activeTaskId, progress, phase, pause, resume, skipToBreak, skipBreak, abandon, onPhaseDoneCallback } = useTimer()
const { incrementPomodoro } = useTasks()

onPhaseDoneCallback((completedPhase, taskId) => {
  if (completedPhase === 'focus' && taskId) {
    incrementPomodoro(taskId)
    setState('break')
  } else if (completedPhase === 'break') {
    setState('idle')
  }
})

watch(activeTaskId, (id) => {
  if (id && state.value === 'idle') setState('focus')
  if (id) showTasks.value = false // close task list when starting a task
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

// Sync interacting state to disable proximity detection during UI interaction
watch([showTasks, ctxMenu], ([tasks, ctx]) => {
  setInteracting(tasks || ctx)
})

const isFocusOrBreak = computed(() => state.value === 'focus' || state.value === 'break')
const isHide = computed(() => state.value === 'hide')

// Progress border style (conic-gradient tracing around the island)
const progressColor = computed(() =>
  phase.value === 'focus' ? 'var(--focus-color)' : 'var(--break-color)'
)
const progressDeg = computed(() => progress.value * 360)
const progressBorderStyle = computed(() => ({
  background: `conic-gradient(from -90deg, ${progressColor.value} ${progressDeg.value}deg, rgba(255,255,255,0.06) ${progressDeg.value}deg)`
}))
const progressGlowStyle = computed(() => ({
  background: `conic-gradient(from -90deg, ${progressColor.value} ${progressDeg.value}deg, transparent ${progressDeg.value}deg)`,
  opacity: '0.4',
  filter: 'blur(6px)',
}))
</script>

<template>
  <div class="flex items-start justify-center w-screen h-screen" @click.self="closeCtx; showTasks = false">

    <!-- Hide state: thin line -->
    <Transition name="fade">
      <div
        v-if="isHide"
        class="mt-1 w-[320px] h-[2px]"
        @contextmenu="onRightClick"
      >
        <LineHide />
      </div>
    </Transition>

    <!-- Normal island -->
    <div v-if="!isHide" class="relative mt-2" @contextmenu="onRightClick">

      <!-- Progress border wrapper (only during focus/break) -->
      <div
        v-if="isFocusOrBreak"
        class="absolute inset-0 rounded-[24px] transition-all duration-1000 ease-linear"
        :style="progressBorderStyle"
      />
      <!-- Progress glow -->
      <div
        v-if="isFocusOrBreak"
        class="absolute inset-0 rounded-[24px] transition-all duration-1000 ease-linear"
        :style="progressGlowStyle"
      />

      <!-- Alert pulse glow -->
      <div
        v-if="state === 'alert'"
        class="absolute inset-0 rounded-[24px] animate-pulse"
        style="box-shadow: 0 0 16px 3px var(--alert-color);"
      />

      <!-- Island body (glass) -->
      <div
        class="relative rounded-[22px] backdrop-blur-xl cursor-pointer overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
        :class="[
          isFocusOrBreak ? 'm-[2px] w-[316px] h-[40px]' : 'w-[320px] h-[44px]',
          state === 'alert' ? 'ring-1 ring-[var(--alert-color)]/50' : '',
        ]"
        :style="{ background: 'var(--island-bg)' }"
        @click="showTasks = false"
      >
        <Transition name="fade" mode="out-in">
          <CapsuleFocus v-if="isFocusOrBreak" key="focus" />
          <CapsuleIdle v-else key="idle" />
        </Transition>

        <!-- Alert overlay text -->
        <Transition name="fade">
          <div
            v-if="state === 'alert'"
            class="absolute inset-0 flex items-center justify-center px-4"
          >
            <span class="text-[var(--alert-color)] text-xs font-medium">
              还在专注吗？移动鼠标继续
            </span>
          </div>
        </Transition>
      </div>
    </div>

    <!-- Task list popover -->
    <Transition name="slide-down">
      <div
        v-if="showTasks"
        class="absolute top-[60px] left-1/2 -translate-x-1/2 z-50"
        @click.stop
      >
        <TaskList />
      </div>
    </Transition>

    <!-- Context menu -->
    <Transition name="fade">
      <div
        v-if="ctxMenu"
        class="fixed z-50 bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl py-1 min-w-[150px]"
        :style="{ left: ctxX + 'px', top: ctxY + 'px' }"
        @click.stop
      >
        <div class="px-3 py-1 text-white/25 text-[10px] uppercase tracking-widest">计时</div>

        <button
          v-if="running"
          class="ctx-item"
          @click="pause(); closeCtx()"
        >暂停</button>
        <button
          v-else-if="activeTaskId"
          class="ctx-item"
          @click="resume(); closeCtx()"
        >继续</button>

        <button
          v-if="state === 'focus'"
          class="ctx-item"
          @click="skipToBreak(); closeCtx()"
        >跳过到休息</button>
        <button
          v-if="state === 'break'"
          class="ctx-item"
          @click="skipBreak(); closeCtx()"
        >跳过休息</button>
        <button
          v-if="activeTaskId"
          class="ctx-item text-red-400"
          @click="abandon(); setState('idle'); closeCtx()"
        >放弃番茄</button>

        <div class="h-px bg-white/10 my-1" />

        <button class="ctx-item" @click="toggleTasks(); closeCtx()">任务列表...</button>
      </div>
    </Transition>

    <!-- Click outside -->
    <div v-if="ctxMenu" class="fixed inset-0 z-40" @click="closeCtx" @contextmenu.prevent="closeCtx" />
  </div>
</template>

<style scoped>
@reference "../styles.css";
.ctx-item {
  @apply block w-full text-left px-4 py-1.5 text-xs text-white hover:bg-white/10 transition-colors;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.slide-down-enter-active, .slide-down-leave-active { transition: all 0.3s cubic-bezier(0.34,1.56,0.64,1); }
.slide-down-enter-from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
.slide-down-leave-to  { opacity: 0; transform: translateX(-50%) translateY(-6px); }
</style>

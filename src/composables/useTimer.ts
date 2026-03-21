import { ref, computed } from 'vue'

export type TimerPhase = 'focus' | 'break'

const FOCUS_DURATION = 25 * 60
const BREAK_DURATION = 5 * 60

const phase = ref<TimerPhase>('focus')
const remaining = ref(FOCUS_DURATION)
const running = ref(false)
const activeTaskId = ref<string | null>(null)
const activeTaskTitle = ref<string | null>(null)
let intervalId: ReturnType<typeof setInterval> | null = null

function tick() {
  if (remaining.value <= 0) {
    clearInterval(intervalId!)
    intervalId = null
    running.value = false
    onPhaseDone()
    return
  }
  remaining.value--
}

type PhaseCallback = (phase: TimerPhase, taskId: string | null) => void
const onDoneCallbacks: PhaseCallback[] = []

function onPhaseDone() {
  onDoneCallbacks.forEach(cb => cb(phase.value, activeTaskId.value))
  if (phase.value === 'focus') {
    phase.value = 'break'
    remaining.value = BREAK_DURATION
  } else {
    phase.value = 'focus'
    remaining.value = FOCUS_DURATION
    activeTaskId.value = null
    activeTaskTitle.value = null
  }
}

export function useTimer() {
  const progress = computed(() => {
    const total = phase.value === 'focus' ? FOCUS_DURATION : BREAK_DURATION
    return 1 - remaining.value / total
  })

  const displayTime = computed(() => {
    const m = Math.floor(remaining.value / 60).toString().padStart(2, '0')
    const s = (remaining.value % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  })

  function start(taskId: string, taskTitle?: string) {
    activeTaskId.value = taskId
    activeTaskTitle.value = taskTitle ?? null
    phase.value = 'focus'
    remaining.value = FOCUS_DURATION
    resume()
  }

  function resume() {
    if (running.value) return
    running.value = true
    intervalId = setInterval(tick, 1000)
  }

  function pause() {
    if (!running.value) return
    running.value = false
    clearInterval(intervalId!)
    intervalId = null
  }

  function skipToBreak() {
    pause()
    phase.value = 'break'
    remaining.value = BREAK_DURATION
    resume()
  }

  function skipBreak() {
    pause()
    phase.value = 'focus'
    remaining.value = FOCUS_DURATION
    activeTaskId.value = null
    activeTaskTitle.value = null
  }

  function abandon() {
    pause()
    phase.value = 'focus'
    remaining.value = FOCUS_DURATION
    activeTaskId.value = null
    activeTaskTitle.value = null
    running.value = false
  }

  function onPhaseDoneCallback(cb: PhaseCallback) {
    onDoneCallbacks.push(cb)
  }

  return {
    phase,
    remaining,
    running,
    activeTaskId,
    activeTaskTitle,
    progress,
    displayTime,
    start,
    resume,
    pause,
    skipToBreak,
    skipBreak,
    abandon,
    onPhaseDoneCallback,
  }
}

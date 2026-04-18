import { ref, computed } from 'vue'
import { useSettings } from './useSettings'

export type TimerPhase = 'focus' | 'break'

const phase = ref<TimerPhase>('focus')
const remaining = ref(25 * 60)
const totalDuration = ref(25 * 60)
const running = ref(false)
const activeTaskId = ref<string | null>(null)
const activeTaskTitle = ref<string | null>(null)
const focusStartedAt = ref<number | null>(null)
let intervalId: ReturnType<typeof setInterval> | null = null
let phaseEndAtMs: number | null = null

function syncRemainingFromEndAt() {
  if (phaseEndAtMs === null) return
  const next = Math.max(0, Math.ceil((phaseEndAtMs - Date.now()) / 1000))
  remaining.value = next
}

function startTicking() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  intervalId = setInterval(tick, 200)
}

function tick() {
  syncRemainingFromEndAt()
  if (remaining.value <= 0) {
    clearInterval(intervalId!)
    intervalId = null
    phaseEndAtMs = null
    running.value = false
    onPhaseDone()
    return
  }
}

type PhaseCallback = (phase: TimerPhase, taskId: string | null) => void
const onDoneCallbacks: PhaseCallback[] = []

function onPhaseDone() {
  const { settings } = useSettings()
  onDoneCallbacks.forEach(cb => cb(phase.value, activeTaskId.value))
  if (phase.value === 'focus') {
    phase.value = 'break'
    focusStartedAt.value = null
    const breakSecs = settings.value.breakDuration * 60
    remaining.value = breakSecs
    totalDuration.value = breakSecs
    running.value = true
    phaseEndAtMs = Date.now() + breakSecs * 1000
    startTicking()
  } else {
    phase.value = 'focus'
    focusStartedAt.value = null
    phaseEndAtMs = null
    const focusSecs = settings.value.focusDuration * 60
    remaining.value = focusSecs
    totalDuration.value = focusSecs
    activeTaskId.value = null
    activeTaskTitle.value = null
  }
}

export function useTimer() {
  const { settings } = useSettings()

  const progress = computed(() => {
    return 1 - remaining.value / totalDuration.value
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
    focusStartedAt.value = Date.now()
    const focusSecs = settings.value.focusDuration * 60
    remaining.value = focusSecs
    totalDuration.value = focusSecs
    phaseEndAtMs = Date.now() + focusSecs * 1000
    resume()
  }

  function resume() {
    if (running.value) return
    running.value = true
    phaseEndAtMs = Date.now() + remaining.value * 1000
    startTicking()
  }

  function pause() {
    if (!running.value) return
    syncRemainingFromEndAt()
    running.value = false
    clearInterval(intervalId!)
    intervalId = null
    phaseEndAtMs = null
  }

  function skipToBreak() {
    pause()
    phase.value = 'break'
    focusStartedAt.value = null
    const breakSecs = settings.value.breakDuration * 60
    remaining.value = breakSecs
    totalDuration.value = breakSecs
    phaseEndAtMs = Date.now() + breakSecs * 1000
    resume()
  }

  function skipBreak() {
    pause()
    phase.value = 'focus'
    focusStartedAt.value = null
    phaseEndAtMs = null
    const focusSecs = settings.value.focusDuration * 60
    remaining.value = focusSecs
    totalDuration.value = focusSecs
    activeTaskId.value = null
    activeTaskTitle.value = null
  }

  function abandon() {
    pause()
    phase.value = 'focus'
    focusStartedAt.value = null
    phaseEndAtMs = null
    const focusSecs = settings.value.focusDuration * 60
    remaining.value = focusSecs
    totalDuration.value = focusSecs
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
    totalDuration,
    running,
    activeTaskId,
    activeTaskTitle,
    focusStartedAt,
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

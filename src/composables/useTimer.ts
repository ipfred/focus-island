import { ref, computed, watch } from 'vue'
import { useSettings } from './useSettings'

export type TimerPhase = 'focus' | 'break'
export type NotificationType = 'focus-done' | 'break-done' | null

const phase = ref<TimerPhase>('focus')
const remaining = ref(25 * 60)
const totalDuration = ref(25 * 60)
const running = ref(false)
const activeTaskId = ref<string | null>(null)
const activeTaskTitle = ref<string | null>(null)
const focusStartedAt = ref<number | null>(null)
const pendingNotification = ref<NotificationType>(null)
const activeSubtaskId = ref<string | null>(null)
const activeSubtaskTitle = ref<string | null>(null)
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
  onDoneCallbacks.forEach(cb => cb(phase.value, activeTaskId.value))
  // Don't auto-transition; set pendingNotification and wait for user action
  pendingNotification.value = phase.value === 'focus' ? 'focus-done' : 'break-done'
}

export function useTimer() {
  const { settings } = useSettings()

  const progress = computed(() => {
    return 1 - remaining.value / totalDuration.value
  })

  watch(
    () => [settings.value.focusDuration, settings.value.breakDuration],
    ([newFocus, newBreak]) => {
      if (!running.value) return
      const newDuration = phase.value === 'focus' ? newFocus * 60 : newBreak * 60
      if (totalDuration.value !== newDuration) {
        const ratio = remaining.value / totalDuration.value
        totalDuration.value = newDuration
        remaining.value = Math.round(newDuration * ratio)
        if (phaseEndAtMs !== null) {
          phaseEndAtMs = Date.now() + remaining.value * 1000
        }
      }
    },
  )

  const displayTime = computed(() => {
    const m = Math.floor(remaining.value / 60).toString().padStart(2, '0')
    const s = (remaining.value % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  })

  function setSubtaskContext(subtaskId: string | null, subtaskTitle: string | null) {
    activeSubtaskId.value = subtaskId
    activeSubtaskTitle.value = subtaskTitle
  }

  function start(taskId: string, taskTitle?: string) {
    activeSubtaskId.value = null
    activeSubtaskTitle.value = null
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

  /** User chose "休息" (after focus) or "继续" (after break) */
  function confirmNotification() {
    const notif = pendingNotification.value
    if (!notif) return
    pendingNotification.value = null
    if (notif === 'focus-done') {
      // Transition to break
      phase.value = 'break'
      focusStartedAt.value = null
      const breakSecs = settings.value.breakDuration * 60
      remaining.value = breakSecs
      totalDuration.value = breakSecs
      running.value = true
      phaseEndAtMs = Date.now() + breakSecs * 1000
      startTicking()
    } else {
      // break-done → start new focus (resume not auto-started, clear task)
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

  /** User chose "退出" — return to idle */
  function dismissNotification() {
    pendingNotification.value = null
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
    pendingNotification,
    activeSubtaskId,
    activeSubtaskTitle,
    progress,
    displayTime,
    start,
    resume,
    pause,
    skipToBreak,
    skipBreak,
    abandon,
    confirmNotification,
    dismissNotification,
    onPhaseDoneCallback,
    setSubtaskContext,
  }
}

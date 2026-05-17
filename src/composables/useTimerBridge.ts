/**
 * useTimerBridge — panel 窗口专用
 * 计时器逻辑在此运行，关键状态变化时广播状态到灵动岛窗口
 */
import { emit, listen } from '@tauri-apps/api/event'
import { watch } from 'vue'
import { useTimer, type TimerPhase, type NotificationType } from './useTimer'
import { useTasks } from './useTasks'
import { useDailyStats } from './useDailyStats'
import { useAchievements } from './useAchievements'
import { useSettings } from './useSettings'

export interface TimerStatePayload {
  phase: TimerPhase
  remaining: number
  totalDuration: number
  running: boolean
  activeTaskId: string | null
  activeTaskTitle: string | null
  syncedAt: number
}

let bridgeStarted = false

export function useTimerBridge() {
  const timer = useTimer()
  const { tasks, incrementPomodoro } = useTasks()
  const { recordPomodoro } = useDailyStats()
  const { recordPomodoro: recordAchievementPomodoro, recordEarlyBird, recordNightOwl } = useAchievements()
  const { settings } = useSettings()
  let lastPayloadKey = ''

  function buildPayload() {
    return {
      phase: timer.phase.value,
      remaining: timer.remaining.value,
      totalDuration: timer.totalDuration.value,
      running: timer.running.value,
      activeTaskId: timer.activeTaskId.value,
      activeTaskTitle:
        timer.activeTaskTitle.value ??
        tasks.value.find(t => t.id === timer.activeTaskId.value)?.title ??
        null,
    }
  }

  function emitTimerState(force = false) {
    const payloadBase = buildPayload()
    const payloadKey = JSON.stringify(payloadBase)
    if (!force && payloadKey === lastPayloadKey) return
    lastPayloadKey = payloadKey
    const payload: TimerStatePayload = { ...payloadBase, syncedAt: Date.now() }
    emit('timer-state-update', payload)
  }

  function emitNotification(type: NotificationType) {
    emit('notification-show', type)
  }

  function startBridge() {
    if (bridgeStarted) return
    bridgeStarted = true

    timer.onPhaseDoneCallback((phase, taskId) => {
      if (phase === 'focus' && taskId) {
        incrementPomodoro(taskId)
        const focusMinutes = settings.value.focusDuration
        recordPomodoro(focusMinutes)
        recordAchievementPomodoro()

        const startHour = timer.focusStartedAt.value === null
          ? null
          : new Date(timer.focusStartedAt.value).getHours()
        if (startHour !== null) {
          if (startHour < 6) {
            recordEarlyBird()
          } else if (startHour >= 23) {
            recordNightOwl()
          }
        }
      }
    })

    // Broadcast notification state to island when pendingNotification changes
    watch(
      () => timer.pendingNotification.value,
      (notif) => {
        emitNotification(notif)
        // Also emit timer state so island gets the stopped state
        emitTimerState(true)
      },
    )

    // Listen for notification actions from the island window
    listen<string>('notification-action', ({ payload }) => {
      if (payload === 'confirm') {
        timer.confirmNotification()
      } else if (payload === 'dismiss') {
        timer.dismissNotification()
      }
    }).catch(() => {})

    // 即时同步关键状态（开始/暂停/跳过/任务切换/阶段切换）
    watch(
      () => [
        timer.phase.value,
        timer.running.value,
        timer.totalDuration.value,
        timer.activeTaskId.value,
        timer.activeTaskTitle.value,
      ],
      () => emitTimerState(),
      { immediate: true },
    )

    // 任务标题被编辑时（activeTaskTitle 为空、依赖 tasks 回退）也要同步到灵动岛。
    watch(
      () => tasks.value.find(t => t.id === timer.activeTaskId.value)?.title ?? null,
      () => emitTimerState(),
    )

    // 灵动岛窗口重启/晚启动时，允许主动请求一次当前快照。
    listen('timer-state-request', () => {
      emitTimerState(true)
      // Also resend notification state if pending
      if (timer.pendingNotification.value) {
        emitNotification(timer.pendingNotification.value)
      }
    }).catch(() => {})
  }

  return { ...timer, startBridge }
}

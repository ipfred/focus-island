/**
 * useTimerBridge — panel 窗口专用
 * 计时器逻辑在此运行，每秒通过 Tauri 事件广播状态到灵动岛窗口
 */
import { emit } from '@tauri-apps/api/event'
import { useTimer, type TimerPhase } from './useTimer'
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
}

let bridgeStarted = false

export function useTimerBridge() {
  const timer = useTimer()
  const { tasks, incrementPomodoro } = useTasks()
  const { recordPomodoro } = useDailyStats()
  const { recordPomodoro: recordAchievementPomodoro, recordEarlyBird, recordNightOwl } = useAchievements()
  const { settings } = useSettings()

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

    // 每 500ms 广播一次状态（比 tick 更频繁，保证灵动岛不滞后超过 1 秒）
    setInterval(() => {
      const payload: TimerStatePayload = {
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
      emit('timer-state-update', payload)
    }, 500)
  }

  return { ...timer, startBridge }
}

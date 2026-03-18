/**
 * useTimerBridge — panel 窗口专用
 * 计时器逻辑在此运行，每秒通过 Tauri 事件广播状态到灵动岛窗口
 */
import { emit } from '@tauri-apps/api/event'
import { useTimer, type TimerPhase } from './useTimer'

export interface TimerStatePayload {
  phase: TimerPhase
  remaining: number
  running: boolean
  activeTaskId: string | null
}

let bridgeStarted = false

export function useTimerBridge() {
  const timer = useTimer()

  function startBridge() {
    if (bridgeStarted) return
    bridgeStarted = true

    // 每 500ms 广播一次状态（比 tick 更频繁，保证灵动岛不滞后超过 1 秒）
    setInterval(() => {
      const payload: TimerStatePayload = {
        phase: timer.phase.value,
        remaining: timer.remaining.value,
        running: timer.running.value,
        activeTaskId: timer.activeTaskId.value,
      }
      emit('timer-state-update', payload)
    }, 500)
  }

  return { ...timer, startBridge }
}

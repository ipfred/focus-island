import { ref, computed } from 'vue'
import { createPersistedStore } from './persistence'

export interface DailyStat {
  date: string        // "2026-04-18"
  pomodoros: number   // 当日番茄数
  focusMinutes: number // 当日专注分钟
  tasksCompleted: number // 当日完成任务数
}

const dailyStats = ref<DailyStat[]>([])

const store = createPersistedStore({
  file: 'daily-stats.json',
  snapshot: () => dailyStats.value,
  restore: (data) => {
    if (!Array.isArray(data)) throw new Error('daily-stats.json is not an array')
    dailyStats.value = data as DailyStat[]
  },
})

function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}

function getStatByDate(date: string): DailyStat | undefined {
  return dailyStats.value.find(s => s.date === date)
}

export function useDailyStats() {
  void store.ensureLoaded()

  function recordPomodoro(focusMinutes: number) {
    const today = getDateString()
    let stat = getStatByDate(today)
    if (!stat) {
      stat = { date: today, pomodoros: 0, focusMinutes: 0, tasksCompleted: 0 }
      dailyStats.value.push(stat)
    }
    stat.pomodoros++
    stat.focusMinutes += focusMinutes
  }

  function recordTaskCompleted() {
    const today = getDateString()
    let stat = getStatByDate(today)
    if (!stat) {
      stat = { date: today, pomodoros: 0, focusMinutes: 0, tasksCompleted: 0 }
      dailyStats.value.push(stat)
    }
    stat.tasksCompleted++
  }

  function getStatsInRange(startDate: Date, endDate: Date): DailyStat[] {
    const start = getDateString(startDate)
    const end = getDateString(endDate)
    return dailyStats.value.filter(s => s.date >= start && s.date <= end)
  }

  function getMonthStats(year: number, month: number): DailyStat[] {
    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 0)
    return getStatsInRange(start, end)
  }

  const todayStat = computed(() => {
    const today = getDateString()
    return getStatByDate(today) ?? { date: today, pomodoros: 0, focusMinutes: 0, tasksCompleted: 0 }
  })

  const weekStats = computed(() => {
    const now = new Date()
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay())
    weekStart.setHours(0, 0, 0, 0)
    return getStatsInRange(weekStart, now)
  })

  const monthStats = computed(() => {
    const now = new Date()
    return getMonthStats(now.getFullYear(), now.getMonth())
  })

  const allTimeStats = computed(() => {
    const total = { pomodoros: 0, focusMinutes: 0, tasksCompleted: 0 }
    for (const stat of dailyStats.value) {
      total.pomodoros += stat.pomodoros
      total.focusMinutes += stat.focusMinutes
      total.tasksCompleted += stat.tasksCompleted
    }
    return total
  })

  function summarizeStats(stats: DailyStat[]) {
    return stats.reduce(
      (acc, s) => ({
        pomodoros: acc.pomodoros + s.pomodoros,
        focusMinutes: acc.focusMinutes + s.focusMinutes,
        tasksCompleted: acc.tasksCompleted + s.tasksCompleted,
      }),
      { pomodoros: 0, focusMinutes: 0, tasksCompleted: 0 }
    )
  }

  return {
    dailyStats,
    todayStat,
    weekStats,
    monthStats,
    allTimeStats,
    recordPomodoro,
    recordTaskCompleted,
    getStatsInRange,
    getMonthStats,
    summarizeStats,
    getDateString,
  }
}

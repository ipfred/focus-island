<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDailyStats } from '../composables/useDailyStats'
import { useAchievements } from '../composables/useAchievements'
import { useTasks } from '../composables/useTasks'

type TimeRange = 'today' | 'week' | 'month' | 'all'

const emit = defineEmits<{ back: [] }>()

const { todayStat, weekStats, monthStats, allTimeStats, summarizeStats, getDateString, getMonthStats } = useDailyStats()
const { starAchievements, streakAchievements, specialAchievements, state } = useAchievements()
const { tasks } = useTasks()

const timeRange = ref<TimeRange>('today')
const currentMonth = ref(new Date())

const timeRangeOptions: { value: TimeRange; label: string }[] = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
  { value: 'all', label: '全部' },
]

const currentStats = computed(() => {
  switch (timeRange.value) {
    case 'today':
      return todayStat.value
    case 'week':
      return summarizeStats(weekStats.value)
    case 'month':
      return summarizeStats(monthStats.value)
    case 'all':
      return allTimeStats.value
  }
})

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes}分钟`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}.${Math.round(mins / 6)}h` : `${hours}h`
}

const monthYear = computed(() => {
  const d = currentMonth.value
  return `${d.getFullYear()}年${d.getMonth() + 1}月`
})

const prevMonth = () => {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() - 1, 1)
}

const nextMonth = () => {
  currentMonth.value = new Date(currentMonth.value.getFullYear(), currentMonth.value.getMonth() + 1, 1)
}

const selectedMonthStats = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  return getMonthStats(year, month)
})

const calendarDays = computed(() => {
  const year = currentMonth.value.getFullYear()
  const month = currentMonth.value.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startPadding = firstDay.getDay()
  const daysInMonth = lastDay.getDate()

  const days: { date: string; day: number; intensity: number; pomodoros: number }[] = []

  const monthStatsMap = new Map(selectedMonthStats.value.map(s => [s.date, s]))

  for (let i = 0; i < startPadding; i++) {
    days.push({ date: '', day: 0, intensity: 0, pomodoros: 0 })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const stat = monthStatsMap.get(dateStr)
    const pomodoros = stat?.pomodoros ?? 0
    let intensity = 0
    if (pomodoros >= 5) intensity = 3
    else if (pomodoros >= 3) intensity = 2
    else if (pomodoros >= 1) intensity = 1
    days.push({ date: dateStr, day: d, intensity, pomodoros })
  }

  return days
})

const weekDays = ['日', '一', '二', '三', '四', '五', '六']

const hoveredIndex = ref<number | null>(null)

const taskDistribution = computed(() => {
  const active = tasks.value.filter(t => !t.completed)
  const today = active.filter(t => t.category === 'today').length
  const tomorrow = active.filter(t => t.category === 'tomorrow').length
  const week = active.filter(t => t.category === 'week').length
  const total = today + tomorrow + week || 1
  return [
    { label: '今日', value: today, percent: Math.round((today / total) * 100) },
    { label: '明日', value: tomorrow, percent: Math.round((tomorrow / total) * 100) },
    { label: '本周', value: week, percent: Math.round((week / total) * 100) },
  ]
})

const weekTrend = computed(() => {
  const now = new Date()
  const result: { day: string; pomodoros: number; minutes: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dateStr = getDateString(d)
    const stats = weekStats.value.find(s => s.date === dateStr)
    result.push({
      day: weekDays[d.getDay()],
      pomodoros: stats?.pomodoros ?? 0,
      minutes: stats?.focusMinutes ?? 0,
    })
  }
  return result
})

const maxPomodoros = computed(() => Math.max(...weekTrend.value.map(d => d.pomodoros), 1))
</script>

<template>
  <div class="stats-page">
    <!-- Header -->
    <div class="page-header">
      <button class="back-btn" @click="emit('back')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <h2 class="page-title">统计</h2>
      <div class="time-range-tabs">
        <button
          v-for="opt in timeRangeOptions"
          :key="opt.value"
          :class="['tab', { active: timeRange === opt.value }]"
          @click="timeRange = opt.value"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Stats Cards -->
    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-value">{{ currentStats.pomodoros }}</div>
        <div class="stat-label">番茄</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ formatDuration(currentStats.focusMinutes) }}</div>
        <div class="stat-label">专注时长</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ currentStats.tasksCompleted }}</div>
        <div class="stat-label">完成任务</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ state.streakDays }}</div>
        <div class="stat-label">连续天数</div>
      </div>
    </div>

    <!-- Heatmap -->
    <div class="section">
      <div class="section-header">
        <span class="section-title">专注热力图 · {{ monthYear }}</span>
        <div class="month-nav">
          <button class="nav-btn" @click="prevMonth">&lt;</button>
          <button class="nav-btn" @click="nextMonth">&gt;</button>
        </div>
      </div>
      <div class="heatmap">
        <div class="heatmap-weekdays">
          <span v-for="d in weekDays" :key="d" class="weekday">{{ d }}</span>
        </div>
        <div class="heatmap-grid">
          <div
            v-for="(day, i) in calendarDays"
            :key="i"
            :class="['heat-cell', `intensity-${day.intensity}`, { empty: !day.day }]"
            @mouseenter="hoveredIndex = day.day ? i : null"
            @mouseleave="hoveredIndex = null"
          >
            <span v-if="day.day" class="day-number">{{ day.day }}</span>
            <div v-if="hoveredIndex === i && day.pomodoros > 0" class="cell-tooltip">
              {{ day.pomodoros }}🍅
            </div>
          </div>
        </div>
      </div>
      <div class="heatmap-legend">
        <span class="legend-item"><span class="legend-box intensity-0"></span>无</span>
        <span class="legend-item"><span class="legend-box intensity-1"></span>1-2</span>
        <span class="legend-item"><span class="legend-box intensity-2"></span>3-5</span>
        <span class="legend-item"><span class="legend-box intensity-3"></span>5+</span>
      </div>
    </div>

    <!-- Charts Row -->
    <div class="charts-row">
      <!-- Week Trend -->
      <div class="section chart-section">
        <div class="section-title">本周趋势</div>
        <div class="trend-chart">
          <div class="trend-bars">
            <div
              v-for="d in weekTrend"
              :key="d.day"
              class="trend-bar-wrapper"
            >
              <div
                class="trend-bar"
                :style="{ height: `${(d.pomodoros / maxPomodoros) * 100}%` }"
              >
                <span v-if="d.pomodoros > 0" class="bar-value">{{ d.pomodoros }}</span>
              </div>
              <span class="bar-label">{{ d.day }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Task Distribution -->
      <div class="section chart-section">
        <div class="section-title">任务分布</div>
        <div class="distribution">
          <div v-for="item in taskDistribution" :key="item.label" class="dist-item">
            <div class="dist-label">
              <span>{{ item.label }}</span>
              <span class="dist-percent">{{ item.percent }}%</span>
            </div>
            <div class="dist-bar-bg">
              <div class="dist-bar" :style="{ width: `${item.percent}%` }"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Achievements -->
    <div class="section">
      <div class="section-title">成就里程碑</div>

      <div class="achievement-group">
        <div class="achievement-row">
          <div
            v-for="a in starAchievements"
            :key="a.id"
            :class="['achievement-badge', { unlocked: a.unlockedAt }]"
          >
            <div class="badge-icon">{{ a.icon }}</div>
            <div class="badge-name">{{ a.name }}</div>
            <div class="badge-progress">
              <template v-if="a.unlockedAt">已达成</template>
              <template v-else>{{ a.progress }}/{{ a.target }}</template>
            </div>
          </div>
        </div>
      </div>

      <div class="achievement-group">
        <div class="achievement-row">
          <div
            v-for="a in streakAchievements"
            :key="a.id"
            :class="['achievement-badge', { unlocked: a.unlockedAt }]"
          >
            <div class="badge-icon">{{ a.icon }}</div>
            <div class="badge-name">{{ a.name }}</div>
            <div class="badge-progress">
              <template v-if="a.unlockedAt">已达成</template>
              <template v-else>{{ a.progress }}/{{ a.target }}</template>
            </div>
          </div>
        </div>
      </div>

      <div class="achievement-group special">
        <div class="achievement-row">
          <div
            v-for="a in specialAchievements"
            :key="a.id"
            :class="['achievement-badge', { unlocked: a.unlockedAt }]"
          >
            <div class="badge-icon">{{ a.icon }}</div>
            <div class="badge-name">{{ a.name }}</div>
            <div class="badge-progress">
              <template v-if="a.unlockedAt">已达成</template>
              <template v-else>未解锁</template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "../styles.css";

.stats-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 0 4px;
  overflow-y: auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.back-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 0.2s;
}

.back-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.back-btn svg {
  width: 18px;
  height: 18px;
}

.page-title {
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  flex: 1;
}

.time-range-tabs {
  display: flex;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 2px;
}

.tab {
  padding: 6px 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
  background: transparent;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.tab:hover {
  color: rgba(255, 255, 255, 0.7);
}

.tab.active {
  background: var(--focus-color);
  color: #fff;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.stat-card {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 12px;
  padding: 14px 10px;
  text-align: center;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #fff;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.45);
}

.section {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 14px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-size: 13px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.8);
}

.month-nav {
  display: flex;
  gap: 4px;
}

.nav-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.heatmap {
  position: relative;
}

.heatmap-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
  margin-bottom: 4px;
}

.weekday {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  text-align: center;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 3px;
}

.heat-cell {
  aspect-ratio: 1;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  position: relative;
  transition: all 0.15s;
}

.heat-cell.empty {
  background: transparent;
}

.heat-cell:not(.empty):hover {
  transform: scale(1.15);
  z-index: 1;
}

.heat-cell.intensity-0 {
  background: rgba(255, 255, 255, 0.03);
}

.heat-cell.intensity-1 {
  background: color-mix(in srgb, var(--focus-color) 25%, transparent);
}

.heat-cell.intensity-2 {
  background: color-mix(in srgb, var(--focus-color) 55%, transparent);
}

.heat-cell.intensity-3 {
  background: var(--focus-color);
}

.day-number {
  font-size: 9px;
  color: rgba(255, 255, 255, 0.4);
}

.heat-cell.intensity-3 .day-number {
  color: rgba(255, 255, 255, 0.9);
}

.cell-tooltip {
  position: absolute;
  bottom: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 30, 35, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  padding: 3px 6px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.9);
  white-space: nowrap;
  z-index: 10;
  pointer-events: none;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  justify-content: flex-end;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
}

.legend-box {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

.legend-box.intensity-0 {
  background: rgba(255, 255, 255, 0.03);
}

.legend-box.intensity-1 {
  background: color-mix(in srgb, var(--focus-color) 25%, transparent);
}

.legend-box.intensity-2 {
  background: color-mix(in srgb, var(--focus-color) 55%, transparent);
}

.legend-box.intensity-3 {
  background: var(--focus-color);
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.chart-section {
  min-height: 140px;
}

.trend-chart {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.trend-bars {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  height: 90px;
  gap: 6px;
  padding-top: 8px;
}

.trend-bar-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
}

.trend-bar {
  width: 100%;
  max-width: 24px;
  background: var(--focus-color);
  border-radius: 4px 4px 2px 2px;
  margin-top: auto;
  position: relative;
  min-height: 4px;
  transition: height 0.3s ease;
}

.bar-value {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 10px;
  color: rgba(255, 255, 255, 0.6);
}

.bar-label {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  margin-top: 6px;
}

.distribution {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.dist-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dist-label {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.6);
}

.dist-percent {
  color: rgba(255, 255, 255, 0.4);
}

.dist-bar-bg {
  height: 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 3px;
  overflow: hidden;
}

.dist-bar {
  height: 100%;
  background: var(--focus-color);
  border-radius: 3px;
  transition: width 0.3s ease;
}

.achievement-group {
  margin-bottom: 12px;
}

.achievement-group:last-child {
  margin-bottom: 0;
}

.achievement-group.special .achievement-row {
  justify-content: flex-start;
  gap: 16px;
}

.achievement-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.achievement-badge {
  flex: 1;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  padding: 10px 8px;
  text-align: center;
  transition: all 0.2s;
}

.achievement-badge.unlocked {
  background: color-mix(in srgb, var(--focus-color) 12%, transparent);
  border-color: color-mix(in srgb, var(--focus-color) 30%, transparent);
}

.badge-icon {
  font-size: 16px;
  margin-bottom: 4px;
  filter: grayscale(1) opacity(0.4);
}

.achievement-badge.unlocked .badge-icon {
  filter: none;
  color: var(--focus-color);
}

.badge-name {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.4);
  margin-bottom: 2px;
}

.achievement-badge.unlocked .badge-name {
  color: rgba(255, 255, 255, 0.9);
}

.badge-progress {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.25);
}

.achievement-badge.unlocked .badge-progress {
  color: var(--focus-color);
}
</style>

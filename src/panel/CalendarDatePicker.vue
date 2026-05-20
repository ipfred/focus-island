<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string | null | undefined
    clearable?: boolean
  }>(),
  {
    clearable: true,
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
  'close': []
}>()

// Current viewing year and month in the calendar panel
const currentYear = ref(new Date().getFullYear())
const currentMonth = ref(new Date().getMonth()) // 0-indexed

// Initialize month/year from modelValue if it exists
onMounted(() => {
  if (props.modelValue) {
    const parts = props.modelValue.split('-').map(Number)
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      currentYear.value = parts[0]
      currentMonth.value = parts[1] - 1
    }
  }
})

// Format helper
function formatDateStr(y: number, m: number, d: number): string {
  const mm = String(m).padStart(2, '0')
  const dd = String(d).padStart(2, '0')
  return `${y}-${mm}-${dd}`
}

// Helper to get offset date string (YYYY-MM-DD)
function getOffsetDateStr(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return formatDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate())
}

// Compute active status of quick selection chips
const activeOffset = computed<number>(() => {
  if (!props.modelValue) return -999
  const todayStr = getOffsetDateStr(0)
  const tomorrowStr = getOffsetDateStr(1)
  const dayAfterStr = getOffsetDateStr(2)
  const nextWeekStr = getOffsetDateStr(7)

  if (props.modelValue === todayStr) return 0
  if (props.modelValue === tomorrowStr) return 1
  if (props.modelValue === dayAfterStr) return 2
  if (props.modelValue === nextWeekStr) return 7
  return -1 // Custom date selected
})

// Quick selection handlers
function setQuickDate(offset: number) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const dateStr = formatDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate())
  emit('update:modelValue', dateStr)
  emit('close')
}

function setNextWeek() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  const dateStr = formatDateStr(d.getFullYear(), d.getMonth() + 1, d.getDate())
  emit('update:modelValue', dateStr)
  emit('close')
}

function clearDate() {
  emit('update:modelValue', null)
  emit('close')
}

// Month navigation
function prevMonth() {
  if (currentMonth.value === 0) {
    currentMonth.value = 11
    currentYear.value -= 1
  } else {
    currentMonth.value -= 1
  }
}

function nextMonth() {
  if (currentMonth.value === 11) {
    currentMonth.value = 0
    currentYear.value += 1
  } else {
    currentMonth.value += 1
  }
}

// Generate calendar cells (6 weeks grid = 42 cells)
interface CalendarCell {
  dateStr: string
  dayNum: number
  isCurrentMonth: boolean
  isToday: boolean
  isSelected: boolean
}

const calendarDays = computed<CalendarCell[]>(() => {
  const year = currentYear.value
  const month = currentMonth.value

  const today = new Date()
  const todayStr = formatDateStr(today.getFullYear(), today.getMonth() + 1, today.getDate())

  // First day of current month
  const firstDay = new Date(year, month, 1)
  const firstDayOfWeek = firstDay.getDay() // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // Monday first week calculation
  // Sun(0)->6, Mon(1)->0, Tue(2)->1, Wed(3)->2, Thu(4)->3, Fri(5)->4, Sat(6)->5
  const paddingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const cells: CalendarCell[] = []

  // 1. Previous month padding days
  const prevYear = month === 0 ? year - 1 : year
  const prevMonthVal = month === 0 ? 12 : month
  for (let i = paddingDays - 1; i >= 0; i--) {
    const d = prevMonthDays - i
    const dateStr = formatDateStr(prevYear, prevMonthVal, d)
    cells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isSelected: dateStr === props.modelValue,
    })
  }

  // 2. Current month days
  const currMonthVal = month + 1
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDateStr(year, currMonthVal, d)
    cells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: true,
      isToday: dateStr === todayStr,
      isSelected: dateStr === props.modelValue,
    })
  }

  // 3. Next month leading days (to fill 42 cells)
  const nextYear = month === 11 ? year + 1 : year
  const nextMonthVal = month === 11 ? 1 : month + 2
  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    const dateStr = formatDateStr(nextYear, nextMonthVal, d)
    cells.push({
      dateStr,
      dayNum: d,
      isCurrentMonth: false,
      isToday: dateStr === todayStr,
      isSelected: dateStr === props.modelValue,
    })
  }

  return cells
})

function selectCell(cell: CalendarCell) {
  emit('update:modelValue', cell.dateStr)
  emit('close')
}
</script>

<template>
  <div class="calendar-picker" @click.stop>
    <!-- Quick selectors on top -->
    <div class="quick-chips">
      <button
        class="quick-chip"
        :class="{ 'is-active': activeOffset === 0 }"
        @click="setQuickDate(0)"
        title="今天"
      >
        今天
      </button>
      <button
        class="quick-chip"
        :class="{ 'is-active': activeOffset === 1 }"
        @click="setQuickDate(1)"
        title="明天"
      >
        明天
      </button>
      <button
        class="quick-chip"
        :class="{ 'is-active': activeOffset === 2 }"
        @click="setQuickDate(2)"
        title="后天"
      >
        后天
      </button>
      <button
        class="quick-chip"
        :class="{ 'is-active': activeOffset === 7 }"
        @click="setNextWeek()"
        title="下周"
      >
        下周
      </button>
      <button
        v-if="clearable"
        class="quick-chip clear-chip"
        :class="{ 'is-active': activeOffset === -999 }"
        @click="clearDate()"
        title="清除日期"
      >
        清除
      </button>
    </div>

    <div class="divider"></div>

    <!-- Month navigation -->
    <div class="month-header">
      <button class="nav-btn" @click="prevMonth" title="上个月">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <span class="month-title">{{ currentYear }}年 {{ currentMonth + 1 }}月</span>

      <button class="nav-btn" @click="nextMonth" title="下个月">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>

    <!-- Weekday headers -->
    <div class="weekdays-grid">
      <span>一</span>
      <span>二</span>
      <span>三</span>
      <span>四</span>
      <span>五</span>
      <span class="weekend">六</span>
      <span class="weekend">日</span>
    </div>

    <!-- 42 Days grid -->
    <div class="days-grid">
      <button
        v-for="(cell, idx) in calendarDays"
        :key="idx"
        class="day-cell"
        :class="{
          'other-month': !cell.isCurrentMonth,
          'is-today': cell.isToday,
          'is-selected': cell.isSelected
        }"
        @click="selectCell(cell)"
      >
        <span class="day-num">{{ cell.dayNum }}</span>
        <span v-if="cell.isToday && !cell.isSelected" class="today-dot"></span>
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference "../styles.css";

.calendar-picker {
  width: 250px;
  padding: 10px;
  background: transparent;
  color: #fff;
  font-family: system-ui, -apple-system, sans-serif;
  user-select: none;
}

/* Quick selections styling */
.quick-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
  justify-content: flex-start;
}

.quick-chip {
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 11px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 500;
}

.quick-chip:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.2);
  color: #fff;
  transform: translateY(-1px);
}

.quick-chip:active {
  transform: translateY(0);
}

/* Selected state for quick select chips */
.quick-chip.is-active {
  background: var(--focus-color, #e85d3a) !important;
  border-color: var(--focus-color, #e85d3a) !important;
  color: #fff !important;
  box-shadow: 0 2px 8px color-mix(in srgb, var(--focus-color, #e85d3a) 25%, transparent);
  transform: translateY(-1px);
}

.clear-chip {
  background: color-mix(in srgb, var(--focus-color, #e85d3a) 8%, transparent);
  border-color: color-mix(in srgb, var(--focus-color, #e85d3a) 18%, transparent);
  color: color-mix(in srgb, var(--focus-color, #e85d3a) 85%, #fff);
}

.clear-chip:hover {
  background: color-mix(in srgb, var(--focus-color, #e85d3a) 18%, transparent);
  border-color: color-mix(in srgb, var(--focus-color, #e85d3a) 35%, transparent);
  color: #fff;
}

.clear-chip.is-active {
  background: color-mix(in srgb, var(--focus-color, #e85d3a) 20%, transparent) !important;
  border-color: color-mix(in srgb, var(--focus-color, #e85d3a) 40%, transparent) !important;
  color: color-mix(in srgb, var(--focus-color, #e85d3a) 85%, #fff) !important;
  box-shadow: none;
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.06);
  margin: 8px 0;
}

/* Month navigation header */
.month-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 0 4px;
}

.month-title {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  letter-spacing: 0.5px;
}

.nav-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.6);
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
}

/* Weekday header grid */
.weekdays-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.35);
}

.weekdays-grid span {
  padding: 4px 0;
}

.weekdays-grid .weekend {
  color: rgba(255, 255, 255, 0.25);
}

/* Calendar Days Grid */
.days-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 3px;
  column-gap: 3px;
}

.day-cell {
  position: relative;
  height: 30px;
  width: 30px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
}

.day-cell:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  transform: scale(1.08);
}

.day-cell:active {
  transform: scale(0.95);
}

.day-cell.other-month {
  color: rgba(255, 255, 255, 0.25);
}

.day-cell.other-month:hover {
  color: rgba(255, 255, 255, 0.6);
}

/* Today style */
.day-cell.is-today {
  border: 1px dashed color-mix(in srgb, var(--focus-color, #e85d3a) 45%, transparent);
  background: color-mix(in srgb, var(--focus-color, #e85d3a) 4%, transparent);
}

.today-dot {
  position: absolute;
  bottom: 3px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: var(--focus-color, #e85d3a);
}

/* Selected style */
.day-cell.is-selected {
  background: var(--focus-color, #e85d3a) !important;
  color: #fff !important;
  font-weight: bold;
  box-shadow: 0 4px 12px color-mix(in srgb, var(--focus-color, #e85d3a) 35%, transparent);
  transform: scale(1.05);
}

.day-cell.is-selected .today-dot {
  background: #fff;
}
</style>

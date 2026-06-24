import { ref, watch, computed } from 'vue'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'

export interface Achievement {
  id: string
  name: string
  icon: string
  description: string
  target: number
  progress: number
  unlockedAt: number | null
}

interface AchievementState {
  streakDays: number
  lastFocusDate: string | null
  totalPomodoros: number
  earlyBirdCount: number
  nightOwlCount: number
}

const ACHIEVEMENTS_FILE = 'focus-island/achievements.json'

const defaultAchievements: Achievement[] = [
  { id: 'star-1', name: '启明星', icon: '★', description: '累计10个番茄', target: 10, progress: 0, unlockedAt: null },
  { id: 'star-2', name: '晨曦星', icon: '★★', description: '累计50个番茄', target: 50, progress: 0, unlockedAt: null },
  { id: 'star-3', name: '璀璨星', icon: '★★★', description: '累计200个番茄', target: 200, progress: 0, unlockedAt: null },
  { id: 'streak-1', name: '初燃', icon: '⚡', description: '连续专注3天', target: 3, progress: 0, unlockedAt: null },
  { id: 'streak-2', name: '持续', icon: '⚡⚡', description: '连续专注7天', target: 7, progress: 0, unlockedAt: null },
  { id: 'streak-3', name: '燎原', icon: '⚡⚡⚡', description: '连续专注30天', target: 30, progress: 0, unlockedAt: null },
  { id: 'early-bird', name: '晨光者', icon: '☀', description: '6点前开始专注', target: 1, progress: 0, unlockedAt: null },
  { id: 'night-owl', name: '守夜人', icon: '☽', description: '23点后还在专注', target: 1, progress: 0, unlockedAt: null },
]

const achievements = ref<Achievement[]>(JSON.parse(JSON.stringify(defaultAchievements)))
const state = ref<AchievementState>({
  streakDays: 0,
  lastFocusDate: null,
  totalPomodoros: 0,
  earlyBirdCount: 0,
  nightOwlCount: 0,
})
const loaded = ref(false)
let loadPromise: Promise<void> | null = null

async function load() {
  try {
    const raw = await readTextFile(ACHIEVEMENTS_FILE, { baseDir: BaseDirectory.AppData })
    const parsed = JSON.parse(raw)
    if (parsed.achievements) {
      achievements.value = defaultAchievements.map(def => {
        const saved = parsed.achievements.find((a: Achievement) => a.id === def.id)
        return saved ? { ...def, ...saved } : def
      })
    }
    if (parsed.state) {
      state.value = { ...state.value, ...parsed.state }
    }
  } catch {
    achievements.value = JSON.parse(JSON.stringify(defaultAchievements))
  }
  loaded.value = true
}

function ensureLoaded() {
  if (loaded.value || loadPromise) return
  loadPromise = load().finally(() => {
    loadPromise = null
  })
}

async function save() {
  if (!loaded.value) return
  try {
    await mkdir('focus-island', { baseDir: BaseDirectory.AppData, recursive: true })
    await writeTextFile(ACHIEVEMENTS_FILE, JSON.stringify({ achievements: achievements.value, state: state.value }), { baseDir: BaseDirectory.AppData })
  } catch (e) {
    console.error('Failed to save achievements', e)
  }
}

watch([achievements, state], save, { deep: true })

function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0]
}

function unlockAchievement(id: string) {
  const achievement = achievements.value.find(a => a.id === id)
  if (achievement && !achievement.unlockedAt) {
    achievement.unlockedAt = Date.now()
    achievement.progress = achievement.target
  }
}

function updateProgress(id: string, progress: number) {
  const achievement = achievements.value.find(a => a.id === id)
  if (achievement && !achievement.unlockedAt) {
    achievement.progress = Math.min(progress, achievement.target)
    if (achievement.progress >= achievement.target) {
      unlockAchievement(id)
    }
  }
}

export function useAchievements() {
  ensureLoaded()

  function recordPomodoro() {
    state.value.totalPomodoros++
    updateProgress('star-1', state.value.totalPomodoros)
    updateProgress('star-2', state.value.totalPomodoros)
    updateProgress('star-3', state.value.totalPomodoros)

    const today = getDateString()
    if (state.value.lastFocusDate !== today) {
      const yesterday = getDateString(new Date(Date.now() - 86400000))
      if (state.value.lastFocusDate === yesterday) {
        state.value.streakDays++
      } else {
        state.value.streakDays = 1
      }
      state.value.lastFocusDate = today
      updateProgress('streak-1', state.value.streakDays)
      updateProgress('streak-2', state.value.streakDays)
      updateProgress('streak-3', state.value.streakDays)
    }
  }

  function recordEarlyBird() {
    state.value.earlyBirdCount++
    unlockAchievement('early-bird')
  }

  function recordNightOwl() {
    state.value.nightOwlCount++
    unlockAchievement('night-owl')
  }

  const unlockedCount = computed(() => achievements.value.filter(a => a.unlockedAt).length)

  const totalCount = computed(() => achievements.value.length)

  const starAchievements = computed(() => achievements.value.filter(a => a.id.startsWith('star-')))

  const streakAchievements = computed(() => achievements.value.filter(a => a.id.startsWith('streak-')))

  const specialAchievements = computed(() => achievements.value.filter(a => a.id === 'early-bird' || a.id === 'night-owl'))

  return {
    achievements,
    state,
    unlockedCount,
    totalCount,
    starAchievements,
    streakAchievements,
    specialAchievements,
    recordPomodoro,
    recordEarlyBird,
    recordNightOwl,
    getDateString,
  }
}

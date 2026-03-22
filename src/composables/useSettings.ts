import { ref, computed, watch, watchEffect } from 'vue'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { emit } from '@tauri-apps/api/event'

export interface ThemePreset {
  id: string
  name: string
  focusColor: string
  breakColor: string
  idleColor: string
  alertColor: string
}

export interface Settings {
  islandOpacity: number      // 透明度 0~0.7，值越大越透明，CSS alpha = 1 - value
  focusDuration: number
  breakDuration: number
  activeThemeId: string
  idleMottos: string[]       // 空闲时轮播的激励语，空数组则用内置默认
}

export const presetThemes: ThemePreset[] = [
  { id: 'classic', name: '经典橙红', focusColor: '#e85d3a', breakColor: '#3a9e6e', idleColor: '#4a8fd4', alertColor: '#e8a23a' },
  { id: 'ocean', name: '海洋蓝绿', focusColor: '#2d8cf0', breakColor: '#36b37e', idleColor: '#6b8eb2', alertColor: '#f5a623' },
  { id: 'lavender', name: '薰衣草紫', focusColor: '#9b6dff', breakColor: '#4ecdc4', idleColor: '#7c8ba1', alertColor: '#f7b731' },
  { id: 'forest', name: '森林深绿', focusColor: '#27ae60', breakColor: '#3498db', idleColor: '#8e9aaf', alertColor: '#e67e22' },
  { id: 'cyber', name: '赛博朋克', focusColor: '#ff6b9d', breakColor: '#00d2d3', idleColor: '#a29bfe', alertColor: '#feca57' },
]

const SETTINGS_FILE = 'focus-island/settings.json'

const DEFAULT_SETTINGS: Settings = {
  islandOpacity: 0.18,
  focusDuration: 25,
  breakDuration: 5,
  activeThemeId: 'classic',
  idleMottos: [],
}

const settings = ref<Settings>({ ...DEFAULT_SETTINGS })
const loaded = ref(false)
let suppressEmit = false

function applyThemeToDOM() {
  const theme = presetThemes.find(t => t.id === settings.value.activeThemeId) ?? presetThemes[0]
  const root = document.documentElement
  root.style.setProperty('--focus-color', theme.focusColor)
  root.style.setProperty('--break-color', theme.breakColor)
  root.style.setProperty('--idle-color', theme.idleColor)
  root.style.setProperty('--alert-color', theme.alertColor)
  root.style.setProperty('--island-opacity', String(1 - settings.value.islandOpacity))
}

async function load() {
  try {
    const raw = await readTextFile(SETTINGS_FILE, { baseDir: BaseDirectory.AppData })
    const parsed = JSON.parse(raw) as Partial<Settings>
    settings.value = { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    settings.value = { ...DEFAULT_SETTINGS }
  }
  loaded.value = true
}

async function save() {
  if (!loaded.value) return
  try {
    await mkdir('focus-island', { baseDir: BaseDirectory.AppData, recursive: true })
    await writeTextFile(SETTINGS_FILE, JSON.stringify(settings.value), { baseDir: BaseDirectory.AppData })
  } catch (e) {
    console.error('Failed to save settings', e)
  }
}

watch(settings, () => {
  if (!suppressEmit) {
    save()
    emit('settings-changed', settings.value)
  }
  suppressEmit = false
}, { deep: true })

watchEffect(() => {
  if (loaded.value) applyThemeToDOM()
})

const activeTheme = computed(() =>
  presetThemes.find(t => t.id === settings.value.activeThemeId) ?? presetThemes[0]
)

function applyExternalSettings(newSettings: Settings) {
  suppressEmit = true
  settings.value = { ...newSettings }
  loaded.value = true
}

export function useSettings() {
  if (!loaded.value) load()

  return { settings, activeTheme, applyThemeToDOM, applyExternalSettings }
}

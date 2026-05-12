import { ref, computed, watch } from 'vue'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { emit } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'

export interface RadioStation {
  id: string
  name: string
  streamUrl: string
  description: string
}

export interface RadioSettings {
  currentStationId: string | null
  volume: number
}

export const PRESET_STATIONS: RadioStation[] = [
  {
    id: 'coderadio',
    name: 'Code Radio',
    streamUrl: 'https://coderadio-admin-v2.freecodecamp.org/listen/coderadio/radio.mp3',
    description: 'freeCodeCamp 24h 编程音乐电台',
  },
  {
    id: 'local-music',
    name: '本地音乐',
    streamUrl: '__LOCAL__', // 特殊标记，运行时会被替换为实际路径
    description: '离线专注音乐（需要在 assets/audio/ 放置 focus-music.mp3）',
  },
]

const RADIO_FILE = 'focus-island/radio.json'

const DEFAULT_RADIO_SETTINGS: RadioSettings = {
  currentStationId: null,
  volume: 50,
}

const radioSettings = ref<RadioSettings>({ ...DEFAULT_RADIO_SETTINGS })
const playing = ref(false)
const loading = ref(false)
const error = ref<string | null>(null)
const loaded = ref(false)

const currentStation = computed(() =>
  PRESET_STATIONS.find(s => s.id === radioSettings.value.currentStationId) ?? null
)

const volume = computed(() => radioSettings.value.volume)

async function loadSettings() {
  try {
    const raw = await readTextFile(RADIO_FILE, { baseDir: BaseDirectory.AppData })
    const parsed = JSON.parse(raw) as Partial<RadioSettings>
    radioSettings.value = {
      ...DEFAULT_RADIO_SETTINGS,
      ...parsed,
      volume: Math.max(0, Math.min(100, parsed.volume ?? DEFAULT_RADIO_SETTINGS.volume)),
    }
  } catch {
    radioSettings.value = { ...DEFAULT_RADIO_SETTINGS }
  }
  loaded.value = true
}

async function save() {
  if (!loaded.value) return
  try {
    await mkdir('focus-island', { baseDir: BaseDirectory.AppData, recursive: true })
    await writeTextFile(RADIO_FILE, JSON.stringify(radioSettings.value), { baseDir: BaseDirectory.AppData })
  } catch (e) {
    console.error('Failed to save radio settings', e)
  }
}

watch(radioSettings, () => {
  save()
  emit('radio-state-update', {
    playing: playing.value,
    stationId: radioSettings.value.currentStationId,
  })
}, { deep: true })

watch(playing, () => {
  emit('radio-state-update', {
    playing: playing.value,
    stationId: radioSettings.value.currentStationId,
  })
})

async function play(stationId?: string) {
  const id = stationId ?? radioSettings.value.currentStationId
  if (!id) {
    radioSettings.value.currentStationId = PRESET_STATIONS[0]?.id ?? null
    if (!radioSettings.value.currentStationId) return
  } else if (id !== radioSettings.value.currentStationId) {
    radioSettings.value.currentStationId = id
  }
  const station = PRESET_STATIONS.find(s => s.id === radioSettings.value.currentStationId)
  if (!station) return

  loading.value = true
  error.value = null
  try {
    let url = station.streamUrl

    // 如果是本地音乐，获取实际路径
    if (url === '__LOCAL__') {
      try {
        url = await invoke<string>('get_local_audio_path')
      } catch (e) {
        error.value = typeof e === 'string' ? e : '本地音频文件不存在'
        loading.value = false
        return
      }
    }

    await invoke('radio_play', { url })
    playing.value = true
    await invoke('radio_set_volume', { volume: radioSettings.value.volume })
  } catch (e) {
    playing.value = false
    error.value = typeof e === 'string' ? e : '播放失败'
  } finally {
    loading.value = false
  }
}

async function pause() {
  try {
    await invoke('radio_pause')
    playing.value = false
  } catch (e) {
    error.value = typeof e === 'string' ? e : '暂停失败'
  }
}

async function toggle() {
  if (playing.value) {
    await pause()
  } else {
    // If we have a current station, resume; otherwise start fresh
    if (radioSettings.value.currentStationId) {
      try {
        await invoke('radio_resume')
        playing.value = true
      } catch {
        await play()
      }
    } else {
      await play()
    }
  }
}

async function switchStation(id: string) {
  if (id === radioSettings.value.currentStationId && playing.value) return
  await play(id)
}

async function setVolume(v: number) {
  const clamped = Math.max(0, Math.min(100, v))
  radioSettings.value.volume = clamped
  try {
    await invoke('radio_set_volume', { volume: clamped })
  } catch {
    // volume set failed silently
  }
}

export function useRadio() {
  if (!loaded.value) loadSettings()

  return {
    stations: PRESET_STATIONS,
    currentStation,
    playing,
    loading,
    error,
    volume,
    play,
    pause,
    toggle,
    switchStation,
    setVolume,
  }
}

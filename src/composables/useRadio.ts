import { ref, computed, watch } from 'vue'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { emit } from '@tauri-apps/api/event'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'

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
    streamUrl: '__LOCAL__',
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

// ---- Module-level Audio singleton ----

let audio: HTMLAudioElement | null = null

function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio()
    audio.preload = 'auto'

    audio.addEventListener('playing', () => { playing.value = true })
    audio.addEventListener('pause', () => {
      // Only set false if it wasn't paused due to buffering
      if (!audio!.seeking && audio!.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        playing.value = false
      }
    })
    audio.addEventListener('ended', () => { playing.value = false })
    audio.addEventListener('error', () => {
      playing.value = false
      const err = audio!.error
      if (err) {
        switch (err.code) {
          case MediaError.MEDIA_ERR_NETWORK:
            error.value = '网络错误，无法加载音频流'
            break
          case MediaError.MEDIA_ERR_DECODE:
            error.value = '音频解码失败'
            break
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            error.value = '不支持的音频格式'
            break
          default:
            error.value = '音频播放错误'
        }
      }
    })
    audio.addEventListener('waiting', () => { loading.value = true })
    audio.addEventListener('canplay', () => { loading.value = false })
    audio.addEventListener('canplaythrough', () => { loading.value = false })
  }
  return audio
}

// ---- Persistence ----

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

// ---- Playback controls ----

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

  const a = getAudio()

  try {
    let src: string
    if (station.streamUrl === '__LOCAL__') {
      try {
        const filePath = await invoke<string>('get_local_audio_path')
        src = convertFileSrc(filePath)
      } catch (e) {
        error.value = typeof e === 'string' ? e : '本地音频文件不存在'
        loading.value = false
        return
      }
    } else {
      src = station.streamUrl
    }

    a.src = src
    a.volume = radioSettings.value.volume / 100
    await a.play()
  } catch (e) {
    playing.value = false
    error.value = typeof e === 'string' ? e : '播放失败'
    loading.value = false
  }
}

async function pause() {
  getAudio().pause()
}

async function toggle() {
  if (playing.value) {
    pause()
  } else {
    const a = getAudio()
    // If we already have a source loaded, try to resume
    if (radioSettings.value.currentStationId && a.src && a.src !== window.location.href) {
      try {
        await a.play()
      } catch {
        // Resume failed, do a fresh play
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
  getAudio().volume = clamped / 100
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

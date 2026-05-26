import { ref, computed, watch } from 'vue'
import { readTextFile, writeTextFile, mkdir, BaseDirectory } from '@tauri-apps/plugin-fs'
import { emit } from '@tauri-apps/api/event'
import { invoke, convertFileSrc } from '@tauri-apps/api/core'

export type StationIcon = 'code' | 'wave' | 'drone' | 'planet' | 'star' | 'pill' | 'folder' | 'coffee' | 'jazz' | 'spy' | 'hacker'

export type StationCategory = 'focus' | 'ambient' | 'lofi' | 'jazz'

export interface RadioStation {
  id: string
  name: string
  streamUrl: string
  description: string
  icon: StationIcon
  keyword: string
  category: StationCategory
  tags: string[]
}

export interface RadioSettings {
  currentStationId: string | null
  volume: number
}

export const CATEGORY_LABELS: Record<StationCategory, string> = {
  focus: '编程 / 专注',
  ambient: '氛围 / 冥想',
  lofi: 'Lo-Fi / 轻松',
  jazz: '爵士 / 古典',
}

export const PRESET_STATIONS: RadioStation[] = [
  // 编程 / 专注
  {
    id: 'coderadio',
    name: 'Code Radio',
    streamUrl: 'https://coderadio-admin-v2.freecodecamp.org/listen/coderadio/radio.mp3',
    description: 'freeCodeCamp 24h 编程音乐电台',
    icon: 'code',
    keyword: '编程',
    category: 'focus',
    tags: ['编程', '专注', '无人声'],
  },
  {
    id: 'defcon',
    name: 'DEF CON Radio',
    streamUrl: 'https://ice1.somafm.com/defcon-128-mp3',
    description: '黑客大会电台，节奏感强，适合敲代码提速',
    icon: 'hacker',
    keyword: '黑客',
    category: 'focus',
    tags: ['极客', '节奏', '编程'],
  },
  {
    id: 'groovesalad',
    name: 'Groove Salad',
    streamUrl: 'https://ice1.somafm.com/groovesalad-128-mp3',
    description: '缓拍电子氛围，轻微节奏，适合日常办公',
    icon: 'wave',
    keyword: '缓拍',
    category: 'focus',
    tags: ['电子', '节奏', '办公'],
  },
  // 氛围 / 冥想
  {
    id: 'dronezone',
    name: 'Drone Zone',
    streamUrl: 'https://ice1.somafm.com/dronezone-128-mp3',
    description: '深邃氛围音景，极简无节拍，深度专注',
    icon: 'drone',
    keyword: '极简',
    category: 'ambient',
    tags: ['氛围', '冥想', '无节拍'],
  },
  {
    id: 'deepspaceone',
    name: 'Deep Space One',
    streamUrl: 'https://ice1.somafm.com/deepspaceone-128-mp3',
    description: '深邃太空电子，沉浸式专注体验',
    icon: 'planet',
    keyword: '太空',
    category: 'ambient',
    tags: ['太空', '电子', '沉浸'],
  },
  {
    id: 'spacestation',
    name: 'Space Station',
    streamUrl: 'https://ice1.somafm.com/spacestation-128-mp3',
    description: '中速太空音乐，轻松聚焦',
    icon: 'star',
    keyword: '星际',
    category: 'ambient',
    tags: ['太空', '轻松', '专注'],
  },
  {
    id: 'ambientpill',
    name: 'Ambient Pill',
    streamUrl: 'http://radio.stereoscenic.com/asp-s',
    description: '24h 纯氛围音乐，无节拍无广告',
    icon: 'pill',
    keyword: '纯氛围',
    category: 'ambient',
    tags: ['氛围', '无广告', '24h'],
  },
  // Lo-Fi / 轻松
  {
    id: 'lofi',
    name: 'Lo-Fi Hip Hop',
    streamUrl: 'https://lofi.stream.laut.fm/lofi',
    description: '经典 Lofi 纯音乐，轻微鼓点，复古怀旧',
    icon: 'coffee',
    keyword: 'Lofi',
    category: 'lofi',
    tags: ['Lofi', '学习', '放松'],
  },
  {
    id: 'chillout',
    name: 'Chillout Lounge',
    streamUrl: 'https://chillout.stream.laut.fm/chillout',
    description: '沙发音乐，适合下午茶或轻松事务',
    icon: 'coffee',
    keyword: '沙发',
    category: 'lofi',
    tags: ['放松', '沙发', '下午茶'],
  },
  // 爵士 / 古典
  {
    id: 'smoothjazz',
    name: 'Smooth Jazz',
    streamUrl: 'https://strm112.1.fm/smoothjazz_mobile_mp3',
    description: '平滑柔和的纯乐器爵士，适合阅读写作',
    icon: 'jazz',
    keyword: '爵士',
    category: 'jazz',
    tags: ['爵士', '乐器', '写作'],
  },
  {
    id: 'swissjazz',
    name: 'Radio Swiss Jazz',
    streamUrl: 'https://stream.srg-ssr.ch/m/rsj/mp3_128',
    description: '瑞士爵士电台，传统爵士，无广告',
    icon: 'jazz',
    keyword: '传统',
    category: 'jazz',
    tags: ['爵士', '传统', '无广告'],
  },
  {
    id: 'secretagent',
    name: 'Secret Agent',
    streamUrl: 'https://ice1.somafm.com/secretagent-128-mp3',
    description: '60 年代复古电影配乐，神秘爵士感',
    icon: 'spy',
    keyword: '特工',
    category: 'jazz',
    tags: ['复古', '电影', '神秘'],
  },
  // 本地音乐
  {
    id: 'local-music',
    name: '本地音乐',
    streamUrl: '__LOCAL__',
    description: '离线专注音乐（需在 assets/audio/ 放置 focus-music.mp3）',
    icon: 'folder',
    keyword: '离线',
    category: 'focus',
    tags: ['本地', '离线', '自定义'],
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

    audio.addEventListener('playing', () => {
      playing.value = true
      loading.value = false
      error.value = null
    })
    audio.addEventListener('pause', () => {
      // Only set false if it wasn't paused due to buffering
      if (!audio!.seeking && audio!.readyState >= HTMLMediaElement.HAVE_FUTURE_DATA) {
        playing.value = false
      }
      loading.value = false
    })
    audio.addEventListener('ended', () => {
      playing.value = false
      loading.value = false
    })
    audio.addEventListener('error', () => {
      playing.value = false
      loading.value = false
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
      } else {
        error.value = '音频播放错误'
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
    a.load()
    a.volume = radioSettings.value.volume / 100
    await a.play()
  } catch (e) {
    playing.value = false
    error.value = typeof e === 'string' ? e : '播放失败'
    loading.value = false
  }
}

async function pause() {
  const a = getAudio()
  a.pause()
  playing.value = false
  loading.value = false
}

async function toggle() {
  if (playing.value || loading.value) {
    pause()
  } else {
    const a = getAudio()
    // If we already have a source loaded, try to resume (only if there was no error)
    if (radioSettings.value.currentStationId && a.src && a.src !== window.location.href && !error.value) {
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

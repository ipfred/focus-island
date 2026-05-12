# 本地音乐功能

## 快速开始

### 方法 1：使用设置脚本（推荐）

```bash
# 在项目根目录运行
./setup-local-audio.sh
```

然后选择：
- **选项 1**：从你的音乐库复制文件
- **选项 2**：下载示例白噪音
- **选项 3**：查看当前状态
- **选项 4**：删除本地音频

### 方法 2：手动复制

```bash
# 复制你的音频文件
cp ~/Music/你的音乐.mp3 src-tauri/assets/audio/focus-music.mp3

# 或者下载示例
curl -o src-tauri/assets/audio/focus-music.mp3 "https://www.soundjay.com/nature/sounds/rain-01.mp3"
```

## 使用

1. 启动应用：`npm run dev`
2. 打开电台页面
3. 选择「本地音乐」电台
4. 点击播放

## 支持的格式

- MP3（推荐）
- WAV
- FLAC
- OGG

## 推荐音乐类型

- 🌧️ 白噪音（雨声、海浪、森林）
- 🎵 Lo-fi 音乐
- 🎹 轻音乐
- 🌌 环境音乐
- 🎻 古典音乐

## 免费音乐资源

1. **YouTube Audio Library** - https://www.youtube.com/audiolibrary
2. **Free Music Archive** - https://freemusicarchive.org
3. **Incompetech** - https://incompetech.com/music/
4. **MyNoise** - https://mynoise.net（白噪音）

## 技术细节

- 文件位置：`src-tauri/assets/audio/focus-music.mp3`
- 自动打包到应用中
- 支持离线播放
- 详细文档：`docs/LOCAL_AUDIO_SETUP.md`

## 故障排除

### 提示"本地音频文件不存在"

检查文件是否存在：
```bash
ls -lh src-tauri/assets/audio/focus-music.mp3
```

如果不存在，运行设置脚本或手动复制文件。

### 播放没有声音

1. 检查系统音量
2. 检查应用内音量滑块
3. 查看终端的 `[Radio]` 日志
4. 尝试其他音频文件

### 文件格式不支持

确保文件是有效的音频文件：
```bash
# 使用 ffprobe 检查（如果已安装）
ffprobe src-tauri/assets/audio/focus-music.mp3
```

如果文件损坏，尝试重新下载或转换格式。

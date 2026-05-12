# 本地音乐设置指南

## 功能说明

专注岛支持离线本地音乐播放，即使没有网络连接也能使用专注音乐。

## 设置步骤

### 1. 准备音频文件

准备一个你喜欢的专注音乐文件，支持的格式：
- MP3（推荐）
- WAV
- FLAC
- OGG

**推荐音乐类型**：
- 白噪音（雨声、海浪声、森林声）
- Lo-fi 音乐
- 轻音乐
- 环境音乐
- 古典音乐

**注意事项**：
- 文件大小建议不超过 50MB
- 确保音频文件没有版权问题
- 建议选择循环播放效果好的音乐

### 2. 放置音频文件

将音频文件重命名为 `focus-music.mp3`，然后放到项目的以下位置：

```
focus-island/
└── src-tauri/
    └── assets/
        └── audio/
            └── focus-music.mp3  ← 放在这里
```

**开发环境**：
```bash
# 复制你的音频文件
cp ~/Music/你的音乐.mp3 src-tauri/assets/audio/focus-music.mp3
```

**生产环境**：
打包后的应用会自动包含这个文件，用户可以在应用资源目录找到并替换。

### 3. 使用本地音乐

1. 启动应用
2. 打开电台页面
3. 选择"本地音乐"电台
4. 点击播放按钮

如果文件不存在，会显示错误提示：
> 本地音频文件不存在，请将音频文件放到 assets/audio/focus-music.mp3

## 技术实现

### 资源路径解析

应用会自动解析资源目录路径：
- **开发环境**：`src-tauri/assets/audio/focus-music.mp3`
- **生产环境**：`<app-resources>/assets/audio/focus-music.mp3`

### 前端配置

`src/composables/useRadio.ts` 中的配置：

```typescript
{
  id: 'local-music',
  name: '本地音乐',
  streamUrl: '__LOCAL__', // 特殊标记，运行时会被替换
  description: '离线专注音乐',
}
```

### Rust 命令

`get_local_audio_path` 命令会：
1. 获取应用资源目录
2. 拼接路径：`resources/assets/audio/focus-music.mp3`
3. 检查文件是否存在
4. 返回完整路径或错误信息

## 常见问题

### Q: 为什么要固定文件名为 `focus-music.mp3`？
A: 为了简化配置，避免用户需要修改代码。如果需要支持多个文件，可以扩展为播放列表功能。

### Q: 可以使用其他格式吗？
A: 可以，但需要修改文件名。例如使用 WAV 格式，将文件命名为 `focus-music.mp3` 实际上不会工作，需要修改代码中的文件扩展名检测逻辑。建议统一使用 MP3 格式。

### Q: 文件大小有限制吗？
A: 没有硬性限制，但建议不超过 50MB。文件越大，加载时间越长，占用空间越多。

### Q: 可以添加多个音频文件吗？
A: 当前版本只支持单个文件。如果需要多个文件，可以：
1. 将多个音频合并成一个文件
2. 或者扩展代码支持播放列表功能

### Q: 打包后如何更换音频文件？
A: 
- **macOS**: 右键应用 → 显示包内容 → Contents/Resources/assets/audio/
- **Windows**: 应用安装目录/resources/assets/audio/
- **Linux**: 应用目录/resources/assets/audio/

## 推荐资源

### 免费音乐资源（无版权）

1. **YouTube Audio Library**
   - https://www.youtube.com/audiolibrary
   - 大量免费音乐，可商用

2. **Free Music Archive**
   - https://freemusicarchive.org
   - 开放版权音乐

3. **Incompetech**
   - https://incompetech.com/music/
   - Kevin MacLeod 的免费音乐

4. **白噪音生成器**
   - https://mynoise.net
   - 可以下载自定义白噪音

### 音频编辑工具

如果需要编辑音频（裁剪、循环、淡入淡出）：
- **Audacity**（免费，跨平台）
- **GarageBand**（macOS 自带）
- **在线工具**：https://mp3cut.net

## 开发者扩展

### 支持多个音频文件

修改 `PRESET_STATIONS` 添加更多本地电台：

```typescript
{
  id: 'local-rain',
  name: '雨声',
  streamUrl: '__LOCAL_RAIN__',
  description: '雨声白噪音',
}
```

然后在 Rust 中添加对应的路径解析逻辑。

### 支持用户自定义路径

可以添加设置页面，让用户选择自己的音频文件路径，保存到配置文件中。

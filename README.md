# 专注岛 FocusIsland (Custom Fork)

<p align="center">
  <strong>屏幕顶部的灵动岛番茄钟 · Windows 增强定制版</strong><br>
  <em>Custom fork of <a href="https://github.com/ipfred/focus-island">ipfred/focus-island</a> with Windows-focused enhancements</em>
</p>

---

## 🍴 定制版说明 / About This Fork

> [!NOTE]
> **中文**：本 Fork 基于 [ipfred/focus-island](https://github.com/ipfred/focus-island) v2.9.0，面向 Windows 增强了以下内容。
>
> **English**: This fork is based on [ipfred/focus-island](https://github.com/ipfred/focus-island) v2.9.0 with the following Windows-focused enhancements.

| 增强 / Enhancement | 说明 / Description |
|--------------------|--------------------|
| 🌙 **刘海模式（默认）/ Notch mode (default)** | 灵动岛默认收为屏幕顶部一条无感刘海，悬停展开，点击打开面板（可在设置中关闭）。/ The island collapses into a subtle top notch; hover to expand, click to open the panel (configurable). |
| 📻 **电台导入 / Radio import** | B 站等视频链接（自动调用 yt-dlp 转纯音频并绕过防盗链）、M3U/PLS 歌单、音频直链；修复 8 个不可用的官方源。/ Video links (Bilibili etc. via yt-dlp with hot-link workaround), M3U/PLS playlists, direct audio URLs; replaced 8 broken preset stations. |
| 🔔 **通知中心 / Notification center** | 番茄钟/休息记录持久化保存。/ Persistent pomodoro & break history. |
| 🔊 **快捷音量 / Quick volume** | 通知中心内控制系统音量与静音（WASAPI）。/ System volume & mute via WASAPI. |
| ⌨️ **快捷键修复 / Shortcut fix** | 全局快捷键改为 Rust 层注册，修复漏触发。/ Global shortcuts are registered in Rust — no more missed triggers. |
| 🏷️ **标语编辑器 / Motto editor** | 设置页自定义空闲轮播标语。/ Customize idle rotating mottos in Settings. |
| 🖥️ **自动透明 / Auto transparency** | 面板未悬停/失焦时自动变透明；灵动岛与面板透明度独立调节。/ Panel auto-dims when unfocused; independent opacity sliders for island and panel. |

### 维护指南 / Maintenance

- **同步官方更新 / Sync upstream**: `git fetch upstream && git merge upstream/master`
- **构建 / Build**: `npm install && npx tauri build --no-bundle` → `src-tauri/target/release/focus-island.exe`
- **yt-dlp**: 首次导入视频链接时自动下载到 `%APPDATA%/com.focus-island.desktop/bin/` / auto-downloaded on first use
- ⚠️ **请勿使用应用内更新** / Do **not** use the in-app updater — it installs the upstream build and overwrites this fork. Sync via git instead.

---

以下为原版 README / Original README below:

# 专注岛 FocusIsland

<p align="center">
  <strong>屏幕顶部的灵动岛番茄钟</strong><br>
  <em>专注时在，注意力拉回，从不打扰</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License" />
  <img src="https://img.shields.io/badge/size-~5MB-purple" alt="Size" />
</p>

<p align="center">
  <img src="image/focus-island_v2-ezgif.com-optimize.gif" width="320" alt="专注岛演示" />
</p>

---

## ✨ 核心特性

### 🎯 灵动岛形态

一条贴在屏幕顶部的胶囊，实时显示专注进度。既能随时掌握状态，又不会遮挡工作内容。

灵动岛长驻,时刻提醒,将自己的专注力拉回到任务心流中


### 🚀 功能亮点

- 内置专注清单面板，优先级最高的任务进入核心专注区
- 每个任务自动记录已完成的番茄数
- 每日任务统计
- 备忘录 + todo清单
- 7*24 专注音乐电台

### 🎨 高度可定制

- **5 套精美主题** — 经典橙红、海洋蓝绿、薰衣草紫、森林深绿、赛博朋克
- **灵活时长设置** — 专注和休息时长自由调整
- **可调节大小** — 灵动岛尺寸支持 50%~150% 缩放
- **透明度调节** — 适配不同壁纸和视觉偏好
- 随机激励语 为你的专注加油

### ⚡ 轻量高效

基于 Tauri 构建，安装包仅约 5MB，内存占用极低，冷启动秒开。

### 🌍 跨平台支持

支持 macOS、Windows、Linux 三大平台。

---

## 📦 安装

前往 [Releases](https://github.com/ipfred/focus-island/releases) 页面下载对应平台的安装包：

| 平台 | 文件 |
|------|------|
| macOS (Apple Silicon) | `专注岛_x.x.x_aarch64.dmg` |
| macOS (Intel) | `专注岛_x.x.x_x64.dmg` |
| Windows | `专注岛_x.x.x_x64-setup.exe` |
| Linux | `专注岛_x.x.x_amd64.AppImage` |

> Linux 用户下载后需添加执行权限：`chmod +x 专注岛_*.AppImage`

### macOS 常见问题

#### 打开提示 "xxx.app 已损坏，无法打开"

1. 确认已将应用拖入 `应用程序` 文件夹。
2. 打开「终端」，执行以下命令（请根据实际应用名替换路径中的 `灵动岛.app`）：

```bash
xattr -cr /Applications/专注岛.app
```

3. 再次从「应用程序」中打开应用；如仍有安全提示，可在「系统设置 → 隐私与安全性」中允许打开来自未认证开发者的 App。

---

## 🚀 使用指南

### 快速开始

1. **点击灵动岛** 或通过 **系统托盘** 打开专注清单面板
2. 添加任务，点击任务开始专注（默认 25 分钟）
3. 计时结束后自动进入休息（默认 5 分钟）

### 灵动岛状态

| 状态 | 显示内容 |
|------|----------|
| 待机 | 轮播待办任务和激励语 |
| 专注 | 任务名 + 进度环 + 倒计时 |
| 休息 | 绿色主题 + 休息倒计时 |

### 系统托盘

点击系统托盘图标可以：
- 打开专注清单
- 显示/隐藏灵动岛
- 退出应用

---

## 🛠 本地开发

```bash
# 环境要求：Node.js 18+、Rust 1.80+

# 安装依赖
npm install

# 开发模式（热更新）
npm run dev

# 构建生产版本
npm run build
```

## 🔖 版本号同步（package.json -> Cargo.toml）

项目内置脚本 `scripts/sync-version.mjs`，会读取 `package.json` 中的 `version` 并同步到 `src-tauri/Cargo.toml`。

### 推荐发布流程

```bash
# 升级版本并自动同步 Cargo.toml
npm version patch   # 末位版本号 +1
npm version minor   # 升级中间位 充值末位
npm version major  # 首位升级 重置后两位
npm version 1.8.3 --no-git-tag-version  # 指定版本 不提交到git上
```

---

## Friendship Link

Thanks for the support and feedback from the friends at [LINUX DO](https://linux.do/).

## 📄 License

Apache License 2.0

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useIslandState } from "../composables/useIslandState";
import { useTimer, type NotificationType } from "../composables/useTimer";
import { useSettings, type Settings } from "../composables/useSettings";
import { useDockMode } from "../composables/useDockMode";
import CapsuleIdle from "./CapsuleIdle.vue";
import DockStrip from "./DockStrip.vue";
import CapsuleFocus from "./CapsuleFocus.vue";
import NotificationBanner from "./NotificationBanner.vue";
import type { TimerStatePayload } from "../composables/useTimerBridge";

const { state, setState, setNotificationVisible } = useIslandState();
const timer = useTimer();
const { settings, applyExternalSettings } = useSettings();
const { dockCollapsed, stripProgress, stripColor, DOCK_STRIP_WINDOW_H } = useDockMode();
const showStrip = computed(() => dockCollapsed.value);

let unlisten: (() => void) | null = null;
let unlistenSettings: (() => void) | null = null;
let unlistenPanelMotion: (() => void) | null = null;
let unlistenRadio: (() => void) | null = null;
let unlistenNotification: (() => void) | null = null;
let activityTimer: ReturnType<typeof setInterval> | null = null;

const radioPlaying = ref(false);
const notificationType = ref<NotificationType>(null);

const shellRef = ref<HTMLElement | null>(null);
let layoutObserver: ResizeObserver | null = null;

// 舞台固定大小，形变全部在 DOM 内完成；
// 岛的屏幕矩形上报给 Rust，供面板定位 / 悬停 / 点击判定使用。
async function reportLayout() {
    const el = shellRef.value;
    if (!el) return;
    const r = el.getBoundingClientRect();
    try {
        await invoke("set_island_layout", { x: r.left, y: r.top, w: r.width, h: r.height });
    } catch {
        // window closing
    }
}

// Watch notification visibility and toggle click-through + resize window
watch(notificationType, (val) => {
    const visible = val !== null;
    setNotificationVisible(visible);
    // dock（刘海）模式下点击穿透由 useDockMode 统一管理
    if (settings.value.islandDisplayMode !== "dock") {
        invoke("set_click_through", { ignore: !visible });
    }
});

// 悬停展开后的胶囊：点击打开专注清单
function onCapsuleClick() {
    if (showStrip.value) return;
    void invoke("toggle_panel");
}

// 形变 / 缩放 / 通知后上报新矩形
watch([showStrip, notificationType, () => settings.value.islandScale], () => {
    nextTick(reportLayout);
});

function playNotificationSound() {
    if (!settings.value.notificationSound) return;
    try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.08);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.16);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.35);
    } catch {
        // Audio not available
    }
}

function onNotifConfirm() {
    notificationType.value = null;
    emit("notification-action", "confirm");
}

function onNotifExtend() {
    notificationType.value = null;
    emit("notification-action", "extend");
}

function onNotifDismiss() {
    notificationType.value = null;
    emit("notification-action", "dismiss");
}

let panelMotionTimer: number | null = null;
let countdownTimer: number | null = null;
let countdownEndAt = 0;

const BASE_WIDTH = 320;
const BASE_HEIGHT = 34;
const panelMotionState = ref<"idle" | "opening" | "closing">("idle");

const capsuleWidth = computed(() => BASE_WIDTH * (settings.value.islandScale ?? 1));
const capsuleHeight = computed(() => BASE_HEIGHT * (settings.value.islandScale ?? 1));
const capsuleRadius = computed(() => capsuleHeight.value / 2);
// 刘海宽度：窗口与玻璃层必须严格贴合，杜绝外侧光晕
const NOTCH_WIDTH = 200;
const notchWidth = computed(() => NOTCH_WIDTH * (settings.value.islandScale ?? 1));

const progressScale = computed(() => {
    if (state.value === "idle" || state.value === "alert") return 0;
    const v = timer.progress.value;
    if (Number.isNaN(v) || v <= 0) return 0;
    if (v >= 1) return 1;
    return v;
});

const ringColor = computed(() => {
    if (timer.phase.value === "focus" && timer.running.value)
        return "var(--focus-color)";
    if (timer.phase.value === "break" && timer.running.value)
        return "var(--break-color)";
    return "rgba(255,255,255,0.45)";
});

function runPanelMotion(phase: "open" | "close") {
    if (panelMotionTimer) {
        window.clearTimeout(panelMotionTimer);
    }
    panelMotionState.value = phase === "open" ? "opening" : "closing";
    panelMotionTimer = window.setTimeout(() => {
        panelMotionState.value = "idle";
        panelMotionTimer = null;
    }, phase === "open" ? 280 : 160);
}

function stopLocalCountdown() {
    if (countdownTimer !== null) {
        window.clearInterval(countdownTimer);
        countdownTimer = null;
    }
}

function syncRemainingFromEndAt() {
    if (countdownEndAt <= 0) return;
    const msLeft = countdownEndAt - Date.now();
    timer.remaining.value = Math.max(0, Math.ceil(msLeft / 1000));
}

function startLocalCountdown(endAt: number) {
    countdownEndAt = endAt;
    syncRemainingFromEndAt();
    if (countdownTimer !== null) return;
    countdownTimer = window.setInterval(syncRemainingFromEndAt, 200);
}

onMounted(async () => {
    invoke("set_click_through", { ignore: true });

    // 空闲检测喂食：岛窗口是点击穿透的收不到输入，
    // 用 Rust 光标轮询探测系统级活动，派发合成事件重置 useIdle
    activityTimer = setInterval(async () => {
        try {
            if (await invoke<boolean>("cursor_active")) {
                window.dispatchEvent(new MouseEvent("mousemove"));
            }
        } catch {
            // ignore
        }
    }, 1000);

    await nextTick();
    reportLayout();
    if (typeof ResizeObserver !== "undefined" && shellRef.value) {
        layoutObserver = new ResizeObserver(() => reportLayout());
        layoutObserver.observe(shellRef.value);
    }

    unlisten = await listen<TimerStatePayload>(
        "timer-state-update",
        ({ payload }) => {
            timer.totalDuration.value = payload.totalDuration;
            timer.running.value = payload.running;
            timer.activeTaskId.value = payload.activeTaskId;
            timer.activeTaskTitle.value = payload.activeTaskTitle ?? null;
            if (payload.phase !== timer.phase.value) {
                timer.phase.value = payload.phase;
            }
            if (payload.running) {
                startLocalCountdown(payload.syncedAt + payload.remaining * 1000);
            } else {
                stopLocalCountdown();
                countdownEndAt = 0;
                timer.remaining.value = payload.remaining;
            }

            if (payload.running && payload.phase === "focus") {
                setState("focus");
            } else if (payload.running && payload.phase === "break") {
                setState("break");
            } else if (
                !payload.running &&
                !payload.activeTaskId &&
                state.value !== "idle" &&
                state.value !== "alert"
            ) {
                setState("idle");
            }
        },
    );

    // 拉取 panel 当前计时快照，避免窗口晚启动时错过状态。
    emit("timer-state-request").catch(() => {});

    unlistenSettings = await listen<Settings>("settings-changed", ({ payload }) => {
        applyExternalSettings(payload);
        nextTick(reportLayout);
    });

    unlistenPanelMotion = await listen<string>("island-panel-motion", ({ payload }) => {
        if (payload === "open" || payload === "close") {
            runPanelMotion(payload);
        }
    });

    unlistenRadio = await listen<{ playing: boolean; stationId: string | null }>("radio-state-update", ({ payload }) => {
        radioPlaying.value = payload.playing;
    });

    unlistenNotification = await listen<NotificationType>("notification-show", ({ payload }) => {
        notificationType.value = payload;
        if (payload) playNotificationSound();
    });
});

onUnmounted(() => {
    if (activityTimer !== null) clearInterval(activityTimer);
    layoutObserver?.disconnect();
    unlisten?.();
    unlistenSettings?.();
    unlistenPanelMotion?.();
    unlistenRadio?.();
    unlistenNotification?.();
    stopLocalCountdown();
    if (panelMotionTimer) {
        window.clearTimeout(panelMotionTimer);
    }
});
</script>

<template>
    <div class="island-container w-full h-full flex items-start justify-center">
        <div class="island-stack">
            <div
                class="capsule-motion"
                :class="{
                    'panel-launching': panelMotionState === 'opening',
                    'panel-receiving': panelMotionState === 'closing',
                    'animating': panelMotionState !== 'idle',
                }"
            >
                <div
                    ref="shellRef"
                    class="capsule-shell relative flex items-center justify-center"
                    @click="onCapsuleClick"
                    :class="{
                        'ring-focus':
                            timer.phase.value === 'focus' && timer.running.value,
                        'ring-break':
                            timer.phase.value === 'break' && timer.running.value,
                        'strip-mode': showStrip,
                    }"
                    :style="{
                        '--ring-progress': progressScale,
                        '--ring-color': ringColor,
                        '--ring-opacity': timer.running.value ? 1 : 0.35,
                        '--island-scale': settings.islandScale ?? 1,
                        width: (showStrip ? notchWidth : capsuleWidth) + 'px',
                        height: (showStrip ? DOCK_STRIP_WINDOW_H * (settings.islandScale ?? 1) : capsuleHeight) + 'px',
                        borderRadius: (showStrip ? '0 0 10px 10px' : capsuleRadius + 'px'),
                    }"
                >
                    <div class="capsule-glass-fx" aria-hidden="true" />
                    <Transition name="xfade">
                        <DockStrip
                            v-if="showStrip"
                            :progress="stripProgress"
                            :color="stripColor"
                            :scale="settings.islandScale ?? 1"
                        />
                    <div v-else class="absolute inset-0">
                        <CapsuleIdle v-if="state === 'idle' || state === 'alert'" :radio-playing="radioPlaying" />
                        <CapsuleFocus v-else-if="state === 'focus' || state === 'break'" :radio-playing="radioPlaying" />
                        <svg class="progress-ring" :viewBox="`0 0 ${capsuleWidth} ${capsuleHeight}`" aria-hidden="true">
                            <rect
                                class="ring-track"
                                :x="1.5 * settings.islandScale"
                                :y="1.5 * settings.islandScale"
                                :width="capsuleWidth - 3 * settings.islandScale"
                                :height="capsuleHeight - 3 * settings.islandScale"
                                :rx="capsuleRadius - 1.5 * settings.islandScale"
                                pathLength="1"
                            />
                            <rect
                                class="ring-progress"
                                :x="1.5 * settings.islandScale"
                                :y="1.5 * settings.islandScale"
                                :width="capsuleWidth - 3 * settings.islandScale"
                                :height="capsuleHeight - 3 * settings.islandScale"
                                :rx="capsuleRadius - 1.5 * settings.islandScale"
                                pathLength="1"
                            />
                        </svg>
                    </div>
                    </Transition>
                </div>
            </div>
            <NotificationBanner
                :type="notificationType"
                :scale="settings.islandScale ?? 1"
                @confirm="onNotifConfirm"
                @extend="onNotifExtend"
                @dismiss="onNotifDismiss"
            />
        </div>
    </div>
</template>

<style scoped>
.xfade-enter-active,
.xfade-leave-active {
    transition: opacity 0.16s ease;
}

.xfade-enter-from,
.xfade-leave-to {
    opacity: 0;
}

.capsule-shell :deep(.dock-strip) {
    position: absolute;
    inset: 0;
}
.island-container {
    /* items-start justify-center to stick to top edge */
}

.island-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
}

.capsule-motion {
    transform-origin: center top;
}

.capsule-motion.animating {
    will-change: transform;
}

.capsule-shell {
    /* 深色 = 深磨砂玻璃：低透明深色层叠在系统磨砂上（深色主题下是真磨砂） */
    background: linear-gradient(180deg, rgba(23, 23, 28, 0.62), rgba(13, 13, 17, 0.66));
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.06),
        inset 0 -1px 0 rgba(0, 0, 0, 0.25);
    transition:
        width 0.32s cubic-bezier(0.16, 1, 0.3, 1),
        height 0.32s cubic-bezier(0.16, 1, 0.3, 1),
        border-radius 0.32s cubic-bezier(0.16, 1, 0.3, 1);
    contain: layout style paint;
}

.capsule-shell.strip-mode {
    /* 收回刘海：快速动画（比展开更短） */
    transition:
        width 0.15s cubic-bezier(0.3, 0, 0.2, 1),
        height 0.15s cubic-bezier(0.3, 0, 0.2, 1),
        border-radius 0.15s cubic-bezier(0.3, 0, 0.2, 1);
    /* 刘海体 = 同一块深磨砂玻璃（更实） */
    background: linear-gradient(180deg, rgba(23, 23, 28, 0.88), rgba(16, 16, 20, 0.92));
}

/* ===== 浅色模式 = 系统磨砂上的低透明白玻璃 ===== */
:root[data-color-mode="light"] .capsule-shell {
    background:
        linear-gradient(145deg, rgba(255, 255, 255, 0.5), transparent 45%),
        rgba(250, 252, 255, 0.42);
    box-shadow:
        inset 0 1px 0 rgba(255, 255, 255, 0.65),
        inset 0 -1px 0 rgba(120, 140, 170, 0.14),
        inset 0 0 0 0.5px rgba(120, 140, 170, 0.10);
}

:root[data-color-mode="light"] .capsule-shell.strip-mode {
    background: rgba(249, 251, 254, 0.62);
    box-shadow:
        inset 0 -1px 0 rgba(120, 140, 170, 0.16),
        inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

/* 浅色模式下电波条改深色 */
:root[data-color-mode="light"] .capsule-shell :deep(.wave-bar) {
    background: rgba(35, 42, 54, 0.5);
}

:root[data-color-mode="light"] .capsule-shell :deep(.ring-track) {
    stroke: rgba(28, 35, 48, 0.14);
}

:root[data-color-mode="light"] .capsule-shell :deep(.track) {
    background: rgba(28, 35, 48, 0.15);
}

/* 玻璃光效层：顶部光条 + 斜向色散高光（纯装饰，不拦截事件） */
.capsule-glass-fx {
    position: absolute;
    inset: 0;
    border-radius: inherit;
    overflow: hidden;
    pointer-events: none;
}

.capsule-shell.strip-mode .capsule-glass-fx {
    display: none;
}

.capsule-glass-fx::before {
    content: "";
    position: absolute;
    top: 2px;
    left: 50%;
    width: 42%;
    height: 2px;
    border-radius: 999px;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.82), transparent);
    filter: blur(0.4px);
    transform: translateX(-50%);
}

.capsule-glass-fx::after {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E");
    mix-blend-mode: overlay;
    opacity: 0.10;
}

.capsule-shell::before,
.capsule-shell::after {
    content: "";
    position: absolute;
    pointer-events: none;
}

.capsule-shell::before {
    inset: 1px;
    border-radius: inherit;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 56%);
    opacity: 0;
    transform: scale(0.88, 0.82);
}

.capsule-shell::after {
    left: 50%;
    top: 56%;
    width: 42%;
    height: 46%;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0));
    opacity: 0;
    transform: translate(-50%, -42%) scale(0.42, 0.16);
}

/* ring-focus/ring-break 不再加 box-shadow，避免胶囊四周出现浅色矩形光晕 */

.panel-launching {
    will-change: transform;
    animation: island-release 280ms cubic-bezier(0.2, 0.88, 0.26, 1) both;
}

.panel-launching .capsule-shell::before {
    animation: island-core-open 280ms cubic-bezier(0.2, 0.88, 0.26, 1) both;
}

.panel-launching .capsule-shell::after {
    animation: island-tail-open 280ms cubic-bezier(0.2, 0.88, 0.26, 1) both;
}

.panel-receiving {
    will-change: transform;
    animation: island-receive 160ms cubic-bezier(0.34, 0, 0.72, 0.2) both;
}

.panel-receiving .capsule-shell::before {
    animation: island-core-close 160ms cubic-bezier(0.34, 0, 0.72, 0.2) both;
}

.panel-receiving .capsule-shell::after {
    animation: island-tail-close 160ms cubic-bezier(0.34, 0, 0.72, 0.2) both;
}

@keyframes island-release {
    0% {
        transform: scale(1, 1);
    }

    38% {
        transform: scale(0.96, 0.9);
    }

    100% {
        transform: scale(1, 1);
    }
}

@keyframes island-receive {
    0% {
        transform: scale(1, 1);
    }

    42% {
        transform: scale(0.93, 0.84);
    }

    100% {
        transform: scale(1, 1);
    }
}

@keyframes island-core-open {
    0% {
        opacity: 0;
        transform: scale(0.86, 0.8);
    }

    52% {
        opacity: 1;
        transform: scale(1.02, 0.96);
    }

    100% {
        opacity: 0;
        transform: scale(1.08, 1.02);
    }
}

@keyframes island-core-close {
    0% {
        opacity: 0;
        transform: scale(1.02, 0.96);
    }

    56% {
        opacity: 1;
        transform: scale(0.94, 0.86);
    }

    100% {
        opacity: 0;
        transform: scale(0.82, 0.74);
    }
}

@keyframes island-tail-open {
    0% {
        opacity: 0;
        transform: translate(-50%, -42%) scale(0.42, 0.16);
    }

    46% {
        opacity: 0.78;
        transform: translate(-50%, -16%) scale(0.8, 0.46);
    }

    100% {
        opacity: 0;
        transform: translate(-50%, -2%) scale(0.96, 0.68);
    }
}

@keyframes island-tail-close {
    0% {
        opacity: 0;
        transform: translate(-50%, -2%) scale(0.9, 0.62);
    }

    52% {
        opacity: 0.82;
        transform: translate(-50%, -18%) scale(0.72, 0.34);
    }

    100% {
        opacity: 0;
        transform: translate(-50%, -42%) scale(0.38, 0.14);
    }
}

.progress-ring {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.ring-track,
.ring-progress {
    fill: none;
    stroke-width: 3;
    vector-effect: non-scaling-stroke;
}

.ring-track {
    stroke: rgba(255, 255, 255, 0.08);
}

.ring-progress {
    stroke: var(--ring-color);
    stroke-dasharray: 1;
    stroke-dashoffset: calc(1 - var(--ring-progress));
    stroke-linecap: round;
    opacity: var(--ring-opacity);
    transition:
        stroke-dashoffset 0.4s linear,
        opacity 0.3s ease;
}
</style>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { emit, listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useIslandState } from "../composables/useIslandState";
import { useTimer, type NotificationType } from "../composables/useTimer";
import { useSettings, type Settings } from "../composables/useSettings";
import CapsuleIdle from "./CapsuleIdle.vue";
import CapsuleFocus from "./CapsuleFocus.vue";
import NotificationBanner from "./NotificationBanner.vue";
import type { TimerStatePayload } from "../composables/useTimerBridge";

const { state, setState, setNotificationVisible } = useIslandState();
const timer = useTimer();
const { settings, applyExternalSettings } = useSettings();

let unlisten: (() => void) | null = null;
let unlistenSettings: (() => void) | null = null;
let unlistenPanelMotion: (() => void) | null = null;
let unlistenRadio: (() => void) | null = null;
let unlistenNotification: (() => void) | null = null;

const radioPlaying = ref(false);
const notificationType = ref<NotificationType>(null);

// Watch notification visibility and toggle click-through + resize window
watch(notificationType, (val) => {
    const visible = val !== null;
    setNotificationVisible(visible);
    invoke("set_click_through", { ignore: !visible });
    const scale = settings.value.islandScale ?? 1;
    if (visible) {
        // Expand window to fit capsule + gap + notification banner
        const width = 360 * scale;
        const height = (BASE_HEIGHT + 6 + 60) * scale;
        invoke("set_island_custom_size", { width, height });
    } else {
        // Restore normal island size
        invoke("set_island_size", { scale });
    }
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
    }, phase === "open" ? 280 : 240);
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
    
    // 初始化时应用当前 scale
    if (settings.value.islandScale) {
        invoke("set_island_size", { scale: settings.value.islandScale });
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
        if (payload.islandScale !== undefined) {
            invoke("set_island_size", { scale: payload.islandScale });
        }
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
                }"
            >
                <div
                    class="capsule-shell relative flex items-center justify-center"
                    :class="{
                        'ring-focus':
                            timer.phase.value === 'focus' && timer.running.value,
                        'ring-break':
                            timer.phase.value === 'break' && timer.running.value,
                    }"
                    :style="{
                        '--ring-progress': progressScale,
                        '--ring-color': ringColor,
                        '--ring-opacity': timer.running.value ? 1 : 0.35,
                        '--island-scale': settings.islandScale ?? 1,
                        width: capsuleWidth + 'px',
                        height: capsuleHeight + 'px',
                        borderRadius: capsuleRadius + 'px',
                    }"
                >
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
    will-change: transform;
}

.capsule-shell {
    background: rgba(20, 20, 22, var(--island-opacity, 0.82));
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    -webkit-mask-image: -webkit-radial-gradient(white, black);
    box-shadow: 0 4px 32px rgba(0, 0, 0, 0.45);
    transition: box-shadow 0.4s ease, width 0.3s ease, height 0.3s ease;
    isolation: isolate;
    will-change: box-shadow;
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
    background:
        radial-gradient(circle at 50% 40%, rgba(255, 255, 255, 0.18), transparent 58%),
        linear-gradient(180deg, rgba(255, 255, 255, 0.09), transparent 56%);
    opacity: 0;
    transform: scale(0.88, 0.82);
}

.capsule-shell::after {
    left: 50%;
    top: 56%;
    width: 42%;
    height: 46%;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(255, 255, 255, 0));
    filter: blur(7px);
    opacity: 0;
    transform: translate(-50%, -42%) scale(0.42, 0.16);
}

.ring-focus {
    box-shadow: 0 4px 32px rgba(0, 0, 0, 0.45);
}

.ring-break {
    box-shadow: 0 4px 32px rgba(0, 0, 0, 0.45);
}

.panel-launching {
    animation: island-release 280ms cubic-bezier(0.2, 0.88, 0.26, 1) both;
}

.panel-launching .capsule-shell::before {
    animation: island-core-open 280ms cubic-bezier(0.2, 0.88, 0.26, 1) both;
}

.panel-launching .capsule-shell::after {
    animation: island-tail-open 280ms cubic-bezier(0.2, 0.88, 0.26, 1) both;
}

.panel-receiving {
    animation: island-receive 240ms cubic-bezier(0.34, 0, 0.72, 0.2) both;
}

.panel-receiving .capsule-shell::before {
    animation: island-core-close 240ms cubic-bezier(0.34, 0, 0.72, 0.2) both;
}

.panel-receiving .capsule-shell::after {
    animation: island-tail-close 240ms cubic-bezier(0.34, 0, 0.72, 0.2) both;
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

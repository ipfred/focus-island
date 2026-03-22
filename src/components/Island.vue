<script setup lang="ts">
import { computed, onMounted, onUnmounted } from "vue";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useIslandState } from "../composables/useIslandState";
import { useTimer } from "../composables/useTimer";
import { useSettings, type Settings } from "../composables/useSettings";
import CapsuleIdle from "./CapsuleIdle.vue";
import CapsuleFocus from "./CapsuleFocus.vue";
import type { TimerStatePayload } from "../composables/useTimerBridge";

const { state, setState } = useIslandState();
const timer = useTimer();
const { settings, applyExternalSettings } = useSettings();

let unlisten: (() => void) | null = null;
let unlistenSettings: (() => void) | null = null;

const BASE_WIDTH = 320;
const BASE_HEIGHT = 34;

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

onMounted(async () => {
    invoke("set_click_through", { ignore: true });
    
    // 初始化时应用当前 scale
    if (settings.value.islandScale) {
        invoke("set_island_size", { scale: settings.value.islandScale });
    }

    unlisten = await listen<TimerStatePayload>(
        "timer-state-update",
        ({ payload }) => {
            timer.remaining.value = payload.remaining;
            timer.totalDuration.value = payload.totalDuration;
            timer.running.value = payload.running;
            timer.activeTaskId.value = payload.activeTaskId;
            timer.activeTaskTitle.value = payload.activeTaskTitle ?? null;
            if (payload.phase !== timer.phase.value) {
                timer.phase.value = payload.phase;
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

    unlistenSettings = await listen<Settings>("settings-changed", ({ payload }) => {
        applyExternalSettings(payload);
        if (payload.islandScale !== undefined) {
            invoke("set_island_size", { scale: payload.islandScale });
        }
    });
});

onUnmounted(() => {
    unlisten?.();
    unlistenSettings?.();
});
</script>

<template>
    <div class="island-container w-full h-full flex items-start justify-center">
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
            <CapsuleIdle v-if="state === 'idle' || state === 'alert'" />
            <CapsuleFocus v-else-if="state === 'focus' || state === 'break'" />
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
</template>

<style scoped>
.island-container {
    /* items-start justify-center to stick to top edge */
}

.capsule-shell {
    background: rgba(20, 20, 22, var(--island-opacity, 0.82));
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    -webkit-mask-image: -webkit-radial-gradient(white, black);
    box-shadow: 0 4px 32px rgba(0, 0, 0, 0.45);
    transition: box-shadow 0.4s ease, width 0.3s ease, height 0.3s ease;
}

.ring-focus {
    box-shadow: 0 4px 32px rgba(0, 0, 0, 0.45);
}

.ring-break {
    box-shadow: 0 4px 32px rgba(0, 0, 0, 0.45);
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

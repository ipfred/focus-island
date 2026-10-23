<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useTasks } from "../composables/useTasks";
import { useSettings } from "../composables/useSettings";

const { recentFocusTasks } = useTasks();
const { settings } = useSettings()

const props = defineProps<{ radioPlaying?: boolean }>();

// 右侧预留宽度（时钟 + 播放波形），单位 px（未乘以 island-scale）
const rightInset = computed(() => (props.radioPlaying ? 76 : 52));

const DEFAULT_MOTTOS = [
    "深呼吸，然后开始",
    "专注当下，一次一件事",
    "每一步都算数",
    "你比想象中更有能力",
    "保持节奏，持续前进",
    "休息也是生产力的一部分",
    "今天的努力，明天的底气",
    "把大象切成小块吃",
    "做完比做好更重要",
    "心流就在下一个番茄钟",
];

const mottos = computed(() => {
    const custom = settings.value.idleMottos;
    return custom && custom.length > 0 ? custom : DEFAULT_MOTTOS;
});

function pickRandomMottos(count: number): string[] {
    const pool = [...mottos.value];
    const result: string[] = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        result.push(pool.splice(idx, 1)[0]);
    }
    return result;
}

interface CarouselItem {
    key: string;
    type: "task" | "motto";
    text: string;
    pomodoroCount?: number;
}

const carouselItems = computed<CarouselItem[]>(() => {
    const tasks = recentFocusTasks.value;
    if (tasks.length === 0) {
        // No tasks at all: only mottos
        return mottos.value.map((m, i) => ({
            key: `motto-${i}`,
            type: "motto" as const,
            text: m,
        }));
    }
    // Tasks + 2 random mottos mixed in
    const items: CarouselItem[] = tasks.map((t) => ({
        key: t.id,
        type: "task" as const,
        text: t.title,
        pomodoroCount: t.pomodoroCount,
    }));
    const randomMottos = pickRandomMottos(2);
    randomMottos.forEach((m, i) => {
        items.push({
            key: `motto-r-${i}-${m}`,
            type: "motto" as const,
            text: m,
        });
    });
    return items;
});

const carouselIndex = ref(0);
let carouselTimer: ReturnType<typeof setInterval> | null = null;

// 空闲态右上角实时时钟
const clock = ref("");
let clockTimer: ReturnType<typeof setInterval> | null = null;

function updateClock() {
    const d = new Date();
    clock.value = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Reset index when items change length
watch(
    () => carouselItems.value.length,
    () => {
        carouselIndex.value = 0;
    },
);

const currentItem = computed(() => {
    const items = carouselItems.value;
    if (items.length === 0) return null;
    return items[carouselIndex.value % items.length];
});

onMounted(() => {
    carouselTimer = setInterval(() => {
        const len = carouselItems.value.length;
        if (len > 1) {
            carouselIndex.value = (carouselIndex.value + 1) % len;
        }
    }, 5000);
    updateClock();
    clockTimer = setInterval(updateClock, 15000);
});

onUnmounted(() => {
    if (carouselTimer) clearInterval(carouselTimer);
    if (clockTimer) clearInterval(clockTimer);
});
</script>

<template>
    <div class="capsule-idle relative w-full h-full overflow-hidden">
        <TransitionGroup
            tag="div"
            name="carousel"
            class="relative w-full h-full"
        >
            <div
                v-if="currentItem"
                :key="currentItem.key"
                class="absolute inset-0 flex items-center gap-2"
                :class="currentItem.type === 'motto' ? 'justify-center' : ''"
                :style="{
                    paddingLeft: '16px',
                    paddingRight: `calc(${rightInset}px * var(--island-scale, 1))`,
                }"
            >
                <!-- Task item -->
                <template v-if="currentItem.type === 'task'">
                    <span
                        v-if="currentItem.pomodoroCount && currentItem.pomodoroCount > 0"
                        class="text-[var(--idle-color)] shrink-0 opacity-70"
                        :style="{ fontSize: `calc(10px * var(--island-scale, 1))` }"
                    >
                        {{ "●".repeat(Math.min(currentItem.pomodoroCount, 3))
                        }}{{ currentItem.pomodoroCount > 3 ? "+" : "" }}
                    </span>
                    <span class="truncate flex-1 text-[var(--capsule-text)]" :style="{ fontSize: `calc(12px * var(--island-scale, 1))` }">{{
                        currentItem.text
                    }}</span>
                </template>
                <!-- Motto item -->
                <template v-else>
                    <span class="truncate text-[var(--capsule-text-dim)]" :style="{ fontSize: `calc(12px * var(--island-scale, 1))` }">{{
                        currentItem.text
                    }}</span>
                </template>
            </div>
        </TransitionGroup>

        <!-- 播放波形 + 时钟：同一组 flex 排列，波形不再压到时间上 -->
        <div class="idle-right">
            <div v-if="props.radioPlaying" class="wave-bars">
                <span class="wave-bar" />
                <span class="wave-bar" />
                <span class="wave-bar" />
            </div>
            <span class="idle-clock">{{ clock }}</span>
        </div>

        <!-- Dots indicator -->
        <div
            v-if="carouselItems.length > 1"
            class="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-1"
        >
            <div
                v-for="(item, i) in carouselItems"
                :key="item.key"
                class="w-1 h-1 rounded-full transition-colors duration-300"
                :class="
                    i === carouselIndex % carouselItems.length
                        ? 'bg-[var(--capsule-dot)]'
                        : 'bg-[var(--capsule-dot-idle)]'
                "
            />
        </div>
    </div>
</template>

<style scoped>
.idle-right {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    gap: calc(6px * var(--island-scale, 1));
    z-index: 2;
}
.idle-clock {
    font-size: calc(11px * var(--island-scale, 1));
    color: var(--capsule-text-dim);
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.04em;
}
.wave-bars {
    display: flex;
    align-items: flex-end;
    gap: calc(1.5px * var(--island-scale, 1));
    height: calc(11px * var(--island-scale, 1));
}

.wave-bar {
    width: calc(2px * var(--island-scale, 1));
    background: var(--focus-color);
    border-radius: 1px;
    opacity: 0.8;
    animation: wave-bounce 0.8s ease-in-out infinite;
}

.wave-bar:nth-child(1) {
    animation-delay: 0s;
}

.wave-bar:nth-child(2) {
    animation-delay: 0.15s;
}

.wave-bar:nth-child(3) {
    animation-delay: 0.3s;
}

@keyframes wave-bounce {
    0%, 100% { height: 30%; }
    50% { height: 100%; }
}

.carousel-enter-active,
.carousel-leave-active {
    transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
}
.carousel-enter-from {
    opacity: 0;
    transform: translateY(100%);
}
.carousel-leave-to {
    opacity: 0;
    transform: translateY(-100%);
}
</style>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { useTasks } from "../composables/useTasks";
import { useSettings } from "../composables/useSettings";

const { todayTasks } = useTasks();
const { settings } = useSettings()

defineProps<{ radioPlaying?: boolean }>();

const focusTasks = computed(() =>
    todayTasks.value
        .filter((t) => t.priority > 0)
        .sort((a, b) => a.priority - b.priority)
        .slice(0, 3),
);

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
    const tasks = focusTasks.value;
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
});

onUnmounted(() => {
    if (carouselTimer) clearInterval(carouselTimer);
});
</script>

<template>
    <div class="capsule-idle relative w-full h-full overflow-hidden">
        <div v-if="radioPlaying" class="wave-bars">
          <span class="wave-bar" />
          <span class="wave-bar" />
          <span class="wave-bar" />
        </div>
        <TransitionGroup
            tag="div"
            name="carousel"
            class="relative w-full h-full"
        >
            <div
                v-if="currentItem"
                :key="currentItem.key"
                class="absolute inset-0 flex items-center px-4 gap-2"
                :class="currentItem.type === 'motto' ? 'justify-center' : ''"
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
                    <span class="text-white/90 truncate flex-1" :style="{ fontSize: `calc(12px * var(--island-scale, 1))` }">{{
                        currentItem.text
                    }}</span>
                </template>
                <!-- Motto item -->
                <template v-else>
                    <span class="text-white/35 truncate" :style="{ fontSize: `calc(12px * var(--island-scale, 1))` }">{{
                        currentItem.text
                    }}</span>
                </template>
            </div>
        </TransitionGroup>

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
                        ? 'bg-white/40'
                        : 'bg-white/10'
                "
            />
        </div>
    </div>
</template>

<style scoped>
.wave-bars {
    position: absolute;
    right: calc(12px * var(--island-scale, 1));
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    align-items: flex-end;
    gap: calc(1.5px * var(--island-scale, 1));
    height: calc(11px * var(--island-scale, 1));
    z-index: 2;
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

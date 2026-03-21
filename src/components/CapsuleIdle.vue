<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useTasks } from "../composables/useTasks";
import { useSettings } from "../composables/useSettings";

const { todayTasks } = useTasks();
const { settings } = useSettings();

const carouselIndex = ref(0);
let carouselTimer: ReturnType<typeof setInterval> | null = null;

const displayTasks = computed(() => todayTasks.value.slice(0, 3));

const currentTask = computed(() => {
    if (displayTasks.value.length === 0) return null;
    return displayTasks.value[carouselIndex.value % displayTasks.value.length];
});

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

const mottoIndex = ref(Math.floor(Math.random() * DEFAULT_MOTTOS.length));
let mottoTimer: ReturnType<typeof setInterval> | null = null;

const currentMotto = computed(() => {
    const list = mottos.value;
    return list[mottoIndex.value % list.length];
});

onMounted(() => {
    carouselTimer = setInterval(() => {
        if (displayTasks.value.length > 1) {
            carouselIndex.value =
                (carouselIndex.value + 1) % displayTasks.value.length;
        }
    }, 5000);

    mottoTimer = setInterval(() => {
        mottoIndex.value = (mottoIndex.value + 1) % mottos.value.length;
    }, 8000);
});

onUnmounted(() => {
    if (carouselTimer) clearInterval(carouselTimer);
    if (mottoTimer) clearInterval(mottoTimer);
});
</script>

<template>
    <div class="relative w-full h-full overflow-hidden">
        <!-- Empty state: motto carousel -->
        <div
            v-if="displayTasks.length === 0"
            class="relative w-full h-full"
        >
            <TransitionGroup tag="div" name="carousel" class="relative w-full h-full">
                <div
                    :key="currentMotto"
                    class="absolute inset-0 flex items-center justify-center px-4"
                >
                    <span class="text-white/40 text-xs truncate">{{ currentMotto }}</span>
                </div>
            </TransitionGroup>
        </div>

        <!-- Task Carousel -->
        <TransitionGroup
            v-else
            tag="div"
            name="carousel"
            class="relative w-full h-full"
        >
            <div
                v-if="currentTask"
                :key="currentTask.id"
                class="absolute inset-0 flex items-center px-4 gap-2"
            >
                <!-- Pomodoro dots -->
                <span
                    v-if="currentTask.pomodoroCount > 0"
                    class="text-[var(--idle-color)] text-[10px] shrink-0 opacity-70"
                >
                    {{ "●".repeat(Math.min(currentTask.pomodoroCount, 3))
                    }}{{ currentTask.pomodoroCount > 3 ? "+" : "" }}
                </span>
                <!-- Title -->
                <span class="text-white/90 text-xs truncate flex-1">{{
                    currentTask.title
                }}</span>
            </div>
        </TransitionGroup>

        <!-- Dots indicator -->
        <div
            v-if="displayTasks.length > 1"
            class="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-1"
        >
            <div
                v-for="(_, i) in displayTasks"
                :key="i"
                class="w-1 h-1 rounded-full transition-colors duration-300"
                :class="
                    i === carouselIndex % displayTasks.length
                        ? 'bg-white/40'
                        : 'bg-white/10'
                "
            />
        </div>
    </div>
</template>

<style scoped>
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

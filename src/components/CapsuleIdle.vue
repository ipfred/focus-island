<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useTasks } from "../composables/useTasks";

const { activeTasks } = useTasks();

const carouselIndex = ref(0);
let carouselTimer: ReturnType<typeof setInterval> | null = null;

const displayTasks = computed(() => activeTasks.value.slice(0, 3));

const currentTask = computed(() => {
    if (displayTasks.value.length === 0) return null;
    return displayTasks.value[carouselIndex.value % displayTasks.value.length];
});

onMounted(() => {
    carouselTimer = setInterval(() => {
        if (displayTasks.value.length > 1) {
            carouselIndex.value =
                (carouselIndex.value + 1) % displayTasks.value.length;
        }
    }, 5000);
});

onUnmounted(() => {
    if (carouselTimer) clearInterval(carouselTimer);
});
</script>

<template>
    <div class="relative w-full h-full overflow-hidden">
        <!-- Empty state -->
        <div
            v-if="displayTasks.length === 0"
            class="flex items-center justify-center w-full h-full px-4"
        >
            <span class="text-white/30 text-xs">右键添加任务</span>
        </div>

        <!-- Carousel -->
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

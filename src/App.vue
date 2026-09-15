<script setup lang="ts">
import { computed, onMounted, watch } from "vue";
import AppFooter from "@/components/AppFooter.vue";
import AppHeader from "@/components/AppHeader.vue";
import { initStore, state } from "@/store/nezha";
import { readRuntimeConfig } from "@/utils/inject";

onMounted(() => {
  initStore();
  // 自定义代码注入前先读取一次，保证背景图等能尽快生效
  state.runtime = { ...state.runtime, ...readRuntimeConfig() };
});

watch(
  () => state.runtime.accentColor,
  (color) => {
    if (!color) return;
    document.documentElement.style.setProperty("--accent", color);
    document.documentElement.style.setProperty("--accent-2", color);
  },
  { immediate: true },
);

const backgroundImage = computed(() => state.runtime.backgroundImage);
const mobileBackgroundImage = computed(() => state.runtime.mobileBackgroundImage);
</script>

<template>
  <div class="app-shell">
    <div
      v-if="backgroundImage"
      class="app-bg app-bg--desktop"
      :style="{ backgroundImage: `url(${backgroundImage})` }"
    />
    <div
      v-if="mobileBackgroundImage"
      class="app-bg app-bg--mobile"
      :style="{ backgroundImage: `url(${mobileBackgroundImage})` }"
    />
    <div class="app-bg-mask" v-if="backgroundImage || mobileBackgroundImage" />

    <AppHeader />

    <main class="page">
      <router-view v-slot="{ Component }">
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
      <AppFooter />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-bg {
  position: fixed;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
}

.app-bg--mobile {
  display: none;
}

@media (max-width: 640px) {
  .app-bg--desktop {
    display: none;
  }
  .app-bg--mobile {
    display: block;
  }
}

.app-bg-mask {
  position: fixed;
  inset: 0;
  z-index: 1;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(4px);
}

.page {
  position: relative;
  z-index: 2;
  flex: 1;
}
</style>

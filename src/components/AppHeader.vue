<script setup lang="ts">
import { computed } from "vue";
import { isServerOnline } from "@/utils/format";
import { state } from "@/store/nezha";
import { theme, toggleTheme } from "@/store/theme";

const logoMark = computed(() =>
  state.runtime.logo ? "" : (state.siteName || "N").trim().charAt(0).toUpperCase(),
);

const onlineTotal = computed(() => {
  if (state.onlineCount) return state.onlineCount;
  return state.servers.filter((server) => isServerOnline(state.now, server)).length;
});

const total = computed(() => state.servers.length);

const updatedAt = computed(() => {
  if (!state.now) return "";
  const date = new Date(state.now);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
});

const wsLabel = computed(() => {
  if (state.wsConnected) return "实时";
  if (state.receivedOnce) return "重连中";
  return "连接中";
});
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <router-link to="/" class="brand" title="返回首页">
        <img
          v-if="state.runtime.logo"
          class="brand__logo"
          :src="state.runtime.logo"
          alt="logo"
        />
        <div v-else class="brand__logo">{{ logoMark }}</div>
        <div class="brand__text">
          <span class="brand__name">{{ state.siteName }}</span>
          <span class="brand__desc">{{ state.siteDesc || "Nezha Monitoring" }}</span>
        </div>
      </router-link>

      <div class="header-spacer" />

      <span class="chip header-status" :title="updatedAt ? `最后更新 ${updatedAt}` : ''">
        <i class="dot" :class="state.wsConnected ? 'dot--online' : 'dot--offline'" />
        <span class="num">{{ onlineTotal }}/{{ total }}</span>
        <span class="header-status__sep">·</span>
        <span>{{ wsLabel }}</span>
      </span>

      <a
        v-if="state.runtime.showAdmin"
        class="icon-btn admin-entry"
        href="/dashboard"
        title="进入管理面板"
      >
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 3 15H2.8a2 2 0 1 1 0-4H3a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 10 4.1V4a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.7 1.7 0 0 0 20.9 11h.1a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
        </svg>
        <span class="admin-entry__text">管理</span>
      </a>

      <button class="icon-btn" type="button" :title="theme === 'dark' ? '切换浅色' : '切换深色'" @click="toggleTheme">
        <svg v-if="theme === 'dark'" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        <svg v-else width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </button>
    </div>
  </header>
</template>

<style scoped>
.header-status {
  gap: 6px;
}

.header-status__sep {
  color: var(--text-faint);
}

.brand {
  padding: 4px 9px 4px 4px;
  margin-left: -4px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.18s ease;
}

.brand:hover {
  background: var(--accent-soft);
}

.brand:active {
  background: color-mix(in srgb, var(--accent) 22%, transparent);
}

.admin-entry {
  width: auto;
  padding: 0 11px;
  gap: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.admin-entry__text {
  font-size: 12.5px;
  font-weight: 550;
}

.admin-entry:hover {
  color: var(--accent);
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
}

@media (max-width: 640px) {
  .header-status__sep,
  .header-status span:last-child {
    display: none;
  }
}

@media (max-width: 560px) {
  .admin-entry {
    width: 34px;
    padding: 0;
  }
  .admin-entry__text {
    display: none;
  }
}
</style>

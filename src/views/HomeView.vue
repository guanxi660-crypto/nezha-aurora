<script setup lang="ts">
import { computed, ref } from "vue";
import FilterBar from "@/components/FilterBar.vue";
import OverviewStats from "@/components/OverviewStats.vue";
import ServerCard from "@/components/ServerCard.vue";
import WorldMap from "@/components/WorldMap.vue";
import { state, visibleServers } from "@/store/nezha";

type ViewMode = "grid" | "map";

const VIEW_KEY = "aurora-view";

function detectView(): ViewMode {
  if (state.runtime.forceShowMap) return "map";
  try {
    const stored = localStorage.getItem(VIEW_KEY);
    if (stored === "map" || stored === "grid") return stored;
  } catch {
    /* ignore */
  }
  return "grid";
}

const view = ref<ViewMode>(detectView());

function setView(next: ViewMode) {
  view.value = next;
  try {
    localStorage.setItem(VIEW_KEY, next);
  } catch {
    /* ignore */
  }
}

const loading = computed(() => !state.receivedOnce && !state.siteError);
</script>

<template>
  <div>
    <div v-if="loading" class="state-block">
      <span class="spinner" />
      <p>正在连接哪吒后端…</p>
      <p style="font-size: 12px; color: var(--text-faint)">
        如果长时间没有响应，请确认反向代理已把 <code>/api/v1</code> 转发到面板。
      </p>
    </div>

    <div v-else-if="state.siteError && !state.receivedOnce" class="state-block">
      <p style="font-weight: 600; color: var(--danger)">无法读取站点信息</p>
      <p style="font-size: 12.5px">{{ state.siteError }}</p>
      <p style="font-size: 12px; color: var(--text-faint)">
        请检查反向代理、面板是否开启了强制登录（force_auth）。
      </p>
    </div>

    <template v-else>
      <OverviewStats />

      <FilterBar />

      <section class="home-toolbar">
        <div class="seg">
          <button
            type="button"
            :class="{ 'is-active': view === 'grid' }"
            @click="setView('grid')"
          >
            卡片视图
          </button>
          <button
            type="button"
            :class="{ 'is-active': view === 'map' }"
            @click="setView('map')"
          >
            世界地图
          </button>
        </div>
      </section>

      <section v-if="view === 'map'" class="extra-body">
        <WorldMap :items="visibleServers" />
      </section>

      <section v-else class="server-grid">
        <ServerCard
          v-for="item in visibleServers"
          :key="item.server.id"
          :server="item.server"
          :online="item.online"
        />
      </section>

      <div v-if="!visibleServers.length" class="state-block" style="min-height: 200px">
        <p>没有匹配的节点</p>
      </div>
    </template>
  </div>
</template>

<style scoped>
.home-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 16px;
}

.extra-body {
  margin-top: 12px;
}
</style>

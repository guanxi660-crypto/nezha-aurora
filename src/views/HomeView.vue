<script setup lang="ts">
import { computed, ref } from "vue";
import CycleTransferPanel from "@/components/CycleTransferPanel.vue";
import FilterBar from "@/components/FilterBar.vue";
import OverviewStats from "@/components/OverviewStats.vue";
import ServerCard from "@/components/ServerCard.vue";
import ServicePanel from "@/components/ServicePanel.vue";
import { state, visibleServers } from "@/store/nezha";

type ExtraPanel = "none" | "services" | "cycle";

const extraPanel = ref<ExtraPanel>(
  state.runtime.forceShowServices ? "services" : "none",
);

const hasServices = computed(() => Object.keys(state.services || {}).length > 0);
const hasCycle = computed(() => Object.keys(state.cycleTransfer || {}).length > 0);

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

      <section v-if="hasServices || hasCycle" class="extra-tabs">
        <div class="seg">
          <button
            v-if="hasServices"
            type="button"
            :class="{ 'is-active': extraPanel === 'services' }"
            @click="extraPanel = extraPanel === 'services' ? 'none' : 'services'"
          >
            服务监控
          </button>
          <button
            v-if="hasCycle"
            type="button"
            :class="{ 'is-active': extraPanel === 'cycle' }"
            @click="extraPanel = extraPanel === 'cycle' ? 'none' : 'cycle'"
          >
            周期流量
          </button>
        </div>
      </section>

      <section v-if="extraPanel === 'services' && hasServices" class="extra-body">
        <ServicePanel :services="state.services" />
      </section>

      <section v-if="extraPanel === 'cycle' && hasCycle" class="extra-body">
        <CycleTransferPanel :stats="state.cycleTransfer" />
      </section>

      <section class="server-grid">
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
.extra-tabs {
  margin-top: 16px;
}

.extra-body {
  margin-top: 12px;
}
</style>

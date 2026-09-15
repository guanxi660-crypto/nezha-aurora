<script setup lang="ts">
import { state } from "@/store/nezha";
import type { SortKey, StatusFilter } from "@/store/nezha";

const statusOptions: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "online", label: "在线" },
  { key: "offline", label: "离线" },
];

const sortOptions: { key: SortKey; label: string }[] = [
  { key: "default", label: "默认排序" },
  { key: "name", label: "名称" },
  { key: "cpu", label: "CPU 占用" },
  { key: "mem", label: "内存占用" },
  { key: "disk", label: "磁盘占用" },
  { key: "up", label: "上行速率" },
  { key: "down", label: "下行速率" },
  { key: "uptime", label: "运行时长" },
];

function setStatus(status: StatusFilter) {
  state.filter.status = status;
}
</script>

<template>
  <section class="filter-bar">
    <div class="seg">
      <button
        v-for="option in statusOptions"
        :key="option.key"
        type="button"
        :class="{ 'is-active': state.filter.status === option.key }"
        @click="setStatus(option.key)"
      >
        {{ option.label }}
      </button>
    </div>

    <div class="sort-group">
      <select v-model="state.filter.sortKey" class="select" aria-label="排序方式">
        <option v-for="option in sortOptions" :key="option.key" :value="option.key">
          {{ option.label }}
        </option>
      </select>
      <button
        class="icon-btn"
        type="button"
        :disabled="state.filter.sortKey === 'default'"
        :title="state.filter.sortAsc ? '升序' : '降序'"
        @click="state.filter.sortAsc = !state.filter.sortAsc"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          :style="{ transform: state.filter.sortAsc ? 'rotate(180deg)' : 'none', transition: 'transform .18s ease' }"
        >
          <path d="M12 5v14M19 12l-7 7-7-7" />
        </svg>
      </button>
    </div>

    <label class="search-box">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.2-3.2" />
      </svg>
      <input v-model="state.filter.keyword" type="search" placeholder="搜索节点 / 系统" />
    </label>
  </section>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-top: 16px;
}

.filter-bar .search-box {
  flex: 1 1 190px;
  width: auto;
  max-width: 340px;
  /* 节点数标签移除后，让搜索框贴右侧，避免中间留下大片空白 */
  margin-left: auto;
}

.sort-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.icon-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
}

@media (max-width: 640px) {
  .filter-bar .search-box {
    order: 3;
    flex: 1 1 100%;
    max-width: none;
  }
}
</style>

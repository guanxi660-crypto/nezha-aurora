<script setup lang="ts">
import { computed } from "vue";
import { getFontLogoClass } from "@/utils/format";

const props = defineProps<{ platform?: string }>();

const isWindows = computed(() => (props.platform || "").toLowerCase().includes("windows"));
const logoClass = computed(() => `fl-${getFontLogoClass(props.platform)}`);
</script>

<template>
  <svg
    v-if="isWindows"
    class="os-icon"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      d="M2.75 7.189V2.865c0-.102 0-.115.115-.115h8.622c.128 0 .14 0 .14.128V11.5c0 .128 0 .128-.14.128H2.865c-.102 0-.115 0-.115-.116zM7.189 21.25H2.865c-.102 0-.115 0-.115-.116V12.59c0-.128 0-.128.128-.128h8.635c.102 0 .115 0 .115.115v8.57c0 .09 0 .103-.116.103zM21.25 7.189v4.31c0 .116 0 .116-.116.116h-8.557c-.102 0-.128 0-.128-.115V2.865c0-.09 0-.102.115-.102h8.48c.206 0 .206 0 .206.205zm-8.763 9.661v-4.273c0-.09 0-.115.103-.09h8.621c.026 0 0 .09 0 .142v8.518a.06.06 0 0 1-.06.06H12.54s-.09 0-.077-.09z"
    />
  </svg>
  <i v-else class="os-icon" :class="logoClass" aria-hidden="true" />
</template>

<style scoped>
.os-icon {
  font-size: 12px;
  line-height: 1;
  color: var(--text-faint);
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
}
</style>

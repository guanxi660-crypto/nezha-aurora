<script setup lang="ts">
import { computed } from "vue";
import { state } from "@/store/nezha";

const links = computed(() => state.runtime.links || []);
const footerText = computed(() => state.runtime.footerText || "");
const year = new Date().getFullYear();
</script>

<template>
  <footer class="app-footer">
    <span v-if="footerText">{{ footerText }}</span>
    <span v-else>
      Powered by
      <a href="https://github.com/nezhahq/nezha" target="_blank" rel="noreferrer noopener">
        Nezha Monitoring
      </a>
      · Theme Aurora
      <template v-if="state.version"> · {{ state.version }}</template>
    </span>
    <span class="app-footer__links">
      <a
        v-for="item in links"
        :key="item.name + item.link"
        :href="item.link"
        target="_blank"
        rel="noreferrer noopener"
      >
        {{ item.name }}
      </a>
      <span class="num">© {{ year }}</span>
    </span>
  </footer>
</template>

<style scoped>
.app-footer__links {
  display: inline-flex;
  align-items: center;
  gap: 14px;
}
</style>

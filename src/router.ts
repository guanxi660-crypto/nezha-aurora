import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";

const routes: RouteRecordRaw[] = [
  {
    path: "/",
    name: "home",
    component: () => import("./views/HomeView.vue"),
  },
  {
    path: "/server/:id",
    name: "server-detail",
    component: () => import("./views/ServerDetailView.vue"),
    props: (route) => ({ id: Number(route.params.id) }),
  },
  {
    path: "/:pathMatch(.*)*",
    name: "not-found",
    component: () => import("./views/NotFoundView.vue"),
  },
];

// 由应用自己接管滚动恢复：浏览器默认的自动恢复会和 Router 的恢复打架，
// 在 SPA 里往往表现为返回后跳到错误位置。
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

/**
 * 恢复滚动位置。
 *
 * 目标页面是懒加载组件，导航发生时 DOM 可能还没渲染出足够高度，
 * 此时直接 scrollTo 会被浏览器夹到「当前最大可滚动位置」（看起来像跳到底部）。
 * 这里在若干帧内持续尝试，直到位置到位、页面高度稳定或超时。
 */
function restoreScroll(position: { left: number; top: number }): Promise<false> {
  const TIMEOUT_MS = 1500;
  const STABLE_FRAMES_REQUIRED = 12;

  return new Promise((resolve) => {
    const startedAt = performance.now();
    let lastMaxScroll = -1;
    let stableFrames = 0;

    const step = () => {
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );

      if (maxScroll === lastMaxScroll) stableFrames += 1;
      else stableFrames = 0;
      lastMaxScroll = maxScroll;

      window.scrollTo(position.left, Math.min(position.top, maxScroll));

      const reached = Math.abs(window.scrollY - position.top) < 2;
      const timedOut = performance.now() - startedAt > TIMEOUT_MS;
      // 只有「页面已经足够高」时，才允许因高度稳定而提前结束；
      // 高度不足时（列表还在渲染）必须一直重试，否则会被夹在页面底部。
      const settled = maxScroll >= position.top && stableFrames >= STABLE_FRAMES_REQUIRED;

      if (reached || settled || timedOut) {
        resolve(false);
        return;
      }
      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  });
}

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior(to, from, savedPosition) {
    if (savedPosition) return restoreScroll(savedPosition);
    if (to.hash) return { el: to.hash, behavior: "smooth" };
    return { top: 0 };
  },
});

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

// 由应用自己接管滚动恢复：浏览器默认的自动恢复会和 Router 的恢复打架。
if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

const STORAGE_KEY = "aurora-scroll-positions";

/**
 * 自行记录每个路由离开时的滚动位置。
 *
 * 不能依赖 scrollBehavior 的 savedPosition：在懒加载页面下它可能返回
 * 上一个页面（当前页面）的位置，导致返回时位置明显不对。
 */
const scrollPositions = new Map<string, number>();

function loadPositions() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof value === "number") scrollPositions.set(key, value);
      }
    }
  } catch {
    /* 忽略存储异常 */
  }
}

function persistPositions() {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Object.fromEntries(scrollPositions)),
    );
  } catch {
    /* 忽略存储异常 */
  }
}

loadPositions();

/**
 * 恢复滚动位置，并在窗口期内持续校正。
 *
 * 页面渲染完成后，可能还有其它机制把视口甩到别处（实测会直接跳到页面底部），
 * 因此这里不能「一到目标位置就退出」，而要等到「位置正确 + 高度稳定」才结束。
 */
function restoreScroll(position: { left: number; top: number }, targetPath: string): Promise<false> {
  const TIMEOUT_MS = 1500;
  /** 目标页渲染完成后，仍需保持约 500ms 的校正窗口，以覆盖延迟发生的视口跳动 */
  const STABLE_FRAMES_REQUIRED = 30;

  return new Promise((resolve) => {
    const startedAt = performance.now();
    let lastHeight = -1;
    let stableFrames = 0;

    const step = () => {
      const timedOut = performance.now() - startedAt > TIMEOUT_MS;
      // 目标页面尚未渲染完成时不要计时，否则会误判“高度已稳定”而提前退出
      const onTargetRoute = router.currentRoute.value.fullPath === targetPath;

      if (onTargetRoute) {
        const height = document.documentElement.scrollHeight;
        const maxScroll = Math.max(0, height - window.innerHeight);
        const target = Math.min(position.top, maxScroll);

        if (Math.abs(window.scrollY - target) > 2) {
          window.scrollTo(position.left, target);
        }

        if (height === lastHeight) stableFrames += 1;
        else stableFrames = 0;
        lastHeight = height;

        const correct = Math.abs(window.scrollY - target) < 2;
        if ((correct && stableFrames >= STABLE_FRAMES_REQUIRED) || timedOut) {
          resolve(false);
          return;
        }
      } else {
        stableFrames = 0;
        lastHeight = -1;
        if (timedOut) {
          resolve(false);
          return;
        }
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
    // 只处理「前进 / 后退」，普通跳转一律回到顶部
    if (savedPosition) {
      const remembered = scrollPositions.get(to.fullPath);
      return restoreScroll({ left: 0, top: remembered ?? savedPosition.top }, to.fullPath);
    }
    if (to.hash) return { el: to.hash, behavior: "smooth" };
    return { top: 0 };
  },
});

router.beforeEach((to, from) => {
  if (from.fullPath && from.fullPath !== to.fullPath) {
    scrollPositions.set(from.fullPath, window.scrollY);
    persistPositions();
  }
  return true;
});

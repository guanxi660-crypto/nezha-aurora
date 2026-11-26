import { ref } from "vue";

/**
 * 可选的管理员访问令牌。
 *
 * 哪吒 V2 会按访问者身份裁剪 Host 字段（见后端 `model.Host.Filter`）：
 * 访客拿不到系统版本 `platform_version`、Agent 版本 `version`、`gpu`；
 * 只有以管理员身份访问时才会下发完整数据。
 *
 * 由于浏览器 WebSocket 无法自定义请求头，后端额外接受 `?token=<JWT>`
 * 查询参数（见 `controller/jwt.go` 的 TokenLookup），HTTP 接口则同时
 * 支持 `Authorization: Bearer` 与同域 `nz-jwt` cookie。
 *
 * 因此这里支持三种来源，优先级从高到低：
 * 1. `?token=xxx`（写入本地后立即从地址栏抹除）
 * 2. 本地已保存的令牌
 * 3. 什么都不配置 —— 行为与普通访客完全一致
 */
const STORAGE_KEY = "aurora-access-token";

function readInitialToken(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("token");

    // 只要 URL 里出现过 token 参数就立刻抹除，空值也不留在地址栏（BJ）
    if (params.has("token")) {
      params.delete("token");
      const rest = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`,
      );
    }

    // 空 token 不写入存储，避免后续请求附带无效令牌
    if (fromQuery) {
      window.localStorage.setItem(STORAGE_KEY, fromQuery);
      return fromQuery;
    }

    return window.localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export const accessToken = ref(readInitialToken());

export function clearAccessToken() {
  accessToken.value = "";
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  // 令牌被撤销/过期时留一条可观测提示；面向用户的 UI 提示由组件层负责（BH）
  console.info("[Aurora] 访问令牌已清除，将以访客身份继续（部分系统字段可能不可用）");
}

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

    if (fromQuery) {
      window.localStorage.setItem(STORAGE_KEY, fromQuery);
      // 令牌留在地址栏会进入浏览历史与 Referer，保存后马上移除
      params.delete("token");
      const rest = params.toString();
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`,
      );
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
}

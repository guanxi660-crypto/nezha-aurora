import { createApp } from "vue";
import App from "./App.vue";
import { router } from "./router";
import "./styles/global.css";

const app = createApp(App);
// 组件渲染/生命周期错误统一留痕，避免线上静默白屏（AY）
app.config.errorHandler = (err, _vm, info) => {
  console.error("[Aurora]", err, info);
};
app.use(router).mount("#app");

import { createApp, createSSRApp } from "vue";
import { createWebHistory } from "vue-router";
import "@fontsource/inter-tight/latin-400.css";
import "@fontsource/inter-tight/latin-500.css";
import "@fontsource/inter-tight/latin-600.css";
import "@fontsource/inter-tight/latin-700.css";
import "@fontsource/newsreader/latin-400.css";
import "@fontsource/newsreader/latin-500.css";
import "@fontsource/newsreader/latin-600.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./style.css";
import "bootstrap";
import App from "./App.vue";
import {
  createWebsiteRouter,
  installBrowserRouterHooks,
} from "./router";
import { initializeAnalytics } from "./services/analytics";

const router = createWebsiteRouter(createWebHistory());
installBrowserRouterHooks(router);

const hasPrerenderedContent = document.querySelector("#app")?.hasChildNodes();
const app = hasPrerenderedContent ? createSSRApp(App) : createApp(App);
app.use(router);

router.isReady().then(() => {
  app.mount("#app");
  initializeAnalytics();
});

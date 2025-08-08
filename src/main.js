import { createApp } from "vue";
import VueMeta from "vue-meta";
import "./style.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import router from "./router";
import App from "./App.vue";

createApp(App)
  .use(router)
  .use(VueMeta, {
    refreshOnceOnNavigation: true,
  })
  .mount("#app");

import { createApp } from "vue";
import { createMetaManager } from "vue-meta";
import "./style.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap";
import "bootstrap-icons/font/bootstrap-icons.css";
import router from "./router";
import App from "./App.vue";

createApp(App)
  .use(router)
  .use(createMetaManager())
  .mount("#app");

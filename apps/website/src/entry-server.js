import { createSSRApp } from "vue";
import { renderToString } from "@vue/server-renderer";
import { createMemoryHistory } from "vue-router";
import App from "./App.vue";
import { createWebsiteRouter, prerenderPaths } from "./router";
import { renderRouteHead, resolveRouteMeta } from "./utils/head";

export { prerenderPaths };

export async function render(url) {
  const router = createWebsiteRouter(createMemoryHistory());
  const app = createSSRApp(App);
  app.use(router);

  await router.push(url);
  await router.isReady();

  const route = router.currentRoute.value;
  return {
    appHtml: await renderToString(app),
    headHtml: renderRouteHead(route),
    meta: resolveRouteMeta(route),
    route: {
      name: route.name,
      path: route.path,
    },
  };
}

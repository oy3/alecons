<script setup>
import SiteHeader from "./components/Header.vue";
import SiteFooter from "./components/Footer.vue";
</script>

<template>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <SiteHeader />
  <main id="main-content" tabindex="-1" :class="{ 'main--header-overlay': $route.meta.overlayHeader }">
    <RouterView v-slot="{ Component, route }">
      <Transition name="route" mode="out-in">
        <div :key="route.fullPath" class="route-page"><component :is="Component" /></div>
      </Transition>
    </RouterView>
  </main>
  <SiteFooter />
</template>

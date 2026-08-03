<script setup>
import Breadcrumbs from "./Breadcrumbs.vue";
import heroImage from "../assets/img/campus/academic-block.jpg";

defineProps({ eyebrow: { type: String, default: "" }, title: { type: String, required: true }, description: { type: String, default: "" }, breadcrumbs: { type: Array, default: () => [] }, image: { type: String, default: "" } });
</script>

<template>
  <section class="page-hero" :style="{ '--page-hero-image': `url(${image || heroImage})` }">
    <div class="site-container page-hero__inner">
      <Breadcrumbs :items="breadcrumbs" inverse />
      <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
      <h1>{{ title }}</h1>
      <p v-if="description" class="page-hero__description">{{ description }}</p>
      <slot />
    </div>
  </section>
</template>

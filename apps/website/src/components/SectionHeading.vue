<script setup>
defineProps({ eyebrow: { type: String, default: "" }, title: { type: String, required: true }, description: { type: String, default: "" }, centered: Boolean, inverse: Boolean });
</script>

<template>
  <header class="section-heading" :class="{ 'section-heading--centered': centered, 'section-heading--inverse': inverse }">
    <p v-if="eyebrow" class="eyebrow">{{ eyebrow }}</p>
    <h2>{{ title }}</h2>
    <p v-if="description" class="section-heading__description">{{ description }}</p>
  </header>
</template>

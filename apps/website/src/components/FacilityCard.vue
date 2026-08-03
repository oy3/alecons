<script setup>
defineProps({ facility: { type: Object, required: true }, featured: Boolean });
</script>

<template>
  <article class="facility-card" :class="{ 'facility-card--featured': featured }">
    <img :src="facility.image" :alt="facility.title" width="640" height="420" loading="lazy" />
    <div><h3>{{ facility.title }}</h3><p>{{ facility.description }}</p></div>
  </article>
</template>

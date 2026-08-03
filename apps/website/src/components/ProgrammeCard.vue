<script setup>
defineProps({ programme: { type: Object, required: true } });
</script>

<template>
  <article class="programme-card">
    <div class="programme-card__media">
      <img :src="programme.image" :alt="`${programme.name} learning environment`" width="600" height="390" loading="lazy" />
      <span class="status-label" :class="`status-label--${programme.status}`">{{ programme.statusLabel }}</span>
    </div>
    <div class="programme-card__body">
      <h3>{{ programme.name }}</h3>
      <dl class="programme-card__facts">
        <div><dt>Award</dt><dd>{{ programme.award }}</dd></div>
        <div v-if="programme.duration"><dt>Duration</dt><dd>{{ programme.duration }}</dd></div>
      </dl>
      <p>{{ programme.description }}</p>
      <RouterLink :to="`/programs/${programme.slug}`" class="text-link" :aria-label="`Learn more about ${programme.name}`">
        Learn more <i class="bi bi-arrow-right" aria-hidden="true"></i>
      </RouterLink>
    </div>
  </article>
</template>

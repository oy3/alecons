<script setup>
defineProps({ items: { type: Array, default: () => [] }, inverse: Boolean });
</script>

<template>
  <nav class="breadcrumbs" :class="{ 'breadcrumbs--inverse': inverse }" aria-label="Breadcrumb">
    <ol>
      <li><RouterLink to="/">Home</RouterLink></li>
      <li v-for="item in items" :key="item.label" :aria-current="item.to ? undefined : 'page'">
        <RouterLink v-if="item.to" :to="item.to">{{ item.label }}</RouterLink>
        <span v-else>{{ item.label }}</span>
      </li>
    </ol>
  </nav>
</template>

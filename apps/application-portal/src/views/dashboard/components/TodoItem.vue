<script>
export default {
  name: "TodoItem",
  props: { item: Object }
};
</script>

<template>
  <div class="col-4 card bg-light border-0 p-0">
    <div class="card-body">
      <h6 class="card-title">{{ item.title }}</h6>
      <p class="card-text text-muted small">{{ item.description }}</p>
    </div>
  </div>
</template>
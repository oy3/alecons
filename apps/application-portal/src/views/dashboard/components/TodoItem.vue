<script>
export default {
  name: "TodoItem",
  props: { item: Object },
};
</script>

<template>

  <div 
    class="col-4 p-0 card border-0"
    :class="{
      'completed-stage': item.status === 'completed',
      'active-stage text-primary-emphasis bg-primary-subtle shadow-sm': item.status === 'active',
      'inactive-stage text-muted': item.status === 'inactive'
    }"
  >
    <div class="card-body">
      <h6
        class="card-title"
        :class="{ 'text-decoration-line-through text-muted': item.status === 'completed' }"
      >
        {{ item.title }}
      </h6>
      <p
        class="card-text small mb-0"
        :class="{ 'text-decoration-line-through text-muted': item.status === 'completed' }"
      >
        {{ item.description }}
      </p>
    </div>
  </div>

</template>

<style scoped>
/* completed */
.completed-stage {
  background-color: #f8f9fa; /* Bootstrap light bg */
  opacity: 0.6;
  cursor: not-allowed;
}

/* active */
.active-stage {
  /* background-color: #0d6efd; */
  /* color: #fff; */
  /* box-shadow: 0 .125rem .25rem rgba(13, 110, 253, 0.25); */
}

/* inactive */
.inactive-stage {
  background-color: #e9ecef;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
}
.inactive-stage:hover {
  background-color: #dee2e6;
}

</style>
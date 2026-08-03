<script>
export default {
  name: "TodoItem",
  props: {
    item: { type: Object, required: true },
  },
  computed: {
    statusClass() {
      if (this.item.status === "completed") {
        return "bg-light border-success-subtle";
      }
      if (this.item.status === "active" && this.item.paymentStage) {
        return "bg-warning-subtle border-warning-subtle";
      }
      if (this.item.status === "active") {
        return "bg-primary-subtle border-primary-subtle";
      }
      return "bg-body-tertiary border-light";
    },
    statusIcon() {
      if (this.item.status === "completed") return "bi-check-circle-fill text-success";
      if (this.item.status === "active" && this.item.paymentStage) {
        return "bi-credit-card text-warning-emphasis";
      }
      if (this.item.status === "active") return "bi-play-circle-fill text-primary";
      return "bi-circle text-secondary";
    },
  },
};
</script>

<template>
  <article
    class="todo-item card p-0 border shadow-sm"
    :class="statusClass"
    role="listitem"
    :aria-current="item.status === 'active' ? 'step' : undefined"
  >
    <div class="card-body d-flex flex-column p-3">
      <div class="d-flex justify-content-between align-items-start gap-3 mb-3">
        <h6
          class="card-title mb-0 lh-sm"
          :class="{
            'text-decoration-line-through text-muted':
              item.status === 'completed',
          }"
        >
          {{ item.title }}
        </h6>
        <i :class="['bi', statusIcon, 'fs-5', 'flex-shrink-0']" aria-hidden="true"></i>
      </div>

      <p
        class="card-text small mb-0 text-body-secondary"
        :class="{
          'text-decoration-line-through': item.status === 'completed',
        }"
      >
        {{ item.description }}
      </p>
    </div>
  </article>
</template>

<style scoped>
.todo-item {
  flex: 0 0 13.75rem !important;
  width: 13.75rem;
  min-width: 13.75rem;
  max-width: 13.75rem;
  min-height: 9.5rem;
  scroll-snap-align: start;
}

@media (max-width: 575.98px) {
  .todo-item {
    flex-basis: 13.75rem !important;
    width: 13.75rem;
    min-width: 13.75rem;
    max-width: 13.75rem;
  }
}
</style>

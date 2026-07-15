<script>
import TodoItem from "./TodoItem.vue";

export default {
  name: "TodoList",
  components: { TodoItem },
  props: {
    todos: { type: Array, default: () => [] },
    locked: { type: Boolean, default: false },
  },
  data() {
    return {
      canScrollLeft: false,
      canScrollRight: false,
    };
  },
  mounted() {
    this.$nextTick(this.updateScrollState);
    window.addEventListener("resize", this.updateScrollState);
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.updateScrollState);
  },
  methods: {
    scrollByCard(direction) {
      const container = this.$refs.todoContainer;
      if (!container) return;

      const card = container.querySelector(".todo-item");
      const distance = card ? card.offsetWidth + 12 : 240;
      container.scrollBy({ left: direction * distance, behavior: "smooth" });
    },
    updateScrollState() {
      const container = this.$refs.todoContainer;
      if (!container) return;

      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      this.canScrollLeft = container.scrollLeft > 1;
      this.canScrollRight = container.scrollLeft < maxScrollLeft - 1;
    },
  },
};
</script>

<template>
  <section class="todo-list" aria-labelledby="todo-heading">
    <div class="d-flex align-items-center justify-content-between gap-3 mb-3">
      <h3 id="todo-heading" class="h5 mb-0">Your To-do</h3>
      <div
        v-if="canScrollLeft || canScrollRight"
        class="d-flex align-items-center gap-1"
        aria-label="To-do list navigation"
      >
        <button
          type="button"
          class="btn btn-sm btn-acon-secondary todo-scroll-control"
          :disabled="!canScrollLeft"
          aria-label="Show previous to-do items"
          @click="scrollByCard(-1)"
        >
          <i class="bi bi-chevron-left" aria-hidden="true"></i>
        </button>
        <button
          type="button"
          class="btn btn-sm btn-acon-secondary todo-scroll-control"
          :disabled="!canScrollRight"
          aria-label="Show next to-do items"
          @click="scrollByCard(1)"
        >
          <i class="bi bi-chevron-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <div
      ref="todoContainer"
      class="todo-track"
      role="list"
      aria-label="Application to-do items"
      @scroll="updateScrollState"
    >
      <TodoItem
        v-for="(item, index) in todos"
        :key="index"
        :item="locked ? { ...item, status: 'inactive' } : item"
      />
    </div>
  </section>
</template>

<style scoped>
.todo-list {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
}

.todo-track {
  display: flex;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  gap: 0.75rem;
  overflow-x: auto;
  overflow-y: hidden;
  box-sizing: border-box;
  padding: 0.25rem 0 0.75rem;
  scroll-behavior: smooth;
  scroll-padding-inline: 0.25rem;
  scroll-snap-type: x mandatory;
  scrollbar-width: thin;
  scrollbar-color: var(--bs-secondary-color) var(--bs-tertiary-bg);
}

.todo-track::-webkit-scrollbar {
  height: 0.375rem;
}

.todo-track::-webkit-scrollbar-track {
  background: var(--bs-tertiary-bg);
}

.todo-track::-webkit-scrollbar-thumb {
  background: var(--bs-secondary-color);
  border-radius: var(--bs-border-radius-pill);
}

.todo-scroll-control {
  width: 2rem;
  height: 2rem;
  padding: 0;
}

@media (max-width: 575.98px) {
  .todo-track {
    padding-bottom: 0.625rem;
  }
}
</style>

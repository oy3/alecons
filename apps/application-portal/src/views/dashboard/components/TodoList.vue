<script>
import TodoItem from "./TodoItem.vue";

export default {
  name: "TodoList",
  components: { TodoItem },
  props: { todos: Array },
  data() {
    return { showArrows: false };
  },
  mounted() {
    this.checkScroll();
    window.addEventListener("resize", this.checkScroll);
  },
  beforeUnmount() {
    window.removeEventListener("resize", this.checkScroll);
  },
  methods: {
    scrollLeft() {
      this.$refs.todoContainer.scrollBy({ left: -250, behavior: "smooth" });
    },
    scrollRight() {
      this.$refs.todoContainer.scrollBy({ left: 250, behavior: "smooth" });
    },
    checkScroll() {
      const el = this.$refs.todoContainer;
      if (el) this.showArrows = el.scrollWidth > el.clientWidth;
    },
  },
};
</script>

<template>
  <div>
    <h3>Your To-do</h3>
    <hr />

    <div class="overflow-hidden">
      <div
        ref="todoContainer"
        class="d-flex flex-nowrap overflow-x-auto py-2 todo-container"
        style="scrollbar-width: thin; gap:1rem;"
      >
        <TodoItem v-for="(item, index) in todos" :key="index" :item="item" />
      </div>
    </div>

    <div class="d-flex justify-content-end mt-3" v-if="showArrows">
      <button class="btn btn-outline-acon-primary me-2" @click="scrollLeft">
        <i class="bi bi-chevron-left"></i>
      </button>
      <button class="btn btn-outline-acon-primary" @click="scrollRight">
        <i class="bi bi-chevron-right"></i>
      </button>
    </div>
  </div>
</template>

<style scoped>

@media screen and (max-width: 768px) {
  .todo-container {
    width: 90vw;
  }
    
  }
/* Thin scrollbar */
.todo-container {
  scrollbar-width: thin;
  scrollbar-color: #6c757d #e9ecef;
}

.todo-container::-webkit-scrollbar {
  height: 6px;
}

.todo-container::-webkit-scrollbar-track {
  background: #e9ecef;
  border-radius: 3px;
}

.todo-container::-webkit-scrollbar-thumb {
  background: #6c757d;
  border-radius: 3px;
}

.todo-container::-webkit-scrollbar-thumb:hover {
  background: #495057;
}
</style>

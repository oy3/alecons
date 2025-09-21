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
    }
  }
};
</script>

<template>
  <div>
    <h3>Your To-do</h3>
    <hr />
    <div ref="todoContainer" class="row flex-nowrap gap-3 overflow-x-scroll py-2">
      <TodoItem v-for="(item, index) in todos" :key="index" :item="item" />
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

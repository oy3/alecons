<script setup>
import { onBeforeUnmount, onMounted, ref } from "vue";

defineProps({ delay: { type: Number, default: 0 } });
const root = ref(null);
let observer;

onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.value?.classList.add("is-visible");
    return;
  }
  observer = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px" },
  );
  if (root.value) observer.observe(root.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div ref="root" class="reveal" :style="{ '--reveal-delay': `${delay}ms` }"><slot /></div>
</template>

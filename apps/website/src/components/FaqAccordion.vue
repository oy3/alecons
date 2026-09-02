<script setup>
import { ref } from "vue";
defineProps({ items: { type: Array, required: true } });
const openIndex = ref(0);
const toggle = (index) => { openIndex.value = openIndex.value === index ? -1 : index; };
</script>

<template>
  <div class="faq-list">
    <div v-for="(item, index) in items" :key="item.question" class="faq-item">
      <h3>
        <button type="button" :aria-expanded="openIndex === index" :aria-controls="`faq-panel-${index}`" @click="toggle(index)">
          {{ item.question }}<i class="bi bi-plus-lg" aria-hidden="true"></i>
        </button>
      </h3>
      <div v-show="openIndex === index" :id="`faq-panel-${index}`" class="faq-item__panel"><p>{{ item.answer }}</p></div>
    </div>
  </div>
</template>

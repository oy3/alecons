<script lang="js">
import { RouterView } from 'vue-router';
import Navbar from './components/Header.vue'

export default {
  name: 'App',
  computed: {},
  components: {RouterView, Navbar}
}
</script>

<template>
  <Navbar />
  <RouterView />
</template>

<style scoped></style>

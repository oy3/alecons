<script lang="js">
import { RouterView } from 'vue-router';
import Header from './components/Header.vue'

export default {
  name: 'App',
  computed: {},
  components: {RouterView, Header}
}
</script>

<template>
  <Header />
  <RouterView />
</template>

<style scoped></style>

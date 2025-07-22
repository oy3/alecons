<script lang="js">
import { RouterView } from 'vue-router';
import Navbar from './components/Header.vue'
import Footer from './components/Footer.vue';

export default {
  name: 'App',
  computed: {},
  components: { RouterView, Navbar, Footer }
}
</script>

<template>
  <Navbar />
  <RouterView />
  <Footer />
</template>

<style scoped></style>

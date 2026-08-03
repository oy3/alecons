<script setup>
import CtaSection from "../components/CtaSection.vue";
</script>
<template><section class="not-found"><div class="site-container"><p class="eyebrow">404 error</p><h1>We could not find that page</h1><p>The address may have changed, or the page may no longer be available.</p><div class="button-row"><RouterLink to="/" class="button button--primary">Return home</RouterLink><RouterLink to="/contact" class="button button--outline">Contact us</RouterLink></div></div></section><CtaSection /></template>
<style scoped>.not-found{min-height:34rem;display:flex;align-items:center;text-align:center}.not-found .site-container{max-width:42rem}.not-found .button-row{justify-content:center}.not-found p:not(.eyebrow){font-size:1.05rem}</style>

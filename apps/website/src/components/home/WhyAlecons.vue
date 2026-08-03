<script setup>
import { statistics } from "../../data/site";
import RevealOnScroll from "../RevealOnScroll.vue";

const reasons = [
  { icon: "bi-person-workspace", title: "Expert faculty", text: "Learn from experienced nursing professionals with advanced clinical expertise." },
  { icon: "bi-heart-pulse", title: "Hands-on training", text: "Build confidence through clinical rotations and simulation-based learning." },
  { icon: "bi-building", title: "Conducive environment", text: "Study in purpose-built learning spaces designed for focus and practical growth." },
  { icon: "bi-laptop", title: "Digital admissions", text: "Apply, make payments and follow your application through one secure portal." },
];
</script>
<template><section class="section section--dark"><div class="site-container"><div class="why-grid"><RevealOnScroll><p class="eyebrow">Why ALECONS</p><h2>A foundation built on practice, not theory alone</h2></RevealOnScroll><div class="reasons"><RevealOnScroll v-for="(reason,index) in reasons" :key="reason.title" :delay="index*60"><article><i :class="`bi ${reason.icon}`" aria-hidden="true"></i><h3>{{ reason.title }}</h3><p>{{ reason.text }}</p></article></RevealOnScroll></div></div><div class="stats-grid" aria-label="ALECONS statistics"><div v-for="stat in statistics" :key="stat.label"><strong>{{ stat.value }}{{ stat.suffix }}</strong><span>{{ stat.label }}</span><small>{{ stat.note }}</small></div></div></div></section></template>
<style scoped>
.why-grid{display:grid;grid-template-columns:.8fr 1.2fr;gap:6rem}.why-grid h2{color:#fff}.reasons{display:grid;grid-template-columns:1fr 1fr;gap:2rem}.reasons article{border-top:1px solid rgba(255,255,255,.16);padding-top:1.4rem}.reasons i{color:var(--color-primary-soft);font-size:1.5rem}.reasons h3{margin:.8rem 0 .4rem;color:#fff}.reasons p{color:rgba(255,255,255,.66);font-size:.88rem}.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-top:5rem;padding-top:2.5rem;border-top:1px solid rgba(255,255,255,.16)}.stats-grid div{display:grid}.stats-grid strong{color:#fff;font-family:var(--font-display);font-size:2.4rem;font-weight:500}.stats-grid span{color:#fff;font-size:.78rem;font-weight:650}.stats-grid small{color:rgba(255,255,255,.5)}
@media(max-width:767.98px){.why-grid{grid-template-columns:1fr;gap:2.5rem}.reasons{grid-template-columns:1fr}.stats-grid{grid-template-columns:1fr 1fr;margin-top:3rem}}
</style>

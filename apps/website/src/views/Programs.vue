<script setup>
import PageHero from "../components/PageHero.vue";
import ProgrammeCard from "../components/ProgrammeCard.vue";
import RevealOnScroll from "../components/RevealOnScroll.vue";
import CtaSection from "../components/CtaSection.vue";
import { programmes } from "../data/programmes";
</script>
<template><PageHero eyebrow="Academics" title="Programmes built around clinical practice" description="Comprehensive nursing education designed to prepare competent, compassionate healthcare professionals for practice in Nigeria and beyond." :breadcrumbs="[{ label: 'Programmes' }]" /><section class="section"><div class="site-container"><div class="programme-grid"><RevealOnScroll v-for="(programme,index) in programmes" :key="programme.slug" :delay="index*70"><ProgrammeCard :programme="programme" /></RevealOnScroll></div></div></section><CtaSection /></template>

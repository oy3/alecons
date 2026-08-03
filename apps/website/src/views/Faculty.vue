<script setup>
import PageHero from "../components/PageHero.vue";
import SectionHeading from "../components/SectionHeading.vue";
import FacultyCard from "../components/FacultyCard.vue";
import RevealOnScroll from "../components/RevealOnScroll.vue";
import CtaSection from "../components/CtaSection.vue";
import { leadership, widerFaculty } from "../data/faculty";
</script>
<template><PageHero eyebrow="Our people" title="Faculty & staff" description="Our team combines decades of clinical practice with a commitment to teaching and mentoring students." :breadcrumbs="[{ label: 'Faculty' }]" /><section class="section"><div class="site-container"><SectionHeading eyebrow="Leadership" title="College leadership" /><div class="faculty-grid"><RevealOnScroll v-for="(member,index) in leadership" :key="member.email" :delay="index*70"><FacultyCard :member="member" /></RevealOnScroll></div></div></section><section class="section section--subtle"><div class="site-container"><SectionHeading eyebrow="Academic & administrative staff" title="Wider team" /><div class="faculty-grid"><RevealOnScroll v-for="(member,index) in widerFaculty" :key="member.email" :delay="(index%3)*60"><FacultyCard :member="member" /></RevealOnScroll></div></div></section><CtaSection title="Join a college that invests in its students" description="Our faculty is ready to guide your training. Applications for the 2026/2027 session are open online." /></template>

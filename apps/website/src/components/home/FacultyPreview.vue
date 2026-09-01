<script setup>
import { leadership } from "../../data/faculty";
import FacultyCard from "../FacultyCard.vue";
import SectionHeading from "../SectionHeading.vue";
import RevealOnScroll from "../RevealOnScroll.vue";
</script>
<template>
  <section class="section">
    <div class="site-container">
      <SectionHeading
        eyebrow="Leadership"
        title="Guided by experienced professionals"
        description="Leaders committed to academic quality, student development and responsible institutional growth."
      />
      <div class="faculty-grid">
        <RevealOnScroll
          v-for="(member, index) in leadership"
          :key="member.email"
          :delay="index * 80"
          ><FacultyCard :member="member"
        /></RevealOnScroll>
      </div>
      <RouterLink to="/faculty" class="button button--outline mt-4">
        View the full faculty directory
        <i class="bi bi-arrow-right" aria-hidden="true"></i>
      </RouterLink>
    </div>
  </section>
</template>

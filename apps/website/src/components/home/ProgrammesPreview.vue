<script setup>
import { programmes } from "../../data/programmes";
import ProgrammeCard from "../ProgrammeCard.vue";
import RevealOnScroll from "../RevealOnScroll.vue";
import SectionHeading from "../SectionHeading.vue";
</script>
<template>
  <section class="section section--subtle">
    <div class="site-container">
      <SectionHeading
        eyebrow="Study with us"
        title="Programmes built around clinical practice"
        description="Comprehensive nursing education designed to prepare competent, compassionate healthcare professionals."
      />
      <div class="programme-grid">
        <RevealOnScroll
          v-for="(programme, index) in programmes.slice(0, 3)"
          :key="programme.slug"
          :delay="index * 80"
        >
          <ProgrammeCard :programme="programme" />
        </RevealOnScroll>
      </div>
      <div class="section-action">
        <RouterLink to="/programs" class="button button--outline">
           View all programmes
          <i class="bi bi-arrow-right" aria-hidden="true"></i>
        </RouterLink>

      </div>
    </div>
  </section>
</template>
<style scoped>
.section-action {
  margin-top: 2rem;
}
</style>

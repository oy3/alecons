<script setup>
import { applyUrl } from "../data/site";
defineProps({ title: { type: String, default: "Start your journey at ALECONS" }, description: { type: String, default: "Applications for the 2026/2027 academic session are handled entirely online. Our admissions team is available to guide you through every step." } });
</script>

<template>
  <section class="cta-section">
    <div class="site-container cta-section__inner">
      <p class="eyebrow">Admissions</p><h2>{{ title }}</h2><p>{{ description }}</p>
      <div class="button-row">
        <a :href="applyUrl" class="button button--primary" target="_blank" rel="noopener noreferrer">Apply Now</a>
        <RouterLink to="/contact" class="button button--outline-light">Contact Admissions</RouterLink>
      </div>
    </div>
  </section>
</template>

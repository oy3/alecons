<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import PageHero from "../components/PageHero.vue";
import CtaSection from "../components/CtaSection.vue";
import { applyUrl } from "../data/site";
import { getProgramme } from "../data/programmes";

const route = useRoute();
const programme = computed(() => getProgramme(route.params.slug));
</script>
<template><template v-if="programme"><PageHero :eyebrow="programme.statusLabel" :title="programme.name" :description="programme.description" :image="programme.image" :breadcrumbs="[{ label: 'Programmes', to: '/programs' }, { label: programme.name }]" /><section class="section"><div class="site-container programme-detail"><div><p class="eyebrow">Overview</p><h2>What you will study</h2><ul v-if="programme.highlights.length" class="check-list"><li v-for="highlight in programme.highlights" :key="highlight"><i class="bi bi-check2" aria-hidden="true"></i>{{ highlight }}</li></ul><p v-else>Detailed programme content is yet to be published by the college.</p></div><aside class="info-card"><h2>Programme facts</h2><dl><div><dt>Qualification</dt><dd>{{ programme.award }}</dd></div><div v-if="programme.duration"><dt>Duration</dt><dd>{{ programme.duration }}</dd></div><div><dt>Status</dt><dd>{{ programme.status === 'enrolling' ? 'Accepting applications' : 'Not yet accepting applications' }}</dd></div></dl><a v-if="programme.status === 'enrolling'" :href="applyUrl" target="_blank" rel="noopener noreferrer" class="button button--primary" data-umami-event="programme-apply-click">Apply for this programme</a><RouterLink v-else to="/contact" class="button button--outline">Contact Admissions</RouterLink></aside></div></section><CtaSection /></template></template>
<style scoped>.programme-detail{display:grid;grid-template-columns:1.4fr .8fr;gap:6rem}.check-list{display:grid;grid-template-columns:1fr 1fr;gap:1rem;padding:0;list-style:none}.check-list li{display:flex;gap:.7rem;border-bottom:1px solid var(--color-border);padding-bottom:1rem}.check-list i{color:var(--color-primary)}.info-card{padding:2rem}.info-card h2{font-size:1.6rem}.info-card dl div{padding:1rem 0;border-bottom:1px solid var(--color-border)}.info-card dt{font-size:.68rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--color-muted)}.info-card dd{margin:.3rem 0 0}.info-card .button{width:100%;margin-top:1rem}@media(max-width:767.98px){.programme-detail{grid-template-columns:1fr;gap:2.5rem}.check-list{grid-template-columns:1fr}}</style>

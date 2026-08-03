<script setup>
import PageHero from "../components/PageHero.vue";
import SectionHeading from "../components/SectionHeading.vue";
import FaqAccordion from "../components/FaqAccordion.vue";
import RevealOnScroll from "../components/RevealOnScroll.vue";
import { applyUrl } from "../data/site";
import {
  admissionDates,
  admissionSteps,
  faqs,
  fees,
  requirements,
} from "../data/admissions";
</script>
<template>
  <PageHero
    eyebrow="Admissions"
    title="Apply to ALECONS"
    description="Applications for the 2026/2027 academic session are submitted and tracked through the ALECONS Applicant Portal."
    :breadcrumbs="[{ label: 'Admissions' }]"
  >
    <a
      :href="applyUrl"
      class="button button--primary mt-3"
      target="_blank"
      rel="noopener noreferrer"
      >Start your application</a
    >
  </PageHero>
  <section class="section">
    <div class="site-container requirements-grid">
      <SectionHeading
        eyebrow="Entry requirements"
        title="Before you apply"
        description="Confirm that you meet each published requirement for the Basic Nursing programme."
      />
      <ul class="requirements-list">
        <li v-for="requirement in requirements" :key="requirement">
          <i class="bi bi-check2" aria-hidden="true"></i>{{ requirement }}
        </li>
      </ul>
    </div>
  </section>
  <section class="section section--subtle">
    <div class="site-container">
      <SectionHeading
        eyebrow="How to apply"
        title="The application process"
        description="Each stage is completed online. Keep your credentials and payment receipts to hand."
      />
      <ol class="admission-timeline">
        <RevealOnScroll
          v-for="(step, index) in admissionSteps"
          :key="step.title"
          ><li>
            <span>{{ index + 1 }}</span>
            <article>
              <div>
                <h3>{{ step.title }}</h3>
                <strong>{{ step.period }}</strong>
              </div>
              <p>{{ step.description }}</p>
              <ul>
                <li v-for="item in step.items" :key="item">
                  <i class="bi bi-check2" aria-hidden="true"></i>{{ item }}
                </li>
              </ul>
            </article>
          </li></RevealOnScroll
        >
      </ol>
    </div>
  </section>
  <section class="section">
    <div class="site-container">
      <SectionHeading eyebrow="Key dates" title="2026/2027 session calendar" />
      <div class="dates-grid">
        <article v-for="date in admissionDates" :key="date.label">
          <h3>{{ date.label }}</h3>
          <p><strong>Batch A</strong> - {{ date.batchA }}</p>
          <p><strong>Batch B</strong> - {{ date.batchB }}</p>
        </article>
      </div>
    </div>
  </section>
  <section class="section section--subtle">
    <div class="site-container">
      <SectionHeading
        eyebrow="Fees"
        title="Schedule of charges"
        description="The figures below are the fees published by the college for the current session."
      />
      <div class="fees-grid">
        <article class="fees-card">
          <header>
            <h3>Nursing Programme</h3>
            <span>Per session</span>
          </header>
          <dl>
            <div v-for="fee in fees" :key="fee.label">
              <dt>{{ fee.label }}</dt>
              <dd>{{ fee.amount }}</dd>
            </div>
            <div class="fees-card__total">
              <dt class="fw-bold text-dark">Total per session</dt>
              <dd class="fw-bold">N805,000</dd>
            </div>
          </dl>
        </article>
        <article class="fees-card fees-card--pending">
          <header>
            <h3>Post-Basic Nursing</h3>
            <span>18 months</span>
          </header>
          <p>Programme charges have not yet been published.</p>
          <RouterLink to="/contact" class="text-link"
            >Contact Admissions
            <i class="bi bi-arrow-right" aria-hidden="true"></i
          ></RouterLink>
        </article>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="site-container faq-grid">
      <SectionHeading
        eyebrow="Questions"
        title="Admissions FAQ"
        description="Still unsure about something? Our admissions office is happy to help."
      /><FaqAccordion :items="faqs" />
    </div>
  </section>
  <section class="cta-section">
    <div class="site-container cta-section__inner">
      <p class="eyebrow">Ready to apply?</p>
      <h2>Take the first step towards your nursing career</h2>
      <p>
        Our admissions team is here to help you through every step of the
        process.
      </p>
      <div class="button-row">
        <a
          :href="applyUrl"
          class="button button--primary"
          target="_blank"
          rel="noopener noreferrer"
          >Start application</a
        ><RouterLink to="/contact" class="button button--outline-light"
          >Contact Admissions</RouterLink
        >
      </div>
    </div>
  </section>
</template>
<style scoped>
.requirements-grid {
  display: grid;
  grid-template-columns: 0.8fr 1.2fr;
  gap: 6rem;
}
.requirements-list {
  padding: 0;
  margin: 0;
  list-style: none;
}
.requirements-list li {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--color-border);
}
.requirements-list i {
  color: var(--color-primary);
}
.admission-timeline {
  max-width: 65rem;
  padding: 0;
  margin: 0;
  list-style: none;
  border-left: 1px solid var(--color-border);
}
.admission-timeline > :deep(.reveal) > li {
  display: grid;
  grid-template-columns: 2rem 1fr;
  gap: 1rem;
  margin-left: -1rem;
  padding-bottom: 1.5rem;
}
.admission-timeline > :deep(.reveal) > li > span {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--color-primary);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 700;
}
.admission-timeline article {
  padding: 1.5rem;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}
.admission-timeline article > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}
.admission-timeline strong {
  color: var(--color-primary);
  font-size: 0.65rem;
  text-transform: uppercase;
}
.admission-timeline ul {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 0;
  list-style: none;
  font-size: 0.82rem;
}
.admission-timeline ul i {
  color: var(--color-primary);
  margin-right: 0.4rem;
}
.dates-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0;
}
.dates-grid article {
  padding: 1.5rem 1.5rem 1.5rem 0;
  border-top: 1px solid var(--color-border);
}
.dates-grid h3 {
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-weight: 650;
}
.dates-grid p {
  margin: 0.2rem 0;
  font-size: 0.75rem;
}
.dates-grid strong {
  color: var(--color-primary);
}
.fees-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}
.fees-card {
  padding: 1.75rem;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}
.fees-card header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
}
.fees-card header span {
  font-size: 0.68rem;
  text-transform: uppercase;
}
.fees-card dl div {
  display: flex;
  justify-content: space-between;
  padding: 0.7rem 0;
  border-bottom: 1px solid var(--color-border);
  font-size: 0.82rem;
}
.fees-card dt {
  font-weight: 400;
}
.fees-card dd {
  margin: 0;
  font-weight: 400;
}
.fees-card__total {
  color: var(--color-primary);
  font-weight: 700;
}
.fees-card--pending {
  opacity: 0.75;
}
.faq-grid {
  display: grid;
  grid-template-columns: 0.7fr 1.3fr;
  gap: 6rem;
}
.cta-section__inner {
  max-width: 48rem;
}
@media (max-width: 767.98px) {
  .requirements-grid,
  .faq-grid,
  .fees-grid {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }
  .admission-timeline article > div {
    align-items: flex-start;
    flex-direction: column;
  }
  .admission-timeline ul {
    grid-template-columns: 1fr;
  }
  .dates-grid {
    grid-template-columns: 1fr 1fr;
  }
  .dates-grid article {
    padding-right: 0.8rem;
  }
}
</style>

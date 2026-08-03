<script setup>
import PageHero from "../components/PageHero.vue";
import SectionHeading from "../components/SectionHeading.vue";
import RevealOnScroll from "../components/RevealOnScroll.vue";
import FacilityCard from "../components/FacilityCard.vue";
import FacultyCard from "../components/FacultyCard.vue";
import CtaSection from "../components/CtaSection.vue";
import { statistics } from "../data/site";
import { facilities } from "../data/facilities";
import { leadership } from "../data/faculty";
import campus from "../assets/img/campus2.jpg";

const values = [
  {
    title: "Compassionate care",
    text: "We instil the values of empathy, kindness and patient-centred care in every aspect of our curriculum.",
  },
  {
    title: "Academic excellence",
    text: "Our rigorous academic programmes combine theoretical knowledge with hands-on clinical experience.",
  },
  {
    title: "Professional integrity",
    text: "We maintain the highest standards of ethics, professionalism and accountability in healthcare.",
  },
  {
    title: "Clinical expertise",
    text: "Modern facilities and expert faculty ensure our graduates are practice-ready professionals.",
  },
];
const milestones = [
  {
    year: "2014",
    title: "Foundation",
    text: "Our academic journey in the community began with the erection of our first building, laying the foundation for a purpose-driven learning environment.",
  },
  {
    year: "2021",
    title: "ACAS established",
    text: "Alebiosu College of Art and Sciences was established, broadening access to quality, value-driven education across Ekiti State.",
  },
  {
    year: "2023",
    title: "Modern facilities",
    text: "A solar-powered campus, 1,000-capacity hall and modern hostel facilities were developed alongside expanding clinical partnerships.",
  },
  {
    year: "2025",
    title: "ALECONS founded",
    text: "Alebiosu College of Nursing Sciences was established with a dedicated focus on nursing education excellence.",
  },
  {
    year: "2026 Q1",
    title: "Accreditation",
    text: "ALECONS received full accreditation from the Nursing and Midwifery Council of Nigeria (NMCN).",
  },
  {
    year: "2026 Q2",
    title: "First applicants",
    text: "The college welcomed its first cohort of applicants and began its mission to produce excellent nursing professionals.",
  },
];
</script>

<template>
  <PageHero
    eyebrow="About us"
    title="Shaping healthcare leaders in Ekiti State"
    description="A beacon of nursing education committed to developing competent, caring and ethical professionals."
    :breadcrumbs="[{ label: 'About' }]"
  />
  <section class="section">
    <div class="site-container story-grid">
      <RevealOnScroll
        ><p class="eyebrow">Our story</p>
        <h2>A calling, not simply a profession</h2>
        <p>
          Located in the serene environment of Omuoke, Ekiti State, our college
          provides an ideal setting for learning and growth. Modern facilities,
          experienced faculty and a comprehensive curriculum prepare students
          for successful careers in nursing.
        </p>
        <p>
          We believe nursing is a calling to serve humanity with compassion and
          skill. Our graduates are prepared to lead in hospitals, clinics,
          community health centres and specialised care facilities.
        </p></RevealOnScroll
      ><RevealOnScroll :delay="100"
        ><img
          :src="campus"
          alt="ALECONS campus buildings and lawn"
          width="720"
          height="620"
          loading="lazy"
      /></RevealOnScroll>
    </div>
  </section>
  <section class="section section--dark">
    <div class="site-container">
      <div class="mission-grid">
        <RevealOnScroll
          ><h2>Our vision</h2>
          <p>
            To produce the next generation of nursing leaders and empower them
            to address the challenges of a complex and diverse healthcare
            environment, while advancing impactful research, evidence and
            education.
          </p></RevealOnScroll
        ><RevealOnScroll :delay="80"
          ><h2>Our mission</h2>
          <p>
            For faculty and students to contribute immensely to the health of
            all through innovative and impactful nursing education, research,
            practice and service.
          </p></RevealOnScroll
        >
      </div>
      <div class="about-stats">
        <div v-for="stat in statistics" :key="stat.label">
          <strong>{{ stat.value }}{{ stat.suffix }}</strong
          ><span>{{ stat.label }}</span
          ><small>{{ stat.note }}</small>
        </div>
      </div>
    </div>
  </section>
  <section class="section">
    <div class="site-container">
      <SectionHeading
        eyebrow="Core values"
        title="What we teach beyond the curriculum"
        centered
      />
      <div class="values-grid">
        <RevealOnScroll
          v-for="(value, index) in values"
          :key="value.title"
          :delay="index * 60"
          ><article>
            <span>0{{ index + 1 }}</span>
            <h3>{{ value.title }}</h3>
            <p>{{ value.text }}</p>
          </article></RevealOnScroll
        >
      </div>
    </div>
  </section>
  <section class="section section--subtle">
    <div class="site-container">
      <SectionHeading
        eyebrow="Our journey"
        title="Milestones on the way here"
        description="From our first building in the community to a dedicated college of nursing sciences."
      />
      <ol class="timeline">
        <RevealOnScroll v-for="milestone in milestones" :key="milestone.year"
          ><li>
            <span>{{ milestone.year }}</span>
            <div>
              <h3>{{ milestone.title }}</h3>
              <p>{{ milestone.text }}</p>
            </div>
          </li></RevealOnScroll
        >
      </ol>
    </div>
  </section>
  <section class="section">
    <div class="site-container">
      <SectionHeading
        eyebrow="Facilities"
        title="Learning spaces on campus"
        description="Modern facilities and equipment that provide an optimal learning environment."
      />
      <div class="facility-grid">
        <RevealOnScroll
          v-for="(facility, index) in facilities"
          :key="facility.title"
          :delay="index * 60"
          ><FacilityCard :facility="facility"
        /></RevealOnScroll>
      </div>
    </div>
  </section>
  <section class="section section--subtle">
    <div class="site-container">
      <SectionHeading
        eyebrow="Leadership team"
        title="The people guiding our vision"
      />
      <div class="faculty-grid">
        <FacultyCard
          v-for="member in leadership"
          :key="member.email"
          :member="member"
        />
      </div>
    </div>
  </section>
  <CtaSection />
</template>

<style scoped>
.story-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: center;
  gap: 6rem;
}
.story-grid img {
  width: 100%;
  aspect-ratio: 1.15;
  object-fit: cover;
  border-radius: var(--radius);
}
.mission-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6rem;
}
.mission-grid h2 {
  font-size: 1.8rem;
}
.mission-grid p {
  color: rgba(255, 255, 255, 0.68);
}
.about-stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  margin-top: 4rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}
.about-stats div {
  display: grid;
}
.about-stats strong {
  color: #fff;
  font-family: var(--font-display);
  font-size: 2rem;
}
.about-stats span {
  font-size: 0.78rem;
  font-weight: 650;
}
.about-stats small {
  color: rgba(255, 255, 255, 0.5);
}
.values-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}
.values-grid article {
  height: 100%;
  padding: 1.5rem;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
}
.values-grid span {
  color: var(--color-primary);
  font-size: 0.7rem;
  font-weight: 700;
}
.values-grid h3 {
  margin: 2.5rem 0 0.6rem;
}
.values-grid p {
  margin: 0;
  font-size: 0.85rem;
}
.timeline {
  max-width: 60rem;
  padding: 0;
  margin: 0;
  list-style: none;
  border-left: 1px solid var(--color-border);
}
.timeline li {
  display: grid;
  grid-template-columns: 7rem 1fr;
  gap: 2rem;
  padding: 0 0 2.5rem 2rem;
  position: relative;
}
.timeline li::before {
  content: "";
  position: absolute;
  left: -0.35rem;
  top: 0.35rem;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 50%;
  background: var(--color-primary);
}
.timeline li > span {
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 700;
}
.timeline h3 {
  margin-bottom: 0.4rem;
}
.timeline p {
  margin: 0;
}
@media (max-width: 767.98px) {
  .story-grid,
  .mission-grid {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }
  .story-grid :deep(.reveal:last-child) {
    order: -1;
  }
  .about-stats {
    grid-template-columns: 1fr 1fr;
  }
  .values-grid {
    grid-template-columns: 1fr;
  }
  .timeline li {
    grid-template-columns: 1fr;
    gap: 0.5rem;
    padding-left: 1.5rem;
  }
}
</style>

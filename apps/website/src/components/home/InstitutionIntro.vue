<script setup>
import RevealOnScroll from "../RevealOnScroll.vue";
import campusImage from "../../assets/img/campus2.jpg";
import clinicalLabImage from "../../assets/img/clinc-lab.jpg";
import eLibraryImage from "../../assets/img/e-library.jpeg";
</script>
<template>
  <section class="section intro-section">
    <div class="site-container intro-grid">
      <RevealOnScroll
        ><p class="eyebrow">About the college</p>
        <h2>A beacon of nursing education in Ekiti State</h2>
        <p>
          ALECONS is committed to developing competent, caring and ethical
          nursing professionals who will serve their communities with
          distinction. Located in the serene environment of Omuoke, our campus
          provides an ideal setting for learning and growth.
        </p>
        <ul class="intro-highlights">
          <li>
            <i class="bi bi-check-lg" aria-hidden="true"></i>
            <span
              >Modern facilities, experienced faculty and a comprehensive
              curriculum</span
            >
          </li>
          <li>
            <i class="bi bi-check-lg" aria-hidden="true"></i>
            <span
              >Full accreditation from the Nursing and Midwifery Council of
              Nigeria</span
            >
          </li>
          <li>
            <i class="bi bi-check-lg" aria-hidden="true"></i>
            <span
              >A solar-powered campus with a 1,000-capacity hall and hostel
              facilities</span
            >
          </li>
        </ul>
        <RouterLink to="/about" class="button button--outline intro-about-link">
          Discover our story <i class="bi bi-arrow-right" aria-hidden="true"></i>
        </RouterLink>
      </RevealOnScroll>
      <RevealOnScroll :delay="100">
        <div class="intro-gallery">
          <img
            class="intro-gallery__main"
            :src="campusImage"
            alt="ALECONS academic buildings surrounding the campus lawn"
            width="720"
            height="440"
            loading="lazy"
          />
          <div class="intro-gallery__supporting">
            <img
              :src="clinicalLabImage"
              alt="ALECONS clinical simulation laboratory"
              width="360"
              height="240"
              loading="lazy"
            />
            <img
              :src="eLibraryImage"
              alt="ALECONS e-library computer workstations"
              width="360"
              height="240"
              loading="lazy"
            />
          </div></div
      ></RevealOnScroll>
    </div>
  </section>
</template>
<style scoped>
.intro-grid {
  display: grid;
  grid-template-columns: 0.9fr 1.1fr;
  align-items: center;
  gap: 6rem;
}
.intro-grid h2 {
  margin-bottom: 1.25rem;
}
.intro-highlights {
  display: grid;
  gap: 0.9rem;
  padding: 0;
  margin: 2rem 0;
  list-style: none;
}
.intro-highlights li {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  color: var(--color-muted);
}
.intro-highlights i {
  flex: 0 0 auto;
  margin-top: 0.15rem;
  color: var(--color-primary);
}
.intro-about-link {
  width: fit-content;
}
.intro-gallery img {
  width: 100%;
  height: auto;
  object-fit: cover;
  border-radius: var(--radius);
  box-shadow: var(--shadow-md);
}
.intro-gallery__main {
  aspect-ratio: 16 / 9;
}
.intro-gallery__supporting {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
  margin-top: 1rem;
}
.intro-gallery__supporting img {
  aspect-ratio: 3 / 2;
}
.intro-section {
  padding-top: 3rem;
}
@media (max-width: 767.98px) {
  .intro-section {
    padding-top: 1.25rem;
  }
  .intro-grid {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }
}
</style>

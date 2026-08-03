<script setup>
import { applyUrl } from "../../data/site";
import heroImage from "../../assets/img/campus/main-gate.jpg";
</script>

<template>
  <section class="home-hero" :style="{ '--hero-image': `url(${heroImage})` }">
    <div class="site-container home-hero__inner">
      <p class="eyebrow text-white-50">Omuoke - Ekiti State - Nigeria</p>
      <h1>Excellence in<br /><em>nursing education</em></h1>
      <p>
        Empowering the next generation of healthcare professionals in Ekiti
        State. Join ALECONS and transform lives through compassionate care and
        clinical excellence.
      </p>
      <div class="button-row">
        <a
          :href="applyUrl"
          class="button button--primary"
          target="_blank"
          rel="noopener noreferrer"
          data-umami-event="apply-click"
          >Apply for Admission
          <i class="bi bi-arrow-right" aria-hidden="true"></i></a>
        <RouterLink to="/programs" class="button button--outline-light">Explore Programmes</RouterLink>
      </div>
      <p class="home-hero__trust">
        <i class="bi bi-check-circle" aria-hidden="true"></i> Accredited by the
        Nursing and Midwifery Council of Nigeria (NMCN), 2026
      </p>
    </div>
  </section>
</template>

<style scoped>
.home-hero {
  min-height: 41rem;
  display: flex;
  align-items: center;
  position: relative;
  color: #fff;
  background: var(--color-primary-deep);
  overflow: hidden;
}
.home-hero::before {
  content: "";
  position: absolute;
  inset: 0;
  background:
    linear-gradient(
      90deg,
      rgba(47, 10, 13, 0.93) 0%,
      rgba(52, 13, 16, 0.7) 50%,
      rgba(52, 13, 16, 0.3) 100%
    ),
    var(--hero-image) center/cover;
  transform: scale(1.02);
  animation: hero-image-in 1200ms var(--ease) both;
}
.home-hero__inner {
  position: relative;
  padding-block: 7rem;
}
.home-hero h1 {
  max-width: 48rem;
  margin-bottom: 1.5rem;
  color: #fff;
  font-size: 4.25rem;
  animation: hero-copy-in 700ms var(--ease) both;
}
.home-hero h1 em {
  color: #fff;
  font-style: normal;
}
.home-hero__inner > p:not(.eyebrow):not(.home-hero__trust) {
  max-width: 42rem;
  color: rgba(255, 255, 255, 0.82);
  font-size: 1.08rem;
}
.home-hero .button-row {
  margin-top: 2rem;
}
.home-hero__trust {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 2rem 0 0;
  color: rgba(255, 255, 255, 0.66);
  font-size: 0.76rem;
}
@keyframes hero-image-in {
  from {
    opacity: 0;
    transform: scale(1.08);
  }
  to {
    opacity: 1;
    transform: scale(1.02);
  }
}
@keyframes hero-copy-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (max-width: 767.98px) {
  .home-hero {
    min-height: 39rem;
  }
  .home-hero::before {
    background:
      linear-gradient(rgba(47, 10, 13, 0.78), rgba(47, 10, 13, 0.8)),
      var(--hero-image) 57% center/cover;
  }
  .home-hero h1 {
    font-size: 3rem;
  }
  .home-hero__inner {
    padding-block: 5.5rem;
  }
}
@media (max-width: 420px) {
  .home-hero h1 {
    font-size: 2.7rem;
  }
}
</style>

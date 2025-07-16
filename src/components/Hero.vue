<script lang="js">
export default {
  name: "Hero",
  components: {},
};
</script>

<template>
  <div
    class="hero-section text-white text-start d-flex align-items-start justify-content-start p-5 pb-3"
  >
    <div class="overlay"></div>
    <div class="hero-content">
      <h1 class="fw-bold display-2 mb-0 lh-1">Excellence in</h1>
      <h1 class="fw-bold display-2 acon-text-secondary lh-1">
        Nursing Education
      </h1>

      <div class="row">
        <div class="col-md-7">
          <p class="fs-4 my-4">
            Empowering the next generation of healthcare professionals in Ekiti
            State, Nigeria. Join ACON and transform lives through compassionate
            care and clinical excellence.
          </p>
        </div>
      </div>

      <div class="d-grid gap-2 d-md-block">
        <button class="btn btn-acon-secondary btn-lg me-0 me-md-3 px-4">
          Start Your Journey <i class="bi bi-arrow-right-short h3"></i>
        </button>
        <button
          class="btn btn-outline-light btn-lg px-4"
          style="--bs-btn-hover-color: #2d7d7d"
        >
          Explore Programs
        </button>
      </div>


      <div class="col-md-9">
      <div
        class="stats-container mt-5 p-4 px-md-5 py-md-3 rounded-4 text-white d-flex flex-column flex-md-row justify-content-around align-items-center gap-4"
      >
        <div class="">
          <div class="d-flex align-items-end justify-content-center">
            <i class="bi bi-people h2 acon-text-secondary me-2"></i>
            <h2 class="fw-bold mt-2">500+</h2>
          </div>

          <p class="mb-0">Nursing Students</p>
        </div>

        <div class="">
          <div class="d-flex align-items-end justify-content-center">
            <i class="bi bi-award h2 acon-text-secondary me-2"></i>
            <h2 class="fw-bold mt-2">95%</h2>
          </div>
          <p class="mb-0">Graduate Success Rate</p>
        </div>

        <div>
          <div class="d-flex align-items-end justify-content-center">
            <i class="bi bi-geo-alt h2 acon-text-secondary me-2"></i>
            <h2 class="fw-bold mt-2">15+</h2>
          </div>
          <p class="mb-0">Years of Excellence</p>
        </div>
      </div>
      </div>



      <div class="d-flex justify-content-center mt-5">
        <i class="bi bi-mouse fs-1"></i>
      </div>

    </div>
  </div>
</template>

<style scoped>
.hero-section {
  position: relative;
  background-image: url("/src/assets/img/campus.jpg");
  background-size: cover;
  background-position: center;
  height: 100%;
  overflow: hidden;
  margin-top: 117px;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #2d7d7d;
  opacity: 0.8;
  z-index: 1;
}

.hero-content {
  position: relative;
  z-index: 2;
}

.stats-container {
  background-color: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(4px);
}
</style>

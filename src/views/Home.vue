<script lang="js">
import Hero from '../components/Hero.vue';
import CTA from '../components/CTA.vue';

export default {
  name: "Home",
  components: { Hero, CTA },
};
</script>

<template>
  <div class="container-fluid p-0" style="margin-top: 117px">
    <Hero />

    <div class="text-center my-5">
      <h2 class="acon-text-primary fw-bold">Explore ACONS</h2>
      <p class="lead">
        Discover everything you need to know about studying at Alebiosu College
        of Nursing Sciences
      </p>

      <div class="row g-0">
        <div class="col-md-6 px-3">
          <iframe class="w-100" height="315"
            src="https://www.youtube.com/embed/sZqgjguwYog?si=t_L6pugV6AbPMi9Q&amp;controls=0"
            title="YouTube video player" frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
        </div>

        <div class="col-md-6 px-5">
          <div class="card text-start border-0 shadow py-1 mb-3">
            <div class="card-body px-0 px-md-0">
              <div class="d-flex">
                <div>
                  <div class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-3"
                    style="width: 70px; height: 70px;">
                    <i class="bi bi-book h1 mb-0 text-white"></i>
                  </div>
                </div>

                <div class="ms-3">
                  <h5 class="card-title acon-text-primary fw-bold mb-0">
                    About ACONS
                  </h5>
                  <p class="card-text text-secondary">
                    Learn about our history, mission, and commitment to
                    excellence
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="card text-start border-0 shadow py-1 mb-3">
            <div class="card-body  px-0 px-md-0">
              <div class="d-flex">
                <div>
                  <div class="d-inline-flex justify-content-center align-items-center acon-bg-secondary rounded-3"
                    style="width: 70px; height: 70px;">
                    <i class="bi bi-people h1 mb-0 text-white"></i>
                  </div>
                </div>
                <div class="ms-3">
                  <h5 class="card-title acon-text-secondary fw-bold mb-0">
                    Programs
                  </h5>
                  <p class="card-text text-secondary">
                    Explore our comprehensive nursing education programs
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="card text-start border-0 shadow py-1 mb-3">
            <div class="card-body  px-0 px-md-0">
              <div class="d-flex">
                <div>
                  <div class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-3"
                    style="width: 70px; height: 70px;">
                    <i class="bi bi-award h1 mb-0 text-white"></i>
                  </div>
                </div>
                <div class="ms-3">
                  <h5 class="card-title acon-text-primary fw-bold mb-0">
                    Faculty
                  </h5>
                  <p class="card-text text-secondary">
                    Meet our experienced and dedicated faculty members
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="card text-start border-0 shadow py-1 mb-3">
            <div class="card-body  px-0 px-md-0">
              <div class="d-flex">
                <div>
                  <div class="d-inline-flex justify-content-center align-items-center acon-bg-secondary rounded-3"
                    style="width: 70px; height: 70px;">
                    <i class="bi bi-calendar h1 mb-0 text-white"></i>
                  </div>
                </div>
                <div class="ms-3">
                  <h5 class="card-title acon-text-secondary fw-bold mb-0">
                    Admissions
                  </h5>
                  <p class="card-text text-secondary">
                    Start your application process and join our community
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div class="card text-start border-0 shadow py-1 mb-3">
            <div class="card-body  px-0 px-md-0">
              <div class="d-flex">
                <div>
                  <div class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-3"
                    style="width: 70px; height: 70px;">
                    <i class="bi bi-telephone h1 mb-0 text-white"></i>
                  </div>
                </div>
                <div class="ms-3">
                  <h5 class="card-title acon-text-primary fw-bold mb-0">
                    Contact
                  </h5>
                  <p class="card-text text-secondary">
                    Get in touch with us for more information
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="text-center py-5 acon-bg-light">
      <h2 class="fw-bold acon-text-primary mt-5">Why Choose ACONS?</h2>
      <p class="lead mb-5 text-secondary">Join a community of excellence where your nursing career begins with the best
        foundation</p>

      <div class="row g-4 mx-5 mb-5">
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100">
            <div class="card-body">
              <h2 class="fw-bolder acon-text-primary">200+</h2>
              <h6 class="fw-bold acon-text-secondary">Active Students</h6>
              <p class="text-secondary">Learning from expert faculty</p>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100">
            <div class="card-body">
              <h2 class="fw-bolder acon-text-primary">95%</h2>
              <h6 class="fw-bold acon-text-secondary">Graduate Success</h6>
              <p class="text-secondary">Employment within 6 months</p>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100">
            <div class="card-body">
              <h2 class="fw-bolder acon-text-primary">15+</h2>
              <h6 class="fw-bold acon-text-secondary">Years Excellence</h6>
              <p class="text-secondary">Serving Ekiti State</p>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100">
            <div class="card-body">
              <h2 class="fw-bolder acon-text-primary">25+</h2>
              <h6 class="fw-bold acon-text-secondary">Expert Faculty</h6>
              <p class="text-secondary">Experienced professionals</p>
            </div>
          </div>
        </div>
      </div>

    </div>

    <div class="text-center py-5 ">
      <h2 class="fw-bold acon-text-primary mt-5">Our Programs</h2>
      <p class="lead mb-5 text-secondary">Comprehensive nursing education programs designed for your success</p>
      <div class="row g-4 mx-5 mb-5">
        <div class="col-12 col-md-6 col-lg-4">
          <div class="card border-0 shadow p-1 h-100 text-start">
            <div class="card-body">
              <div class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-3 mb-3"
                style="width: 50px; height: 50px;">
                <i class="bi bi-book h3 mb-0 text-white"></i>
              </div>

              <h5 class="card-title fw-bolder acon-text-primary">Basic Nursing Program</h5>
              <p class="text-secondary">3-year comprehensive program covering all fundamental nursing skills and
                knowledge.</p>
              <a href="">Learn More </a>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-4">
          <div class="card border-0 shadow p-1 h-100 text-start">
            <div class="card-body">
              <div class="d-inline-flex justify-content-center align-items-center acon-bg-secondary rounded-3 mb-3"
                style="width: 50px; height: 50px;">
                <i class="bi bi-people h3 mb-0 text-white"></i>
              </div>

              <h5 class="card-title fw-bolder acon-text-secondary">Post-Basic Nursing</h5>
              <p class="text-secondary">18-month advanced program for practicing nurses seeking specialization.</p>
              <a href="">Learn More </a>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-4">
          <div class="card border-0 shadow p-1 h-100 text-start">
            <div class="card-body">
              <div class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-3 mb-3"
                style="width: 50px; height: 50px;">
                <i class="bi bi-book h3 mb-0 text-white"></i>
              </div>

              <h5 class="card-title fw-bolder acon-text-primary">Midwifery Program</h5>
              <p class="text-secondary">2-year specialized program focusing on maternal and infant care.</p>
              <a href="">Learn More </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <CTA class="mb-5" />
  </div>
</template>

<style scoped></style>

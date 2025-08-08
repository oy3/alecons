<script lang="js">
import Hero from '../components/Hero.vue';
import CTA from '../components/CTA.vue';

export default {
  metaInfo: {
    title: 'Alecons College of Nursing Sciences - Excellence in Nursing Education',
    meta: [
      {
        name: 'description',
        content: 'Alecons College of Nursing Sciences offers world-class nursing education in Ekiti State, Nigeria. Join us to build a rewarding career in healthcare.'
      },
      {
        name: 'keywords',
        content: 'nursing school in Nigeria, Alecons College of Nursing Sciences, nursing education, healthcare careers, nursing programs, alecons'
      }
    ]
  },
  name: "Home",
  components: { Hero, CTA },
};
</script>

<template>
  <div class="container-fluid p-0" style="margin-top: 117px">
    <Hero />

    <div class="text-center m-5">
      <h2 class="acon-text-primary fw-bold">Explore ALECONS</h2>
      <p class="lead">
        Discover everything you need to know about studying at Alebiosu College
        of Nursing Sciences
      </p>

      <div class="row g-4 align-items-stretch">
        <div class="col-md-6 px-md-3 d-flex">
          <iframe
            class="flex-fill"
            style="min-height: 100%"
            src="https://www.youtube.com/embed/sZqgjguwYog?si=t_L6pugV6AbPMi9Q&controls=0"
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
          ></iframe>
        </div>

        <div class="col-md-6 px-md-5 d-flex flex-column">
          <div class="card text-start border-0 py-2 shadow mb-3">
            <div class="card-body p-0">
              <div class="d-flex">
                <div class="my-auto">
                  <div
                    class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-3"
                    style="width: 70px; height: 70px"
                  >
                    <i class="bi bi-book h1 mb-0 text-white"></i>
                  </div>
                </div>

                <div class="ms-3">
                  <h5 class="card-title acon-text-primary fw-bold mb-0">
                    About ACONS
                  </h5>
                  <p class="card-text text-secondary mb-0">
                    Learn about our history, mission, and commitment to
                    excellence
                  </p>
                  <a
                    class="icon-link icon-link-hover acon-text-primary acon-link d-inline-flex align-items-center gap-1"
                    href="#"
                  >
                    <small>Learn More</small>
                    <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class="card text-start border-0 py-2 shadow mb-3">
            <div class="card-body p-0">
              <div class="d-flex">
                <div class="my-auto">
                  <div
                    class="d-inline-flex justify-content-center align-items-center acon-bg-secondary rounded-3"
                    style="width: 70px; height: 70px"
                  >
                    <i class="bi bi-people h1 mb-0 text-white"></i>
                  </div>
                </div>
                <div class="ms-3">
                  <h5 class="card-title acon-text-secondary fw-bold mb-0">
                    Programs
                  </h5>
                  <p class="card-text text-secondary mb-0">
                    Explore our comprehensive nursing education programs
                  </p>
                  <a
                    class="icon-link icon-link-hover acon-text-primary acon-link d-inline-flex align-items-center gap-1"
                    href="#"
                  >
                    <small>Learn More</small>
                    <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class="card text-start border-0 shadow py-2 mb-3">
            <div class="card-body p-0">
              <div class="d-flex">
                <div class="my-auto">
                  <div
                    class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-3"
                    style="width: 70px; height: 70px"
                  >
                    <i class="bi bi-award h1 mb-0 text-white"></i>
                  </div>
                </div>
                <div class="ms-3">
                  <h5 class="card-title acon-text-primary fw-bold mb-0">
                    Faculty
                  </h5>
                  <p class="card-text text-secondary mb-0">
                    Meet our experienced and dedicated faculty members
                  </p>
                  <a
                    class="icon-link icon-link-hover acon-text-primary acon-link d-inline-flex align-items-center gap-1"
                    href="#"
                  >
                    <small>Learn More</small>
                    <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class="card text-start border-0 shadow py-2 mb-3">
            <div class="card-body p-0">
              <div class="d-flex">
                <div class="my-auto">
                  <div
                    class="d-inline-flex justify-content-center align-items-center acon-bg-secondary rounded-3"
                    style="width: 70px; height: 70px"
                  >
                    <i class="bi bi-calendar h1 mb-0 text-white"></i>
                  </div>
                </div>
                <div class="ms-3">
                  <h5 class="card-title acon-text-secondary fw-bold mb-0">
                    Admissions
                  </h5>
                  <p class="card-text text-secondary mb-0">
                    Start your application process and join our community
                  </p>
                  <a
                    class="icon-link icon-link-hover acon-text-primary acon-link d-inline-flex align-items-center gap-1"
                    href="#"
                  >
                    <small>Learn More</small>
                    <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div class="card text-start border-0 shadow py-2">
            <div class="card-body p-0">
              <div class="d-flex">
                <div class="my-auto">
                  <div
                    class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-3"
                    style="width: 70px; height: 70px"
                  >
                    <i class="bi bi-telephone h1 mb-0 text-white"></i>
                  </div>
                </div>
                <div class="ms-3">
                  <h5 class="card-title acon-text-primary fw-bold mb-0">
                    Contact
                  </h5>
                  <p class="card-text text-secondary mb-0">
                    Get in touch with us for more information
                  </p>
                  <a
                    class="icon-link icon-link-hover acon-text-primary acon-link d-inline-flex align-items-center gap-1"
                    href="#"
                  >
                    <small>Learn More</small>
                    <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="text-center py-5 acon-bg-light">
      <h2 class="fw-bold acon-text-primary mt-5">Why Choose ACONS?</h2>
      <p class="lead mb-5 text-secondary">
        Join a community of excellence where your nursing career begins with the
        best foundation
      </p>

      <div class="row g-4 mx-0 mx-md-5 mb-5">
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

    <div class="text-center py-5">
      <h2 class="fw-bold acon-text-primary mt-5">Our Programs</h2>
      <p class="lead mb-5 text-secondary">
        Comprehensive nursing education programs designed for your success
      </p>
      <div class="row g-4 mx-5 mb-5">
        <div class="col-12 col-md-6 col-lg-4">
          <div class="card border-0 shadow p-1 h-100 text-start">
            <div class="card-body">
              <div
                class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-3 mb-3"
                style="width: 50px; height: 50px"
              >
                <i class="bi bi-book h3 mb-0 text-white"></i>
              </div>

              <h5 class="card-title fw-bolder acon-text-primary">
                Basic Nursing Program
              </h5>

              <p class="text-secondary">
                3-year comprehensive program covering all fundamental nursing
                skills and knowledge.
              </p>

              <a
                class="icon-link icon-link-hover acon-text-primary acon-link d-inline-flex align-items-center gap-1"
                href="#"
              >
                <span>Learn More</span>
                <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
              </a>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-4">
          <div class="card border-0 shadow p-1 h-100 text-start">
            <div class="card-body">
              <div
                class="d-inline-flex justify-content-center align-items-center acon-bg-secondary rounded-3 mb-3"
                style="width: 50px; height: 50px"
              >
                <i class="bi bi-people h3 mb-0 text-white"></i>
              </div>

              <h5 class="card-title fw-bolder acon-text-secondary">
                Post-Basic Nursing
              </h5>
              <p class="text-secondary">
                18-month advanced program for practicing nurses seeking
                specialization.
              </p>
              <a
                class="icon-link icon-link-hover acon-text-primary acon-link d-inline-flex align-items-center gap-1"
                href="#"
              >
                <span>Learn More</span>
                <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
              </a>
            </div>
          </div>
        </div>
        <div class="col-12 col-md-6 col-lg-4">
          <div class="card border-0 shadow p-1 h-100 text-start">
            <div class="card-body">
              <div
                class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-3 mb-3"
                style="width: 50px; height: 50px"
              >
                <i class="bi bi-book h3 mb-0 text-white"></i>
              </div>

              <h5 class="card-title fw-bolder acon-text-primary">
                Midwifery Program
              </h5>
              <p class="text-secondary">
                2-year specialized program focusing on maternal and infant care.
              </p>
              <a
                class="icon-link icon-link-hover acon-text-primary acon-link d-inline-flex align-items-center gap-1"
                href="#"
              >
                <span>Learn More</span>
                <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="m-5">
      <CTA />
    </div>
  </div>
</template>

<style scoped></style>

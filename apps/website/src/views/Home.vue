<script lang="js">
import Hero from '../components/Hero.vue';
import CTA from '../components/CTA.vue';

// Import specific school images
import schoolImg2 from '@shared/assets/schoolImg2.jpg';
import schoolImg3 from '@shared/assets/schoolImg3.jpg';
import schoolImg4 from '@shared/assets/schoolImg4.jpg';
import schoolImg5 from '@shared/assets/schoolImg5.jpg';
import schoolImg6 from '@shared/assets/schoolImg6.jpg';
import schoolImg7 from '@shared/assets/schoolImg7.jpg';
import schoolImg8 from '@shared/assets/schoolImg8.jpg';
import schoolImg9 from '@shared/assets/schoolImg9.jpg';
import schoolImg10 from '@shared/assets/schoolImg10.jpg';
import schoolImg11 from '@shared/assets/schoolImg11.jpg';
import schoolImg12 from '@shared/assets/schoolImg12.jpg';
import schoolImg13 from '@shared/assets/schoolImg13.jpg';
import schoolImg14 from '@shared/assets/schoolImg14.jpg';

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
  data() {
    return {
      // Add or remove images as needed, in any order you want
      schoolImages: [
        schoolImg2,
        schoolImg3,
        schoolImg4,
        schoolImg5,
        schoolImg6,
        schoolImg7,
        schoolImg8,
        schoolImg9,
        schoolImg10,
        schoolImg11,
        schoolImg12,
        schoolImg13,
        schoolImg14,
      ]
    };
  },
  computed: {
    registrationUrl() {
      return import.meta.env.VITE_APP_APPLICATION_PORTAL_URL + "/register";
    },
    applicationPortalUrl() {
      return import.meta.env.VITE_APP_APPLICATION_PORTAL_URL;
    }
  }
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
          <div
            id="carouselExample"
            class="carousel slide carousel-fade"
            data-bs-ride="carousel"
          >
            <div class="carousel-inner bg-dark h-100">
              <div
                v-for="(img, idx) in schoolImages"
                :key="img"
                class="carousel-item h-100"
                data-bs-interval="3000"
                :class="{ active: idx === 0 }"
              >
                <img
                  :src="img"
                  class="d-block w-100 h-100 object-fit-cover"
                  :alt="`School Image ${idx + 1}`"
                />
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-6 px-md-5 d-flex flex-column">
          <div class="card text-start border-0 py-2 shadow mb-3">
            <div class="card-body p-0">
              <div class="d-flex">
                <div class="my-auto">
                  <div
                    class="d-inline-flex justify-content-center align-items-center acon-bg-dark rounded-3"
                    style="width: 70px; height: 70px"
                  >
                    <i class="bi bi-book h1 mb-0 text-white"></i>
                  </div>
                </div>

                <div class="ms-3">
                  <h5 class="card-title acon-text-dark fw-bold mb-0">
                    About ALECONS
                  </h5>
                  <p class="card-text text-secondary mb-0">
                    Learn about our history, mission, and commitment to
                    excellence
                  </p>
                  <router-link
                    to="/about"
                    class="icon-link icon-link-hover acon-text-dark acon-link d-inline-flex align-items-center gap-1"
                  >
                    <small>Learn More</small>
                    <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
                  </router-link>
                </div>
              </div>
            </div>
          </div>

          <div class="card text-start border-0 py-2 shadow mb-3">
            <div class="card-body p-0">
              <div class="d-flex">
                <div class="my-auto">
                  <div
                    class="d-inline-flex justify-content-center align-items-center acon-bg-accent rounded-3"
                    style="width: 70px; height: 70px"
                  >
                    <i class="bi bi-people h1 mb-0 text-white"></i>
                  </div>
                </div>
                <div class="ms-3">
                  <h5 class="card-title acon-text-accent fw-bold mb-0">
                    Programs
                  </h5>
                  <p class="card-text text-secondary mb-0">
                    Explore our comprehensive nursing education programs
                  </p>
                  <router-link
                    to="/programs"
                    class="icon-link icon-link-hover acon-text-accent acon-link d-inline-flex align-items-center gap-1"
                  >
                    <small>Learn More</small>
                    <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
                  </router-link>
                </div>
              </div>
            </div>
          </div>

          <div class="card text-start border-0 shadow py-2 mb-3">
            <div class="card-body p-0">
              <div class="d-flex">
                <div class="my-auto">
                  <div
                    class="d-inline-flex justify-content-center align-items-center acon-bg-dark rounded-3"
                    style="width: 70px; height: 70px"
                  >
                    <i class="bi bi-award h1 mb-0 text-white"></i>
                  </div>
                </div>
                <div class="ms-3">
                  <h5 class="card-title acon-text-dark fw-bold mb-0">
                    Faculty
                  </h5>
                  <p class="card-text text-secondary mb-0">
                    Meet our experienced and dedicated faculty members
                  </p>
                  <router-link
                    to="/faculty"
                    class="icon-link icon-link-hover acon-text-dark acon-link d-inline-flex align-items-center gap-1"
                  >
                    <small>Learn More</small>
                    <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
                  </router-link>
                </div>
              </div>
            </div>
          </div>

          <div class="card text-start border-0 shadow py-2 mb-3">
            <div class="card-body p-0">
              <div class="d-flex">
                <div class="my-auto">
                  <div
                    class="d-inline-flex justify-content-center align-items-center acon-bg-accent rounded-3"
                    style="width: 70px; height: 70px"
                  >
                    <i class="bi bi-calendar h1 mb-0 text-white"></i>
                  </div>
                </div>
                <div class="ms-3">
                  <h5 class="card-title acon-text-accent fw-bold mb-0">
                    Admissions
                  </h5>
                  <p class="card-text text-secondary mb-0">
                    Start your application process and join our community
                  </p>
                  <router-link
                    to="/admissions"
                    class="icon-link icon-link-hover acon-text-accent acon-link d-inline-flex align-items-center gap-1"
                  >
                    <small>Learn More</small>
                    <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
                  </router-link>
                </div>
              </div>
            </div>
          </div>

          <div class="card text-start border-0 shadow py-2">
            <div class="card-body p-0">
              <div class="d-flex">
                <div class="my-auto">
                  <div
                    class="d-inline-flex justify-content-center align-items-center acon-bg-dark rounded-3"
                    style="width: 70px; height: 70px"
                  >
                    <i class="bi bi-telephone h1 mb-0 text-white"></i>
                  </div>
                </div>
                <div class="ms-3">
                  <h5 class="card-title acon-text-dark fw-bold mb-0">
                    Contact
                  </h5>
                  <p class="card-text text-secondary mb-0">
                    Get in touch with us for more information
                  </p>
                  <router-link
                    to="/contact"
                    class="icon-link icon-link-hover acon-text-dark acon-link d-inline-flex align-items-center gap-1"
                  >
                    <small>Learn More</small>
                    <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
                  </router-link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="text-center py-5 acon-bg-light">
      <h2 class="fw-bold acon-text-primary mt-5">Why Choose ALECONS?</h2>
      <p class="lead mb-5 text-secondary">
        Join a community of excellence where your nursing career begins with the
        best foundation
      </p>

      <div class="row g-4 mx-0 mx-md-5 mb-5 d-flex align-items-center justify-content-center">
        <!-- TODO: Add more stats as needed, and update the numbers and descriptions to reflect the school's strengths. -->
        <!-- <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100">
            <div class="card-body">
              <h2 class="fw-bolder acon-text-primary">200+</h2>
              <h6 class="fw-bold acon-text-secondary">Active Students</h6>
              <p class="text-secondary">Learning from expert faculty</p>
            </div>
          </div>
        </div> -->
        <!-- <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100">
            <div class="card-body">
              <h2 class="fw-bolder acon-text-primary">95%</h2>
              <h6 class="fw-bold acon-text-secondary">Graduate Success</h6>
              <p class="text-secondary">Employment within 6 months</p>
            </div>
          </div>
        </div> -->
        <!-- TODO: Add more stats as needed, and update the numbers and descriptions to reflect the school's strengths. -->
        <!-- <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100">
            <div class="card-body">
              <h2 class="fw-bolder acon-text-primary">15+</h2>
              <h6 class="fw-bold acon-text-secondary">Years Excellence</h6>
              <p class="text-secondary">Serving Ekiti State</p>
            </div>
          </div>
        </div> -->
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100">
            <div class="card-body">
              <h2 class="fw-bolder acon-text-primary">11+</h2>
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
                class="d-inline-flex justify-content-center align-items-center acon-bg-secondary rounded-3 mb-3"
                style="width: 50px; height: 50px"
              >
                <i class="bi bi-book h3 mb-0 text-white"></i>
              </div>

              <h5 class="card-title fw-bolder acon-text-secondary">
                Basic Nursing
              </h5>

              <p class="text-secondary">
                4-year comprehensive program covering all fundamental nursing
                skills and knowledge.
              </p>

              <router-link
                to="/programs"
                class="icon-link icon-link-hover acon-text-primary acon-link d-inline-flex align-items-center gap-1"
              >
                <span>Learn More</span>
                <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
              </router-link>
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
                Public Health Nursing
                </h5>
                <p class="text-secondary">
                18-month specialized program focusing on community health and disease prevention.
                </p>
              <router-link
                to="/programs"
                class="icon-link icon-link-hover acon-text-primary acon-link d-inline-flex align-items-center gap-1"
              >
                <span>Learn More</span>
                <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
              </router-link>
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
                <i class="bi bi-book h3 mb-0 text-white"></i>
              </div>

              <h5 class="card-title fw-bolder acon-text-secondary">
                Midwifery
              </h5>
              <p class="text-secondary">
                2-year specialized program focusing on maternal and infant care.
              </p>
              <router-link
                to="/programs"
                class="icon-link icon-link-hover acon-text-primary acon-link d-inline-flex align-items-center gap-1"
              >
                <span>Learn More</span>
                <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
              </router-link>
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

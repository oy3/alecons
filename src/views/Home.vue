<script lang="js">
import Hero from '../components/Hero.vue';

export default {
  name: "Home",
  components: {Hero},
};
</script>

<template>
  <div class="container-fluid p-0">
    <Hero />

    <div class="text-center my-5">
      <h2 class="acon-text-primary fw-bold">Explore ACONS</h2>
      <p class="lead">
        Discover everything you need to know about studying at Alebiosu College
        of Nursing Sciences
      </p>

      <div class="row g-0">
        <div class="col-md-6 px-3">
          <iframe
            class="w-100"
            height="315"
            src="https://www.youtube.com/embed/sZqgjguwYog?si=t_L6pugV6AbPMi9Q&amp;controls=0"
            title="YouTube video player"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerpolicy="strict-origin-when-cross-origin"
            allowfullscreen
          ></iframe>
        </div>

        <div class="col-md-6 px-5">
          <div class="card text-start border-0 shadow py-1 mb-3">
            <div class="card-body">
              <div class="d-flex">
                <div class="d-inline-flex acon-bg-primary p-3 rounded-3">
                  <i class="bi bi-book h2 mb-0"></i>
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
            <div class="card-body">
              <div class="d-flex">
                <div class="d-inline-flex acon-bg-secondary p-3 rounded-3">
                  <i class="bi bi-people h2 mb-0"></i>
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
            <div class="card-body">
              <div class="d-flex">
                <div class="d-inline-flex acon-bg-primary p-3 rounded-3">
                  <i class="bi bi-award h2 mb-0"></i>
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
            <div class="card-body">
              <div class="d-flex">
                <div class="d-inline-flex acon-bg-secondary p-3 rounded-3">
                  <i class="bi bi-calendar h2 mb-0"></i>
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
            <div class="card-body">
              <div class="d-flex">
                <div class="d-inline-flex acon-bg-primary p-3 rounded-3">
                  <i class="bi bi-phone h2 mb-0"></i>
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
      <h2 class="fw-bold">Why Choose ACONS?</h2>
      <p class="lead">Join a community of excellence where your nursing career begins with the best foundation</p>
    </div>
  </div>
</template>

<style scoped></style>

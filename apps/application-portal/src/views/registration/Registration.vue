<script lang="js">
import BrandLogo from '../../components/BrandLogo.vue';

export default {
  name: "Registration",
  components: {BrandLogo },
};
</script>

<template>
  <div class="container-fluid vh-100">
    <nav
      class="navbar navbar-light bg-transparent w-100 px-4 navbar-expand-md fixed-top position-absolute"
      style="z-index: 1030"
    >
      <BrandLogo class="navbar-brand" />
    </nav>

    <div class="row h-100">
      <div class="col-md-5 d-none d-md-block px-0">
        <img
          src="../../assets/stethoscope.png"
          class="img-fluid vh-100 w-100 object-fit-cover"
          alt=""
        />
      </div>

      <div
        class="col-md-7 p-5 d-flex align-items-center justify-content-center form-container text-white text-md-dark"
      >
        <div class="mt-md-0 mt-5 pt-5 pt-md-0">
          <h2 class="mb-4">Registration</h2>
          <form action="" class="mb-5">
            <div class="row g-3">
              <div class="col-sm-4">
                <label for="firstName"
                  >First Name <span class="text-danger">*</span></label
                >
                <input
                  type="text"
                  id="firstName"
                  name="firstName"
                  class="form-control"
                  required
                />
              </div>
              <div class="col-sm-4">
                <label for="middleName">Middle Name (optional)</label>
                <input
                  type="text"
                  id="middleName"
                  name="middleName"
                  class="form-control"
                  required
                />
              </div>
              <div class="col-sm-4">
                <label for="lastName"
                  >Last Name <span class="text-danger">*</span></label
                >
                <input
                  type="text"
                  id="lastName"
                  name="lastName"
                  class="form-control"
                  required
                />
              </div>
              <div class="col-sm-6">
                <label for="email"
                  >Email <span class="text-danger">*</span></label
                >
                <input
                  type="email"
                  id="email"
                  name="email"
                  class="form-control"
                  required
                />
              </div>
              <div class="col-sm-6">
                <label for="confirmEmail"
                  >Confirm Email <span class="text-danger">*</span></label
                >
                <input
                  type="email"
                  id="confirmEmail"
                  name="confirmEmail"
                  class="form-control"
                  required
                />
              </div>

              <div class="col-sm-6">
                <label for="phone"
                  >Phone <span class="text-danger">*</span></label
                >
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  class="form-control"
                  required
                />
              </div>
              <div class="col-sm-6">
                <label for="dateOfBirth"
                  >Date of Birth <span class="text-danger">*</span></label
                >
                <input
                  type="date"
                  name="dateOfBirth"
                  class="form-control"
                  id="dateOfBirth"
                  required
                />
              </div>
              <div class="col-sm-4">
                <label for="nationality">
                  Nationality <span class="text-danger">*</span></label
                >
                <input
                  type="text"
                  id="nationality"
                  name="nationality"
                  class="form-control"
                  required
                />
              </div>
              <div class="col-sm-4">
                <label for="stateOfOrigin"
                  >State of Origin <span class="text-danger">*</span></label
                >
                <input
                  type="text"
                  id="stateOfOrigin"
                  name="stateOfOrigin"
                  class="form-control"
                  required
                />
              </div>
              <div class="col-sm-4">
                <label for="lga">LGA <span class="text-danger">*</span></label>
                <input
                  type="text"
                  id="lga"
                  name="lga"
                  class="form-control"
                  required
                />
              </div>

              <div class="col-sm-12 d-flex flex-column">
                <label for="phone">
                  Gender <span class="text-danger">*</span></label
                >
                <div class="row d-inline-flex px-3">
                  <div class="form-check col-md-2">
                    <input
                      class="form-check-input"
                      type="radio"
                      name="radioDefault"
                      id="radioDefault1"
                    />
                    <label class="form-check-label" for="radioDefault1">
                      Male
                    </label>
                  </div>
                  <div class="form-check col-md-2">
                    <input
                      class="form-check-input"
                      type="radio"
                      name="radioDefault"
                      id="radioDefault2"
                    />
                    <label class="form-check-label" for="radioDefault2">
                      Female
                    </label>
                  </div>
                  <div class="form-check col-md-2">
                    <input
                      class="form-check-input"
                      type="radio"
                      name="radioDefault"
                      id="radioDefault3"
                    />
                    <label class="form-check-label" for="radioDefault3">
                      Other
                    </label>
                  </div>
                  <div class="form-check col-md-3">
                    <input
                      class="form-check-input"
                      type="radio"
                      name="radioDefault"
                      id="radioDefault4"
                    />
                    <label class="form-check-label" for="radioDefault4">
                      Prefer not to say
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </form>
          <button type="submit" class="btn btn-acon-primary w-100">
            Apply
          </button>
          <p class="mt-3">
            Already have an account? <router-link to="/">Sign in</router-link>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Image as background for mobile view */
@media (max-width: 768px) {
  .form-container {
    background: url("../../assets/stethoscope.png") no-repeat center center;
    background-size: cover;
    position: relative;
    padding: 2rem;
  }

  /* Dark overlay to make form readable */
  .form-container::before {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
  }

  /* Make form content above overlay */
  .form-container > div {
    position: relative;
    z-index: 1;
  }

  .text-md-dark {
    color: white !important;
  }
}

/* For desktop text colors */
@media (min-width: 769px) {
  .text-md-dark {
    color: #000 !important;
  }
}

/* Transparent navbar text color for dark background */
.navbar.bg-transparent .navbar-brand,
.navbar.bg-transparent .nav-link {
  color: #fff;
}

/* @media (min-width: 768px) {
  .navbar.position-md-absolute {
    position: absolute !important; 
    top: 0;
    left: 0;
    z-index: 10;
  }
} */
</style>

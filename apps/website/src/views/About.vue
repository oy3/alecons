<script lang="js">

export default {
  name: "About",
  metaInfo: {
    title: 'About - Alecons College of Nursing Sciences',
    meta: [
      {
        name: 'description',
        content: 'Learn about Alecons College of Nursing Sciences, our mission, vision, and commitment to producing skilled, compassionate healthcare professionals.'
      },
      {
        name: 'keywords',
        content: 'about Alecons College of Nursing Sciences, nursing school mission, nursing education Nigeria, healthcare training, alecons'
      }
    ]
  },
  components: {},
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
    <div class="acon-bg-primary p-5 text-center">
      <h1 class="text-uppercase fw-bold">About Us</h1>
      <p class="fs-4 mx-0 mx-md-5 fw-light">
        Discover our rich history, mission, and commitment to excellence in
        nursing education. Learn how we're shaping the future of healthcare in
        Nigeria.
      </p>
    </div>

    <div class="p-5 acon-bg-light">
      <p class="fw-light mb-5">
        Alebiosu College of Nursing Sciences (ALECONS) has been a beacon of
        nursing education in Ekiti State since our founding. We are committed to
        developing competent, caring, and ethical nursing professionals who will
        serve their communities with distinction.
      </p>

      <div class="row mb-5">
        <div class="col-md-6">
          <h3 class="fw-bold acon-text-primary">Shaping Healthcare Leaders</h3>
          <p class="text-dark-emphasis fw-light">
            Located in the serene environment of Omuo Oke, Ekiti State, our
            college provides an ideal setting for learning and growth. Our
            modern facilities, experienced faculty, and comprehensive curriculum
            prepare students for successful careers in nursing.
          </p>
          <p class="text-dark-emphasis fw-light">
            We believe that nursing is more than a profession—it's a calling to
            serve humanity with compassion and skill. Our graduates go on to
            become leaders in hospitals, clinics, community health centers, and
            specialized care facilities across Nigeria and beyond.
          </p>

          <div
            class="card p-1 border-0 border-start border-3 shadow mb-3"
            style="border-color: #2d7d7d !important"
          >
            <div class="card-body">
              <h6 class="acon-text-primary fw-bold">Our Mission</h6>
              <p class="fw-light text-dark-emphasis small">
                "To provide exceptional nursing education that produces
                competent, compassionate, and culturally sensitive healthcare
                professionals committed to improving health outcomes in Nigeria
                and beyond."
              </p>
            </div>
          </div>

          <div
            class="card p-1 border-0 border-start border-3 shadow"
            style="border-color: #2d7d7d !important"
          >
            <div class="card-body">
              <h6 class="acon-text-primary fw-bold">Our Vision</h6>
              <p class="fw-light text-dark-emphasis small">
                "To provide exceptional nursing education that produces
                competent, compassionate, and culturally sensitive healthcare
                professionals committed to improving health outcomes in Nigeria
                and beyond."
              </p>
            </div>
          </div>
        </div>

        <div class="col-md-6">
          <div
            class="position-relative d-flex justify-content-center align-items-center"
            style="min-height: 400px; padding: 2rem"
          >
            <!-- Decorative Circles -->
            <div class="circle circle-top-left bg-info opacity-25"></div>
            <div class="circle circle-bottom-right bg-danger opacity-25"></div>

            <!-- Centered Logo/Image -->

            <div class="bg-light">
              <img
                src="/src/assets/img/nurses.png"
                alt="College Logo"
                class="img-fluid rounded-3"
                style="max-width: 400px"
              />
            </div>
          </div>
        </div>
      </div>

      <div class="row g-4 mb-5">
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100 text-center">
            <div class="card-body">
              <div
                class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-circle mb-3"
                style="width: 50px; height: 50px"
              >
                <i class="bi bi-heart h3 m-0 text-white lh-1"></i>
              </div>
              <h6 class="fw-bold acon-text-primary">Compassionate Care</h6>
              <p class="text-secondary fw-light small">
                We instill the values of empathy, kindness, and patient-centered
                care in every aspect of our curriculum.
              </p>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100 text-center">
            <div class="card-body">
              <div
                class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-circle mb-3"
                style="width: 50px; height: 50px"
              >
                <i class="bi bi-book h3 m-0 text-white lh-1"></i>
              </div>
              <h6 class="fw-bold acon-text-primary">Academic Excellence</h6>
              <p class="text-secondary fw-light small">
                Our rigorous academic programs combine theoretical knowledge
                with hands-on clinical experience.
              </p>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100 text-center">
            <div class="card-body">
              <div
                class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-circle mb-3"
                style="width: 50px; height: 50px"
              >
                <i class="bi bi-shield h3 m-0 text-white lh-1"></i>
              </div>
              <h6 class="fw-bold acon-text-primary">Professional Integrity</h6>
              <p class="text-secondary fw-light small">
                We maintain the highest standards of ethics, professionalism,
                and accountability in healthcare.
              </p>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100 text-center">
            <div class="card-body">
              <div
                class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-circle mb-3"
                style="width: 50px; height: 50px"
              >
                <i class="bi bi-mortarboard h3 m-0 text-white lh-1"></i>
              </div>
              <h6 class="fw-bold acon-text-primary">Clinical Expertise</h6>
              <p class="text-secondary fw-light small">
                State-of-the-art facilities and expert faculty ensure our
                graduates are practice-ready professionals.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="p-5 text-center">
      <h2 class="fw-bold acon-text-primary">Our Journey</h2>
      <p class="text-secondary fs-5 fw-light mx-0 mx-md-5">
        From our humble beginnings to becoming Ekiti State's premier nursing
        institution, our journey has been marked by continuous growth and
        excellence.
      </p>

      <div class="row row-cols-1 row-cols-md-3 g-4 mx-0 mx-md-5 mb-5">
        <div class="col">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-body text-start">
              <h4 class="fw-bolder acon-text-secondary">2008</h4>
              <h6 class="fw-bold acon-text-primary">Foundation</h6>
              <p class="text-secondary small fw-light">
                Alebiosu College of Nursing Sciences (ALECONS) was established
                with a vision to provide quality nursing education in Ekiti
                State.
              </p>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-body text-start">
              <h4 class="fw-bolder acon-text-secondary">2012</h4>
              <h6 class="fw-bold acon-text-primary">First Graduates</h6>
              <p class="text-secondary small fw-light">
                Our first cohort of 45 nursing students graduated with excellent
                clinical competencies.
              </p>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-body text-start">
              <h4 class="fw-bolder acon-text-secondary">2015</h4>
              <h6 class="fw-bold acon-text-primary">Accreditation</h6>
              <p class="text-secondary small fw-light">
                Received full accreditation from the Nursing and Midwifery
                Council of Nigeria (NMCN).
              </p>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-body text-start">
              <h4 class="fw-bolder acon-text-secondary">2018</h4>
              <h6 class="fw-bold acon-text-primary">Expansion</h6>
              <p class="text-secondary small fw-light">
                Added Post-Basic Nursing and Midwifery programs to serve diverse
                healthcare needs.
              </p>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-body text-start">
              <h4 class="fw-bolder acon-text-secondary">2020</h4>
              <h6 class="fw-bold acon-text-primary">Modern Facilities</h6>
              <p class="text-secondary small fw-light">
                Opened state-of-the-art simulation labs and expanded clinical
                training partnerships.
              </p>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-body text-start">
              <h4 class="fw-bolder acon-text-secondary">2024</h4>
              <h6 class="fw-bold acon-text-primary">Excellence Award</h6>
              <p class="text-secondary small fw-light">
                Recognized as the leading nursing institution in Ekiti State for
                academic excellence.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="p-5 text-center acon-bg-light">
      <h2 class="fw-bold acon-text-primary">Leadership Team</h2>
      <p class="text-secondary fs-5 fw-light mx-0 mx-md-5 mb-5">
        Meet the experienced leaders who guide our institution's vision and
        ensure the highest standards of nursing education.
      </p>

      <div class="row row-cols-1 row-cols-md-3 g-4">
        <div class="col">
          <div class="card border-0 shadow h-100 p-3">
            <img
              src="/src/assets/img/nurse1.png"
              class="card-img-top rounded-circle object-fit-cover mx-auto d-block"
              style="width: 200px; height: 200px"
              alt="Dr. Adebayo Oluwaseun"
            />
            <div class="card-body">
              <h5 class="card-title acon-text-primary fw-bold">
                Dr. Adebayo Oluwaseun
              </h5>
              <h6 class="acon-text-secondary">
                Provost & Chief Academic Officer
              </h6>
              <p class="card-text fw-ligt text-secondary">PhD, RN, FWACN</p>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border-0 shadow h-100 p-3">
            <img
              src="/src/assets/img/nurse2.jpg"
              class="card-img-top rounded-circle object-fit-cover mx-auto d-block"
              style="width: 200px; height: 200px"
              alt="Dr. Adebayo Oluwaseun"
            />
            <div class="card-body">
              <h5 class="card-title acon-text-primary fw-bold">
                Mrs. Funmilayo Adeyemi
              </h5>
              <h6 class="acon-text-secondary">Deputy Provost</h6>
              <p class="card-text fw-ligt text-secondary">MSN, RN, CNE</p>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border-0 shadow h-100 p-3">
            <img
              src="/src/assets/img/nurse3.jpg"
              class="card-img-top rounded-circle object-fit-cover mx-auto d-block"
              style="width: 200px; height: 200px"
              alt="Dr. Adebayo Oluwaseun"
            />
            <div class="card-body">
              <h5 class="card-title acon-text-primary fw-bold">
                Prof. Emmanuella Ogundipe
              </h5>
              <h6 class="acon-text-secondary">Dean of Academic Affairs</h6>
              <p class="card-text fw-ligt text-secondary">PhD, RN, FWACN</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="acon-bg-dark p-5 text-center">
      <h2 class="fw-bold">Start Your Journey at ALECONS Today!</h2>
      <p class="fs-5 fw-light mx-0 mx-md-5 mb-4" style="color: #fff3f0">
        Apply Now to Alebiosu College of Nursing Sciences – where excellence in
        healthcare education meets compassion. Join a new generation of nurses
        equipped to make a difference in hospitals, communities, and the world.
      </p>
              <a
          :href="registrationUrl"
          target="_blank"
          class="btn btn-outline-light btn-lg px-5"
          rel="noopener noreferrer"
        >
          Apply Now
        </a>
    </div>
  </div>
</template>

<style scoped>
.circle {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  position: absolute;
  z-index: 1;
}

.circle-top-left {
  top: 0px;
  left: 20px;
}

.circle-bottom-right {
  width: 80px !important;
  height: 80px !important;
  bottom: 10px;
  right: 30px;
}
</style>

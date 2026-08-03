<script lang="js">
export default {
  name: "About",
  metaInfo: {
    title: "About - Alecons College of Nursing Sciences",
    meta: [
      {
        name: "description",
        content:
          "Learn about Alecons College of Nursing Sciences, our mission, vision, and commitment to producing skilled, compassionate healthcare professionals.",
      },
      {
        name: "keywords",
        content:
          "about Alecons College of Nursing Sciences, nursing school mission, nursing education Nigeria, healthcare training, alecons",
      },
    ],
  },
  components: {},
  computed: {
    registrationUrl() {
      return import.meta.env.VITE_APP_APPLICATION_PORTAL_URL + "/register";
    },
    applicationPortalUrl() {
      return import.meta.env.VITE_APP_APPLICATION_PORTAL_URL;
    },
  },
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
        Alebiosu College of Nursing Sciences (ALECONS) is a beacon of nursing
        education in Ekiti State. We are committed to developing competent,
        caring and ethical nursing professionals who will serve their
        communities with distinction.
      </p>

      <div class="row mb-5">
        <div class="col-md-6">
          <h3 class="fw-bold acon-text-primary">Shaping Healthcare Leaders</h3>
          <p class="text-dark-emphasis fw-light">
            Located in the serene environment of Omuoke, Ekiti State, our
            college provides an ideal setting for learning and growth. Our
            modern facilities, experienced faculty, and comprehensive curriculum
            prepare students for successful careers in nursing.
          </p>
          <p class="text-dark-emphasis fw-light">
            We believe that nursing is more than a profession—it's a calling to
            serve humanity with compassion and skill. We believe our graduates
            will go on to become leaders in hospitals, clinics, community health
            centers, and specialized care facilities across Nigeria and beyond.
          </p>

          <div
            class="card p-1 border-0 border-start border-3 shadow mb-3"
            style="border-color: #2d7d7d !important"
          >
            <div class="card-body">
              <h6 class="acon-text-primary fw-bold">Our Vision</h6>
              <p class="fw-light text-dark-emphasis small">
                To produce the next generation of nursing leaders and empower
                them to focus on addressing the challenges of a complex and
                diverse healthcare environment. To be one of the world's leading
                sources of high-impact research, evidence and education that
                enables nurses to address healthcare challenges and provide good
                healthcare for all.
              </p>
            </div>
          </div>

          <div
            class="card p-1 border-0 border-start border-3 shadow"
            style="border-color: #2d7d7d !important"
          >
            <div class="card-body">
              <h6 class="acon-text-primary fw-bold">Our Mission</h6>
              <p class="fw-light text-dark-emphasis small">
                For faculty and students to contribute immensely to the health
                of all through innovative and impactful nursing education,
                research, practice, and service.
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
                src="../assets/img/campus2.jpg"
                alt="College Logo"
                class="img-fluid rounded-3 object-fit-cover"
                style="max-width: 400px; height: 400px"
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

    <!-- TODO: Add "Our Journey" timeline section back when we have the content ready -->
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
              <h4 class="fw-bolder acon-text-secondary">2014</h4>
              <h6 class="fw-bold acon-text-primary">Foundation</h6>
              <p class="text-secondary small fw-light">
                Our academic journey in the community began with the
                erection of our very first building, laying the foundation
                for the growth of a purpose-driven learning environment.
              </p>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-body text-start">
              <h4 class="fw-bolder acon-text-secondary">2021</h4>
              <h6 class="fw-bold acon-text-primary">ACAS</h6>
              <p class="text-secondary small fw-light">
                The establishment of Alebiosu College of Art and Sciences
                (ACAS), a major milestone in our vision to broaden access to
                quality, value-driven education across Ekiti State.
              </p>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-body text-start">
              <h4 class="fw-bolder acon-text-secondary">2023</h4>
              <h6 class="fw-bold acon-text-primary">Modern Facilities</h6>
              <p class="text-secondary small fw-light">
                Constructed a solar-powered campus featuring a 1000-capacity
                hall, modern hostel facilities, ongoing hospital and hotel
                projects, while expanding our clinical training partnerships.
              </p>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-body text-start">
              <h4 class="fw-bolder acon-text-secondary">2025</h4>
              <h6 class="fw-bold acon-text-primary">Expansion</h6>
              <p class="text-secondary small fw-light">
                The birth of Alebiosu College of Nursing Sciences (ALECONS)
                marking our dedicated focus on nursing education excellence.
              </p>
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-body text-start">
              <h4 class="fw-bolder acon-text-secondary">2026 Q1</h4>
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
              <h4 class="fw-bolder acon-text-secondary">2026 Q2</h4>
              <h6 class="fw-bold acon-text-primary">First Applicants</h6>
              <p class="text-secondary small fw-light">
                Welcomed our first cohort of applicants to ALECONS, beginning
                our mission to produce excellent nursing professionals.
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
              src="../assets/img/yewande-akute.svg"
              class="card-img-top rounded-circle object-fit-cover mx-auto d-block"
              style="width: 200px; height: 200px"
              alt="Mrs. Yewande Akute"
            />
            <div class="card-body">
              <h5 class="card-title acon-text-primary fw-bold">
                Mrs. Yewande Akute
              </h5>
              <h6 class="acon-text-secondary">Provost</h6>
              <!-- TODO: Update credentials for Provost when we have them -->
              <!-- <p class="card-text fw-ligt text-secondary">PHD, RN</p> -->
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border-0 shadow h-100 p-3">
            <img
              src="../assets/img/olaopa.svg"
              class="card-img-top rounded-circle object-fit-cover mx-auto d-block"
              style="width: 200px; height: 200px"
              alt="Dr. Olatunji Olaopa"
            />
            <div class="card-body">
              <h5 class="card-title acon-text-primary fw-bold">Dr. Olatunji Olaopa</h5>
              <h6 class="acon-text-secondary">HOD Nursing</h6>
              <!-- TODO: Update credentials for HOD Nursing when we have them -->
              <!-- <p class="card-text fw-ligt text-secondary">MSN, RN, CNE</p> -->
            </div>
          </div>
        </div>
        <div class="col">
          <div class="card border-0 shadow h-100 p-3">
            <img
              src="../assets/img/tunji-kehinde.svg"
              class="card-img-top rounded-circle object-fit-cover mx-auto d-block"
              style="width: 200px; height: 200px"
              alt="Mr. Tunji Kehinde"
            />
            <div class="card-body">
              <h5 class="card-title acon-text-primary fw-bold">
                Mr. Tunji Kehinde
              </h5>
              <h6 class="acon-text-secondary">Registrar</h6>
              <!-- TODO: Update credentials for Registrar when we have them -->
              <!-- <p class="card-text fw-ligt text-secondary">PhD, RN, FWACN</p> -->
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="acon-bg-primary-dark p-5 text-center">
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

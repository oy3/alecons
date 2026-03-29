<script lang="js">

export default {
  metaInfo: {
  title: 'Nursing Programs - Alecons College of Nursing Sciences',
  meta: [
    {
      name: 'description',
      content: 'Explore our accredited nursing programs, from basic nursing to advanced diplomas. Develop the skills you need for a successful nursing career.'
    },
    {
      name: 'keywords',
      content: 'nursing programs Nigeria, Alecons College of Nursing Sciences courses, nursing diploma, nursing training Nigeria, alecons'
    }
  ]
},

  name: "Programs",
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
      <h1 class="text-uppercase fw-bold">Our Programs</h1>
      <p class="fs-4 mx-0 mx-md-5 fw-light">
        Comprehensive nursing education programs designed to prepare competent,
        compassionate healthcare professionals for the 21st century.
      </p>
    </div>

    <div class="p-5">
      <div class="row g-4">
        <div class="col-md-4">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-header border-bottom-0 acon-bg-primary p-4">
              <h5 class="card-title fw-bold mb-3">Basic Nursing</h5>
              <!-- <div class="small mb-2"><i class="bi bi-clock"></i> 3 Years</div> -->
              <div class="small mb-2">
                <i class="bi bi-people"></i> 0 Students
              </div>
              <div class="small">
                <i class="bi bi-award"></i> RN Certificate
              </div>
            </div>
            <div class="card-body">
              <p class="card-text fw-light">
                Comprehensive foundational nursing education covering anatomy,
                physiology, pharmacology, and clinical practice. Includes
                extensive hands-on training in our state-of-the-art simulation
                labs.
              </p>
              <h6 class="acon-text-primary fw-bold">Program Highlights:</h6>
              <ul class="card-text fw-light acon-bullet">
                <li>Clinical rotations in partner hospitals</li>
                <li>Simulation-based learning</li>
                <li>Professional development seminars</li>
                <li>NCLEX preparation support</li>
              </ul>
            </div>
            <div class="card-footer bg-white border-top-0 mb-3">
              <button class="btn btn-outline-acon-primary w-100">
                Learn more
              </button>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-header border-bottom-0 acon-bg-secondary p-4">
              <h5 class="card-title fw-bold mb-3">Public Health</h5>
              <div class="small mb-2">
          <i class="bi bi-people"></i> 0 Students
              </div>
              <div class="small"><i class="bi bi-award"></i> Public Health Diploma</div>
            </div>
            <div class="card-body">
              <p class="card-text fw-light">
          Comprehensive program focused on community health, disease prevention, and health promotion. Train to address population health challenges and improve public health outcomes.
              </p>
              <h6 class="acon-text-primary fw-bold">Program Highlights:</h6>
              <ul class="card-text fw-light acon-bullet">
          <li>Epidemiology and disease surveillance</li>
          <li>Community health assessment</li>
          <li>Health promotion and education</li>
          <li>Environmental health management</li>
              </ul>
            </div>
            <div class="card-footer bg-white border-top-0 mb-3">
              <button class="btn btn-outline-acon-primary w-100" disabled>
          Coming Soon
              </button>
            </div>
          </div>
        </div>
        <div class="col-md-4">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-header border-bottom-0 acon-bg-primary p-4">
              <h5 class="card-title fw-bold mb-3">Midwifery</h5>
              <!-- <div class="small mb-2"><i class="bi bi-clock"></i> 2 Years</div> -->
              <div class="small mb-2">
                <i class="bi bi-people"></i> 0 Students
              </div>
              <div class="small">
                <i class="bi bi-award"></i> Certified Midwife
              </div>
            </div>
            <div class="card-body">
              <p class="card-text fw-light">
                Specialized program focusing on maternal and infant care,
                reproductive health, and family planning. Comprehensive training
                in normal and high-risk deliveries.
              </p>
              <h6 class="acon-text-primary fw-bold">Program Highlights:</h6>
              <ul class="card-text fw-light acon-bullet">
                <li>Maternal health specialization</li>
                <li>Neonatal care training</li>
                <li>Community health outreach</li>
                <li>Family planning education</li>
              </ul>
            </div>
            <div class="card-footer bg-white border-top-0 mb-3">
              <button class="btn btn-outline-acon-primary w-100" disabled>
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="p-5 acon-bg-primary-dark text-center">
      <h2 class="fw-bold my-5">Why Choose ALECONS Programs?</h2>

      <div class="row g-4">
        <div class="col-md-4">
          <i class="bi bi-mortarboard display-4 acon-text-secondary"></i>
          <h4 class="fw-semibold">Expert Faculty</h4>
          <p class="fw-light">
            Learn from experienced nursing professionals with advanced degrees
            and clinical expertise.
          </p>
        </div>

        <div class="col-md-4">
          <i class="bi bi-heart display-4 acon-text-secondary"></i>
          <h4 class="fw-semibold">Hands-on Training</h4>
          <p class="fw-light">
            Extensive clinical rotations and simulation-based learning for
            real-world readiness..
          </p>
        </div>

        <div class="col-md-4">
          <i class="bi bi-house display-4 acon-text-secondary"></i>
          <h4 class="fw-semibold">Conducive Learning Environment</h4>
          <p class="fw-light">
            Our facilities are designed to provide a supportive and engaging atmosphere for all students.
          </p>
        </div>
      </div>
    </div>

    <div class="p-5 text-center">
      <h2 class="fw-bold acon-text-primary">Admission Requirements</h2>
      <p class="lead mb-5 text-secondary">
        Ready to join ALECONS? Here are the requirements for admission into our
        nursing programs.
      </p>

      <div class="row g-4 d-flex align-items-center">
        <div class="col-md-6 text-start order-2 order-md-1">
          <h4 class="acon-text-primary fw-bold">General Requirements</h4>
          <ul class="list-unstyled fw-light fs-5 text-secondary">
            <li>
              <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
              Senior Secondary School Certificate (SSCE) with minimum 5 credits
              including English, Mathematics, Biology, Chemistry, and Physics
            </li>
            <li>
              <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
              Minimum age of 17 years at the time of admission
            </li>
            <li>
              <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
              Medical fitness certificate from a recognized medical practitioner
            </li>
            <li>
              <i class="bi bi-check2-circle acon-text-secondary me-2"></i> Valid
              entrance examination score (JAMB UTME or ALECONS entrance exam)
            </li>
            <li>
              <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
              Character reference from a recognized religious leader or
              community leader
            </li>
          </ul>
          <a
            :href="registrationUrl"
            target="_blank"
            class="btn btn-acon-primary btn-lg mt-3"
            rel="noopener noreferrer"
          >
            Start Application
          </a>
        </div>

        <div class="col-md-6 order-1 order-md-2">
          <img
            src="../assets/img/nurse4.png"
            class="img-fluid rounded-4 custom-img"
            alt=""
          />
        </div>
      </div>
    </div>

    <!-- TODO: Add clinical training sites section when we have the content ready. -->
    <!-- <div class="acon-bg-light p-5 text-center">
      <h2 class="fw-bold acon-text-primary">Clinical Training Sites</h2>
      <p class="lead mb-5 text-secondary">
        Our students gain hands-on experience at leading healthcare facilities
        across Ekiti State.
      </p>
      <div class="row g-4 text-start">
        <div class="col-md-6">
          <div class="card border-0 shadow p-2">
            <div class="card-body">
              <h5 class="acon-text-primary">
                <i class="bi bi-hospital me-2 fs-3"></i> Ekiti State University
                Teaching Hospital
              </h5>
              <h6 class="acon-text-secondary">Ado-Ekiti</h6>
              <p class="fw-light m-0">
                General Medicine, Surgery, Pediatrics, Obstetrics & Gynecology
              </p>
            </div>
          </div>
        </div>

        <div class="col-md-6">
          <div class="card border-0 shadow p-2">
            <div class="card-body">
              <h5 class="acon-text-primary">
                <i class="bi bi-hospital me-2 fs-3"></i> Federal Medical Centre
              </h5>
              <h6 class="acon-text-secondary">Ido-Ekiti</h6>
              <p class="fw-light m-0">
                Internal Medicine, Critical Care, Emergency Medicine
              </p>
            </div>
          </div>
        </div>

        <div class="col-md-6">
          <div class="card border-0 shadow p-2">
            <div class="card-body">
              <h5 class="acon-text-primary">
                <i class="bi bi-hospital me-2 fs-3"></i> Omuo General Hospital
              </h5>
              <h6 class="acon-text-secondary">Omuo-Oke</h6>
              <p class="fw-light m-0">
                Community Health, Primary Care, Maternal Health
              </p>
            </div>
          </div>
        </div>

        <div class="col-md-6">
          <div class="card border-0 shadow p-2">
            <div class="card-body">
              <h5 class="acon-text-primary">
                <i class="bi bi-hospital me-2 fs-3"></i>Ijero Local Government
                Health Centers
              </h5>
              <h6 class="acon-text-secondary">Ijero</h6>
              <p class="fw-light m-0">
                Public Health, Immunization, Family Planning
              </p>
            </div>
          </div>
        </div>
      </div>
    </div> -->

    <div class="p-5 text-center">
      <h2 class="fw-bold acon-text-primary">Learning Facilities</h2>
      <p class="lead mb-5 text-secondary">
        Modern facilities and equipment that provide an optimal learning
        environment for our students.
      </p>

      <div class="row g-4 text-start">
        <div class="col-md-3">
          <div class="card border-0 shadow p-0 h-100">
            <img
              src="https://placehold.co/200?text=IMG"
              class="card-img-top"
              style="height: 200px; object-fit: cover"
            />
            <div class="card-body">
              <h5 class="card-title acon-text-primary">
                Simulation Laboratory
              </h5>
              <p class="card-text fw-light">
                State-of-the-art simulation equipment for hands-on clinical
                training
              </p>
            </div>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card border-0 shadow p-0 h-100">
            <img
              src="https://placehold.co/200?text=IMG"
              class="card-img-top"
              style="height: 200px; object-fit: cover"
            />
            <div class="card-body">
              <h5 class="card-title acon-text-primary">Skills Laboratory</h5>
              <p class="card-text fw-light">
                Comprehensive skills training facility with modern nursing
                equipment
              </p>
            </div>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card border-0 shadow p-0 h-100">
            <img
              src="https://placehold.co/200?text=IMG"
              class="card-img-top"
              style="height: 200px; object-fit: cover"
            />
            <div class="card-body">
              <h5 class="card-title acon-text-primary">
                Library & Resource Center
              </h5>
              <p class="card-text fw-light">
                Extensive collection of nursing textbooks, journals, and digital
                resources
              </p>
            </div>
          </div>
        </div>

        <div class="col-md-3">
          <div class="card border-0 shadow p-0 h-100">
            <img
              src="https://placehold.co/200?text=IMG"
              class="card-img-top"
              style="height: 200px; object-fit: cover"
            />
            <div class="card-body">
              <h5 class="card-title acon-text-primary">Computer Laboratory</h5>
              <p class="card-text fw-light">
                Modern computer lab with internet access for research and
                learning
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="acon-bg-light mx-md-5 my-5 px-5 py-4 text-center rounded-4">
        <h4 class="fw-bold acon-text-primary">
          Ready to Start Your Nursing Career?
        </h4>
        <p class="lead mb-5 text-secondary">
          Our admissions team is here to help you choose the right program and
          guide you through the application process. Take the first step towards
          becoming a healthcare professional.
        </p>
        <div class="d-grid d-md-flex justify-content-center gap-3 mx-auto">
                  <a
          :href="registrationUrl"
          target="_blank"
          class="btn btn-acon-primary"
          rel="noopener noreferrer"
        >
          Apply Now
        </a>
        <!-- TODO: Add brochure download link when available -->
          <!-- <button class="btn btn-outline-acon-primary">
            Download Brochure
          </button> -->
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-img {
  height: 80vh;
  width: 100%;
  object-fit: cover;
  object-position: top center;
}

@media (max-width: 767.98px) {
  .custom-img {
    height: 50vh;
    object-fit: cover;
  }
}
</style>

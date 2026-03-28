<script lang="js">
export default {
  metaInfo: {
    title: "Admissions - Alecons College of Nursing Sciences",
    meta: [
      {
        name: "description",
        content:
          "Apply now to Alecons College of Nursing Sciences. Learn about our admissions process, requirements, and deadlines.",
      },
      {
        name: "keywords",
        content:
          "nursing school, admissions, Alecons College of Nursing Sciences, alecons",
      },
    ],
  },
  name: "Admissions",
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
      <h1 class="text-uppercase fw-bold">Admissions</h1>
      <p class="fs-4 mx-0 mx-md-5 fw-light mb-4">
        Join the next generation of healthcare professionals. Start your journey
        towards a rewarding career in nursing at ALECONS.
      </p>
      <div class="d-grid d-md-flex justify-content-center gap-3 mx-auto">
        <a
          :href="registrationUrl"
          target="_blank"
          class="btn btn-acon-secondary px-4 icon-link icon-link-hover d-inline-flex align-items-center justify-content-center gap-1"
          rel="noopener noreferrer"
        >
          Apply Now <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
        </a>
        <button
          class="btn btn-outline-light px-4 d-inline-flex align-items-center gap-2"
          style="--bs-btn-hover-color: #2d7d7d"
          disabled
        >
          Download Brochure <i class="bi bi-download"></i>
        </button>
      </div>
    </div>

    <div class="p-5 text-center">
      <h3 class="fw-bold acon-text-primary">Important Dates</h3>
      <p class="fw-light fs-5 text-muted mb-5">
        Mark your calendar with these key dates for the 2026/2027 academic
        session.
      </p>

      <div class="row g-4 mb-5">
        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100 text-center">
            <div class="card-body">
              <i class="bi bi-calendar-event h4 acon-text-primary"></i>
              <h6 class="acon-text-primary fw-bold mt-2">Application Opens</h6>
              <p class="acon-text-secondary">March 28, 2026</p>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100 text-center">
            <div class="card-body">
              <i class="bi bi-calendar-event h4 acon-text-primary"></i>
              <h6 class="acon-text-primary fw-bold mt-2">
                Application Deadline
              </h6>
              <p class="acon-text-secondary">June 30, 2026</p>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100 text-center">
            <div class="card-body">
              <i class="bi bi-calendar-event h4 acon-text-primary"></i>
              <h6 class="acon-text-primary fw-bold mt-2">
                Entrance Examination
              </h6>
              <p class="acon-text-secondary">July 15, 2026</p>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100 text-center">
            <div class="card-body">
              <i class="bi bi-calendar-event h4 acon-text-primary"></i>
              <h6 class="acon-text-primary fw-bold mt-2">Interview Period</h6>
              <p class="acon-text-secondary">August 5-20, 2026</p>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100 text-center">
            <div class="card-body">
              <i class="bi bi-calendar-event h4 acon-text-primary"></i>
              <h6 class="acon-text-primary fw-bold mt-2">Admission Results</h6>
              <p class="acon-text-secondary">September 1, 2026</p>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100 text-center">
            <div class="card-body">
              <i class="bi bi-calendar-event h4 acon-text-primary"></i>
              <h6 class="acon-text-primary fw-bold mt-2">
                Registration Begins
              </h6>
              <p class="acon-text-secondary">September 15, 2026</p>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100 text-center">
            <div class="card-body">
              <i class="bi bi-calendar-event h4 acon-text-primary"></i>
              <h6 class="acon-text-primary fw-bold mt-2">Orientation Week</h6>
              <p class="acon-text-secondary">October 1-7, 2026</p>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-6 col-lg-3">
          <div class="card border-0 shadow p-1 h-100 text-center">
            <div class="card-body">
              <i class="bi bi-calendar-event h4 acon-text-primary"></i>
              <h6 class="acon-text-primary fw-bold mt-2">Classes Begin</h6>
              <p class="acon-text-secondary">October 10, 2026</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="acon-bg-light p-5 text-center">
      <h3 class="fw-bold acon-text-primary">Admission Process</h3>
      <p class="fw-light fs-5 text-muted mb-5">
        Follow these four simple steps to secure your place at ALECONS.
      </p>

      <div class="row gy-4">
        <!-- Step 1 -->
        <div class="col-md-6">
          <div class="card border-0 shadow h-100 text-start p-3">
            <div class="card-body">
              <div class="d-inline-flex align-items-center">
                <span
                  class="d-inline-flex justify-content-center align-items-center rounded-circle acon-bg-primary me-3"
                  style="width: 36px; height: 36px; aspect-ratio: 1 / 1"
                >
                  1
                </span>
                <h5 class="fw-bold acon-text-primary">
                  Application Submission
                </h5>
                <span
                  class="badge rounded-pill bg-light text-secondary fw-normal ms-2"
                >
                  March - June
                </span>
              </div>

              <p class="mb-3 text-secondary">
                Complete and submit your application form with all required
                documents
              </p>
              <ul class="list-unstyled text-secondary fw-light">
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Completed application form
                </li>
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  SSCE/WAEC certificate
                </li>
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Birth certificate
                </li>
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Passport photographs
                </li>
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Medical fitness certificate
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Step 2 -->
        <div class="col-md-6">
          <div class="card border-0 shadow h-100 text-start p-3">
            <div class="card-body">
              <div class="d-inline-flex align-items-center">
                <span
                  class="d-inline-flex justify-content-center align-items-center rounded-circle acon-bg-primary me-3"
                  style="width: 36px; height: 36px; aspect-ratio: 1 / 1"
                >
                  2
                </span>
                <h5 class="fw-bold acon-text-primary">Entrance Examination</h5>
                <span
                  class="badge rounded-pill bg-light text-secondary fw-normal ms-2"
                >
                  July
                </span>
              </div>

              <p class="mb-3 text-secondary">
                Take the ALECONS entrance examination or use JAMB UTME score
              </p>
              <ul class="list-unstyled text-secondary fw-light">
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Valid JAMB UTME score
                </li>
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  ALECONS entrance examination
                </li>
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Minimum score requirements
                </li>
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Examination fee payment
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Step 3 -->
        <div class="col-md-6">
          <div class="card border-0 shadow h-100 text-start p-3">
            <div class="card-body">
              <div class="d-inline-flex align-items-center">
                <span
                  class="d-inline-flex justify-content-center align-items-center rounded-circle acon-bg-primary me-3"
                  style="width: 36px; height: 36px; aspect-ratio: 1 / 1"
                >
                  3
                </span>
                <h5 class="fw-bold acon-text-primary">Interview & Screening</h5>
                <span
                  class="badge rounded-pill bg-light text-secondary fw-normal ms-2"
                >
                  August
                </span>
              </div>

              <p class="mb-3 text-secondary">
                Attend mandatory interview and document verification
              </p>
              <ul class="list-unstyled text-secondary fw-light">
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Original certificates
                </li>
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Character references
                </li>
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Interview attendance
                </li>
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Document verification
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- Step 4 -->
        <div class="col-md-6">
          <div class="card border-0 shadow h-100 text-start p-3">
            <div class="card-body">
              <div class="d-inline-flex align-items-center">
                <span
                  class="d-inline-flex justify-content-center align-items-center rounded-circle acon-bg-primary me-3"
                  style="width: 36px; height: 36px; aspect-ratio: 1 / 1"
                >
                  4
                </span>
                <h5 class="fw-bold acon-text-primary">Admission Offer</h5>
                <span
                  class="badge rounded-pill bg-light text-secondary fw-normal ms-2"
                >
                  September
                </span>
              </div>

              <p class="mb-3 text-secondary">
                Receive admission offer and complete registration
              </p>
              <ul class="list-unstyled text-secondary fw-light">
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Acceptance of offer
                </li>
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Payment of fees
                </li>
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Registration completion
                </li>
                <li>
                  <i class="bi bi-check2-circle acon-text-secondary me-2"></i>
                  Orientation attendance
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="p-5 text-center">
      <h3 class="fw-bold acon-text-primary">Tuition & Fees</h3>
      <p class="fw-light fs-5 text-muted mb-5">
        Affordable education with flexible payment options and scholarship
        opportunities.
      </p>

      <div class="row gy-4">
        <!-- Basic Nursing Program -->
        <div class="col-md-4">
          <div class="card border-0 shadow text-center h-100">
            <div class="card-body">
              <h5 class="fw-bold acon-text-primary">Basic Nursing Program</h5>
              <p class="acon-text-secondary mb-4">3 Years</p>

              <div class="d-flex justify-content-between">
                <span class="text-muted fw-light">Application fee:</span>
                <span class="fw-medium">₦20,000</span>
              </div>

              <div class="d-flex justify-content-between">
                <span class="text-muted fw-light">Acceptance fee:</span>
                <span class="fw-medium">₦50,000</span>
              </div>

              <div class="d-flex justify-content-between">
                <span class="text-muted fw-light">Sundry Fees:</span>
                <span class="fw-medium">₦280,000</span>
              </div>

              <div class="d-flex justify-content-between">
                <span class="text-muted fw-light">Tuition fee:</span>
                <span class="fw-medium">₦350,000</span>
              </div>

              <hr />

              <div class="d-flex justify-content-between acon-text-primary">
                <span class="fw-medium">Total:</span>
                <span class="fw-bold">₦700,000</span>
              </div>

              <p class="mt-2 text-muted fw-light small">per session</p>
            </div>
          </div>
        </div>

        <!-- TODO: Add Post-Basic Nursing details when available -->
        <!-- Post-Basic Nursing -->
        <div class="col-md-4">
          <div class="card border-0 shadow text-center h-100 position-relative overflow-hidden">
            <div class="program-coming-soon">Coming Soon</div>
            <div class="card-body">
              <h5 class="fw-bold acon-text-primary">Post-Basic Nursing</h5>
              <p class="acon-text-secondary mb-4">18 Months</p>

              <div class="d-flex justify-content-between">
                <span class="text-muted fw-light">Application fee:</span>
                <span class="fw-medium">-</span>
              </div>

              <div class="d-flex justify-content-between">
                <span class="text-muted fw-light">Acceptance fee:</span>
                <span class="fw-medium">-</span>
              </div>

              <div class="d-flex justify-content-between">
                <span class="text-muted fw-light">Sundry Fees:</span>
                <span class="fw-medium">-</span>
              </div>

              <div class="d-flex justify-content-between">
                <span class="text-muted fw-light">Tuition fee:</span>
                <span class="fw-medium">-</span>
              </div>

              <hr />

              <div class="d-flex justify-content-between acon-text-primary">
                <span class="fw-medium">Total:</span>
                <span class="fw-bold">-</span>
              </div>

              <p class="mt-2 text-muted fw-light small">per session</p>
            </div>
          </div>
        </div>

        <!-- TODO: Add Midwifery Program details when available -->
        <!-- Midwifery Program -->
        <div class="col-md-4">
          <div class="card border-0 shadow text-center h-100 position-relative overflow-hidden">
            <div class="program-coming-soon">Coming Soon</div>
            <div class="card-body">
              <h5 class="fw-bold acon-text-primary">Midwifery Program</h5>
              <p class="acon-text-secondary mb-4">2 Years</p>

                 <div class="d-flex justify-content-between">
                <span class="text-muted fw-light">Application fee:</span>
                <span class="fw-medium">-</span>
              </div>

              <div class="d-flex justify-content-between">
                <span class="text-muted fw-light">Acceptance fee:</span>
                <span class="fw-medium">-</span>
              </div>

              <div class="d-flex justify-content-between">
                <span class="text-muted fw-light">Sundry Fees:</span>
                <span class="fw-medium">-</span>
              </div>

              <div class="d-flex justify-content-between">
                <span class="text-muted fw-light">Tuition fee:</span>
                <span class="fw-medium">-</span>
              </div>

              <hr />

              <div class="d-flex justify-content-between acon-text-primary">
                <span class="fw-medium">Total:</span>
                <span class="fw-bold">-</span>
              </div>

              <p class="mt-2 text-muted fw-light small">per session</p>
            </div>
          </div>
        </div> 
    
      </div>
    </div>

    <div class="acon-bg-primary p-3 p-md-5 m-5 text-center rounded-3">
      <h4 class="fw-bold">Payment Plans Available</h4>
      <p class="fs-6 fw-light mx-0 mx-md-5">
        We offer flexible payment plans to help make your nursing education more
        affordable. Contact our financial aid office for more information.
      </p>
      <div class="d-grid gap-2 d-md-flex justify-content-md-center">
        <button class="btn btn-acon-secondary px-5" type="button">
          Learn About Payment Plans
        </button>
        <router-link
          to="/contact"
          class="btn btn-outline-light px-5 d-inline-flex align-items-center justify-content-center"
          style="--bs-btn-hover-color: #a81e1e"
        >
          Contact Financial Services
        </router-link>
      </div>
    </div>

    <!-- TODO: Add scholarship and financial aid information when available -->
    <!-- <div class="acon-bg-light p-5 text-center">
      <h3 class="fw-bold acon-text-primary">Scholarships & Financial Aid</h3>
      <p class="fw-light fs-5 text-muted mb-5">
        Don't let financial constraints limit your dreams. Explore our
        scholarship opportunities.
      </p>

      <div class="row gy-4">
        <div class="col-md-4">
          <div class="card border-0 shadow text-center h-100">
            <div class="card-body">
              <div
                class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-circle mb-3"
                style="width: 50px; height: 50px"
              >
                <i class="bi bi-credit-card h3 m-0 text-white lh-1"></i>
              </div>
              <h5 class="fw-bold acon-text-primary">
                Academic Excellence Scholarship
              </h5>
              <h4 class="acon-text-secondary mb-4">50% tuition reduction</h4>

              <div class="text-start">
                <h6 class="acon-text-primary">Criteria:</h6>
                <p class="fw-light small">
                  Top 5% of entrance examination scores
                </p>
                <h6 class="acon-text-primary">Renewable:</h6>
                <p class="fw-light small mb-0">
                  Yes, based on academic performance
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="card border-0 shadow text-center h-100">
            <div class="card-body">
              <div
                class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-circle mb-3"
                style="width: 50px; height: 50px"
              >
                <i class="bi bi-credit-card h3 m-0 text-white lh-1"></i>
              </div>
              <h5 class="fw-bold acon-text-primary">
                Need-Based Financial Aid
              </h5>
              <h4 class="acon-text-secondary mb-4">Up to ₦100,000</h4>

              <div class="text-start">
                <h6 class="acon-text-primary">Criteria:</h6>
                <p class="fw-light small">Demonstrated financial need</p>
                <h6 class="acon-text-primary">Renewable:</h6>
                <p class="fw-light small mb-0">Yes, subject to annual review</p>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="card border-0 shadow text-center h-100">
            <div class="card-body">
              <div
                class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-circle mb-3"
                style="width: 50px; height: 50px"
              >
                <i class="bi bi-credit-card h3 m-0 text-white lh-1"></i>
              </div>
              <h5 class="fw-bold acon-text-primary">
                Rural Community Scholarship
              </h5>
              <h4 class="acon-text-secondary mb-4">25% tuition reduction</h4>

              <div class="text-start">
                <h6 class="acon-text-primary">Criteria:</h6>
                <p class="fw-light small">
                  Students from underserved rural areas
                </p>
                <h6 class="acon-text-primary">Renewable:</h6>
                <p class="fw-light small mb-0">
                  Yes, with community service requirement
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div> -->

    <div class="acon-bg-secondary p-5 text-center">
      <h2 class="fw-bold">Ready to Apply?</h2>
      <p class="fs-5 fw-light mx-0 mx-md-5 mb-4" style="color: #fff3f0">
        Take the first step towards your nursing career. Our admissions team is
        here to help you through every step of the process.
      </p>
      <div class="d-grid gap-2 d-md-flex justify-content-md-center">
        <a
          :href="registrationUrl"
          target="_blank"
          class="btn btn-acon-dark px-5 icon-link icon-link-hover d-inline-flex align-items-center justify-content-center gap-1"
          rel="noopener noreferrer"
        >
          Start Application <i class="bi bi-arrow-right-short fs-4 h-auto"></i>
        </a>
        <router-link
          to="/contact"
          class="btn btn-outline-light px-5 d-inline-flex align-items-center justify-content-center"
          style="--bs-btn-hover-color: #a85a45"
        >
          Contact Admissions
        </router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.program-coming-soon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(227, 227, 227, 0.82);
  color: #a81e1e;
  font-weight: 700;
  font-size: 1.25rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  z-index: 1;
}
</style>

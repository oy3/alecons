<script lang="js">

export default {
  metaInfo: {
  title: 'Contact - Alecons College of Nursing Sciences',
  meta: [
    {
      name: 'description',
      content: 'Get in touch with Alecons College of Nursing Sciences for admissions, program inquiries, and general information. We are here to help you start your journey in nursing.'
    },
    {
      name: 'keywords',
      content: 'contact Alecons College of Nursing Sciences, nursing school Nigeria contact, admissions help, nursing inquiries, alecons'
    }
  ]
},

    name: "Contact",
    components: {},
};
</script>

<template>
  <div class="container-fluid p-0" style="margin-top: 117px">
    <div class="acon-bg-primary p-5 text-center">
      <h1 class="text-uppercase fw-bold">Contact Us</h1>
      <p class="fs-4 mx-0 mx-md-5 fw-light">
        Get in touch with ALECONS. We're here to answer your questions and help
        you begin your nursing education journey.
      </p>
    </div>

    <div class="p-5 acon-bg-light text-center">
      <h2 class="fw-bold acon-text-primary">Get in Touch</h2>
      <p class="fw-light mx-0 mx-md-5">
        Ready to begin your nursing education journey? We're here to answer your
        questions and help you take the next step. Contact our admissions team
        today.
      </p>

      <div class="card border-0 shadow mt-4">
        <div class="card-body text-start">
          <form>
            <div class="row g-3">
              <div class="col-md-6">
                <label for="firstName" class="form-label">First Name <span class="text-danger">*</span></label>
                <input
                  type="text"
                  class="form-control"
                  id="firstName"
                  placeholder="Enter your first name"
                  required
                />
              </div>

              <div class="col-md-6">
                <label for="lastName" class="form-label">Last Name <span class="text-danger">*</span></label>
                <input
                  type="text"
                  class="form-control"
                  id="lastName"
                  placeholder="Enter your last name"
                  required
                />
              </div>

              <div class="col-md-6">
                <label for="email" class="form-label">Email Address <span class="text-danger">*</span></label>
                <input
                  type="email"
                  class="form-control"
                  id="email"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div class="col-md-6">
                <label for="phone" class="form-label">Phone Number</label>
                <input
                  type="tel"
                  class="form-control"
                  id="phone"
                  placeholder="+234 XXX XXX XXXX"
                  required
                />
              </div>

              <div class="col-12">
                <label for="message" class="form-label">Your Message <span class="text-danger">*</span></label>
                <textarea
                  class="form-control"
                  id="message"
                  rows="5"
                  placeholder="Tell us about your questions or how we can help you..."
                  required
                ></textarea>
              </div>

              <div class="col-12">
                <button type="submit" class="btn btn-acon-primary w-100 mt-3">
                  Send Message <i class="bi bi-send"></i>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>

    <div class="p-5 text-center">
      <h2 class="fw-bold acon-text-primary">Visit Our Campus</h2>
      <p class="text-secondary fs-5 fw-light mx-0 mx-md-5">
        Located in the beautiful and serene environment of Omuo Oke, Ekiti
        State, our campus provides an ideal setting for learning and personal
        growth.
      </p>

      <div class="row g-4 align-items-center mt-3">
        <div class="col-md-6">
          <div class="card border-0 shadow rounded-4 p-2 p-md-4 h-100">
            <div class="card-body">
              <h4 class="fw-bold mb-4 acon-text-primary">Main Campus</h4>

              <div class="mb-3 d-flex text-start">
                <i class="bi bi-geo-alt text-danger fs-5"></i>
                <div class="ms-2">
                  <h6 class="mb-0 fw-semibold text-muted">Address</h6>
                  <p class="mb-0 fw-light text-secondary">
                    Alebiosu College of Nursing<br />Omuo Oke, Ekiti State,
                    Nigeria
                  </p>
                </div>
              </div>

              <div class="mb-3 d-flex text-start">
                <i class="bi bi-telephone text-danger fs-5"></i>
                <div class="ms-2">
                  <h6 class="mb-0 fw-semibold text-muted">Phone</h6>
                  <p class="mb-0 fw-light text-secondary">
                    +234 708 460 1610, +234 916 000 8679
                  </p>
                </div>
              </div>

              <div class="mb-3 d-flex text-start">
                <i class="bi bi-envelope text-danger fs-5"></i>
                <div class="ms-2">
                  <h6 class="mb-0 fw-semibold text-muted">Email</h6>
                  <p class="mb-0 fw-light text-secondary">info@acon.edu.ng</p>
                </div>
              </div>

              <div class="d-flex text-start">
                <i class="bi bi-clock text-danger fs-5"></i>
                <div class="ms-2">
                  <h6 class="mb-0 fw-semibold text-muted">Office Hours</h6>
                  <p class="mb-0 fw-light text-secondary">
                    Monday - Friday: 8:00 AM - 5:00 PM<br />Saturday: 9:00 AM -
                    2:00 PM
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-6">
          <div class="rounded-4 overflow-hidden shadow">
            <img
              src="@shared/assets/schoolImg2.jpg"
              alt="Campus"
              class="img-fluid w-100 h-100"
              style="object-fit: cover"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="p-5 acon-bg-light text-center">
      <h2 class="fw-bold acon-text-primary">Department Contacts</h2>
      <p class="text-secondary fs-5 fw-light mx-0 mx-md-5">
        Get in touch with the right department for your specific needs.
      </p>

      <div class="row g-4 mt-3">
        <div class="col-12 col-md-6 col-lg-6">
          <div class="card border-0 shadow h-100">
            <div class="card-body text-start">
              <h5 class="card-title acon-text-primary text-center">
                Admissions Office
              </h5>
              <div class="mb-2">
                <h6 class="mb-0 fw-semibold acon-text-secondary">
                  Contact Person
                </h6>
                <p class="mb-0 fw-light text-secondary">-</p>
              </div>

              <div class="mb-2">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Phone</h6>
                <p class="mb-0 fw-light text-secondary">-</p>
              </div>

              <div class="mb-2">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Email</h6>
                <p class="mb-0 fw-light text-secondary">
                  admissions@alecons.edu.ng
                </p>
              </div>

              <div class="">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Hours</h6>
                <p class="mb-0 fw-light text-secondary">
                  Monday - Friday: 8:00 AM - 5:00 PM
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-6 col-lg-6">
          <div class="card border-0 shadow h-100">
            <div class="card-body text-start">
              <h5 class="card-title acon-text-primary text-center">
                Student Affairs
              </h5>
              <div class="mb-2">
                <h6 class="mb-0 fw-semibold acon-text-secondary">
                  Contact Person
                </h6>
                <p class="mb-0 fw-light text-secondary">-</p>
              </div>

              <div class="mb-2">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Phone</h6>
                <p class="mb-0 fw-light text-secondary">-</p>
              </div>

              <div class="mb-2">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Email</h6>
                <p class="mb-0 fw-light text-secondary">
                  -
                </p>
              </div>

              <div class="">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Hours</h6>
                <p class="mb-0 fw-light text-secondary">
                  Monday - Friday: 8:00 AM - 5:00 PM
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-6 col-lg-6">
          <div class="card border-0 shadow h-100">
            <div class="card-body text-start">
              <h5 class="card-title acon-text-primary text-center">
                Academic Affairs
              </h5>
              <div class="mb-2">
                <h6 class="mb-0 fw-semibold acon-text-secondary">
                  Contact Person
                </h6>
                <p class="mb-0 fw-light text-secondary">-</p>
              </div>

              <div class="mb-2">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Phone</h6>
                <p class="mb-0 fw-light text-secondary">-</p>
              </div>

              <div class="mb-2">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Email</h6>
                <p class="mb-0 fw-light text-secondary">
                  -
                </p>
              </div>

              <div class="">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Hours</h6>
                <p class="mb-0 fw-light text-secondary">
                  Monday - Friday: 8:00 AM - 5:00 PM
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="col-12 col-md-6 col-lg-6">
          <div class="card border-0 shadow h-100">
            <div class="card-body text-start">
              <h5 class="card-title acon-text-primary text-center">
                Financial Services
              </h5>
              <div class="mb-2">
                <h6 class="mb-0 fw-semibold acon-text-secondary">
                  Contact Person
                </h6>
                <p class="mb-0 fw-light text-secondary">-</p>
              </div>

              <div class="mb-2">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Phone</h6>
                <p class="mb-0 fw-light text-secondary">-</p>
              </div>

              <div class="mb-2">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Email</h6>
                <p class="mb-0 fw-light text-secondary">-
               
                </p>
              </div>

              <div class="">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Hours</h6>
                <p class="mb-0 fw-light text-secondary">
                  Monday - Friday: 8:00 AM - 5:00 PM
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="p-5 text-center">
      <h2 class="fw-bold acon-text-primary">Getting to Campus</h2>
      <p class="text-secondary fs-5 fw-light mx-0 mx-md-5">
        Multiple transportation options are available to reach our campus in
        Omuo Oke, Ekiti State.
      </p>

      <div class="row g-4 mt-3">
        <div class="col-md-4">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-body">
              <div
                class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-circle mb-3"
                style="width: 50px; height: 50px"
              >
                <i class="bi bi-car-front-fill h3 m-0 text-white lh-1"></i>
              </div>
              <h5 class="fw-bold acon-text-primary">By Car</h5>
              <p class="text-start">
                Take the Lagos-Ado-Ekiti Expressway, then follow signs to Omuo
                Oke. The campus is well-signposted from the main road.
              </p>

              <div class="mb-2 text-start">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Duration</h6>
                <p class="mb-0 fw-light text-secondary">
                  From Lagos: 4-5 hours
                </p>
              </div>

              <div class="text-start">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Note</h6>
                <p class="mb-0 fw-light text-secondary">
                  Free parking available on campuss
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-body">
              <div
                class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-circle mb-3"
                style="width: 50px; height: 50px"
              >
                <i class="bi bi-bus-front-fill h3 m-0 text-white lh-1"></i>
              </div>
              <h5 class="fw-bold acon-text-primary">By Bus</h5>
              <p class="text-start">
                Regular bus services available from major cities. Alight at Omuo
                Oke motor park, then take local transport to the campus.
              </p>

              <div class="mb-2 text-start">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Duration</h6>
                <p class="mb-0 fw-light text-secondary">
                  From Lagos: 5-6 hours
                </p>
              </div>

              <div class="text-start">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Note</h6>
                <p class="mb-0 fw-light text-secondary">
                  Bus terminal 5 minutes walk from campus
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-4">
          <div class="card border-0 shadow p-0 h-100">
            <div class="card-body">
              <div
                class="d-inline-flex justify-content-center align-items-center acon-bg-primary rounded-circle mb-3"
                style="width: 50px; height: 50px"
              >
                <i class="bi bi-airplane-engines h3 m-0 text-white lh-1"></i>
              </div>
              <h5 class="fw-bold acon-text-primary">By Air</h5>
              <p class="text-start">
                Fly to Akure Airport (closest), then take road transport to Omuo
                Oke. Alternatively, fly to Lagos and travel by road.
              </p>

              <div class="mb-2 text-start">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Duration</h6>
                <p class="mb-0 fw-light text-secondary">
                  From Lagos: 1 hour flight + 2 hours road
                </p>
              </div>

              <div class="text-start">
                <h6 class="mb-0 fw-semibold acon-text-secondary">Note</h6>
                <p class="mb-0 fw-light text-secondary">
                  Airport shuttle services available
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-12 mt-5">
          <div class="card border-0 p-1" style="background-color: #f0f8f8">
            <div class="card-body">
              <h4 class="fw-bold acon-text-primary mb-3">Nearby Landmarks</h4>
              <ul class="text-start fw-light text-muted row acon-bullet">
                <li class="col-md-4">
                  Omuo Oke General Hospital - 2 minutes walk
                </li>
                <li class="col-md-4">Omuo Oke Market - 5 minutes walk</li>
                <li class="col-md-4">
                  First Bank Omuo Oke Branch - 3 minutes walk
                </li>
                <li class="col-md-4">Omuo Oke Post Office - 4 minutes walk</li>
                <li class="col-md-4">
                  Sacred Heart Catholic Church - 6 minutes walk
                </li>
                <li class="col-md-4">
                  Omuo Oke Police Station - 8 minutes walk
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>

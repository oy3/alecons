<script lang="js">
export default {
    name: "Footer",
    components: {},
};
</script>

<template>
    <div class="container-fluid acon-bg-primary">
        <footer class="pt-5">
            <div class="row">
                <div class="col-md-4 mb-3">
                    <a href="" class="navbar-brand d-flex align-items-center mb-3">
                        <img src="../assets/img/logo.png" alt="ALECON logo" class="bg-white rounded-circle p-1 me-2"
                            width="60" />
                        <div class="text-start text-uppercase d-flex flex-column">
                            <span class="fw-bold text-white">ALEBIOSU COLLEGE</span>
                            <span class="fw-light text-white" style="letter-spacing: 1px; font-size: smaller">
                                OF NURSING Sciences
                            </span>
                        </div>
                    </a>

                    <p class="text-white">
                        Empowering the next generation of healthcare professionals through
                        excellence in nursing education, compassionate care, and clinical
                        expertise.
                    </p>

                    <ul class="no-bullets fw-light small">
                        <li>
                            <i class="bi bi-geo-alt acon-text-secondary fs-5 me-2"></i>
                            <span>Omuo Oke, Ekiti State, Nigeria</span>
                        </li>
                        <li>
                            <i class="bi bi-telephone acon-text-secondary fs-5 me-2"></i>
                            <span>+234 708 460 1610, +234 916 000 8679</span>
                        </li>
                        <li>
                            <i class="bi bi-envelope acon-text-secondary fs-5 me-2"></i>
                            <span>admissions@alecons.edu.ng</span>
                        </li>
                    </ul>

                    <ul class="list-unstyled d-flex mt-3">
                        <li class="me-3">
                            <a href="#"
                                class="d-flex align-items-center justify-content-center text-white bg-white bg-opacity-25 rounded-circle social-link"
                                style="width: 40px; height: 40px;">
                                <i class="bi bi-facebook fs-5"></i>
                            </a>
                        </li>
                        <li class="me-3">
                            <a href="#"
                                class="d-flex align-items-center justify-content-center text-white bg-white bg-opacity-25 rounded-circle social-link"
                                style="width: 40px; height: 40px;">
                                <i class="bi bi-twitter-x fs-5"></i>
                            </a>
                        </li>
                        <li class="me-3">
                            <a href="#"
                                class="d-flex align-items-center justify-content-center text-white bg-white bg-opacity-25 rounded-circle social-link"
                                style="width: 40px; height: 40px;">
                                <i class="bi bi-instagram fs-5"></i>
                            </a>
                        </li>
                    </ul>

                </div>
                <div class="col-6 col-md-3 mb-3">
                    <h5 class="mb-4">Quick Links</h5>
                    <ul class="nav flex-column">
                        <li class="nav-item mb-2">
                            <router-link to="/about" class="nav-link p-0 fw-light">About ALECONS</router-link>
                        </li>
                        <li class="nav-item mb-2">
                            <router-link to="/programs" class="nav-link p-0 fw-light">Programs</router-link>
                        </li>
                        <li class="nav-item mb-2">
                            <router-link to="/admissions" class="nav-link p-0 fw-light">Admissions</router-link>
                        </li>
                        <li class="nav-item mb-2">
                            <router-link to="/faculty" class="nav-link p-0 fw-light">Faculty</router-link>
                        </li>
                        <li class="nav-item mb-2">
                            <a href="#" class="nav-link p-0 text-body-secondary fw-light">Student Life</a>
                        </li>
                        <li class="nav-item mb-2">
                            <a href="#" class="nav-link p-0 text-body-secondary fw-light">Campus Tour</a>
                        </li>
                    </ul>
                </div>
                <div class="col-6 col-md-3 mb-3">
                    <h5 class="mb-4">Our Programs</h5>
                    <ul class="nav flex-column">
                        <li class="nav-item mb-2">
                            <router-link to="/programs" class="nav-link p-0 fw-light">Basic Nursing</router-link>
                        </li>
                        <li class="nav-item mb-2">
                            <router-link to="/programs" class="nav-link p-0 fw-light">Post-Basic Nursing</router-link>
                        </li>
                        <li class="nav-item mb-2">
                            <router-link to="/programs" class="nav-link p-0 fw-light">Midwifery Program</router-link>
                        </li>
                        <li class="nav-item mb-2">
                            <router-link to="/programs" class="nav-link p-0 fw-light">Continuing Education</router-link>
                        </li>
                        <li class="nav-item mb-2">
                            <router-link to="/programs" class="nav-link p-0 fw-light">Clinical Rotations</router-link>
                        </li>
                        <li class="nav-item mb-2">
                            <router-link to="/programs" class="nav-link p-0 fw-light">Simulation Labs</router-link>
                        </li>
                    </ul>
                </div>
                <div class="col-6 col-md-2 mb-3">
                    <h5 class="mb-4">Student Resources</h5>
                    <ul class="nav flex-column">
                        <li class="nav-item mb-2">
                            <a href="#" class="nav-link p-0 fw-light">Student Portal</a>
                        </li>
                        <li class="nav-item mb-2">
                            <a href="#" class="nav-link p-0 fw-light">Library Sciences</a>
                        </li>
                        <li class="nav-item mb-2">
                            <a href="#" class="nav-link p-0 fw-light">Academic Calendar</a>
                        </li>
                        <li class="nav-item mb-2">
                            <a href="#" class="nav-link p-0 fw-light">Financial Aid</a>
                        </li>
                        <li class="nav-item mb-2">
                            <a href="#" class="nav-link p-0 fw-light">Housing</a>
                        </li>
                        <li class="nav-item mb-2">
                            <a href="#" class="nav-link p-0 fw-light">Career Sciences</a>
                        </li>
                    </ul>
                </div>
            </div>
            <div class="d-flex flex-column flex-sm-row justify-content-between pt-4 mt-4 border-top">
                <p>
                    © 2025 Alebiosu College of Nursing Sciences (ALECONS). All rights
                    reserved.
                </p>
                <ul class="list-unstyled d-flex ">
                    <li class="ms-3">
                        <a class="acon-link text-white fw-light small" href="#" aria-label="Privacy Policy">
                            Privacy Policy
                        </a>
                    </li>
                    <li class="ms-3">
                        <a class="acon-link text-white fw-light small" href="#" aria-label="TOS">
                            Terms of Service
                        </a>
                    </li>
                    <li class="ms-3">
                        <a class="acon-link text-white fw-light small" href="#" aria-label="Accessibility">
                            Accessibility
                        </a>
                    </li>
                </ul>
            </div>
        </footer>
    </div>
</template>

<style scoped>
.nav-item .nav-link {
    color: #fff !important;
}

.nav-item .nav-link.active,
.nav-item .nav-link:hover,
.nav-item .nav-link.active:hover {
    color: #e07a5f !important;
}

ul.no-bullets {
    list-style-type: none;
    padding: 0;
    margin: 0;
}

.social-link:hover {
    background-color: #e07a5f !important;
    color: white !important;
}
</style>

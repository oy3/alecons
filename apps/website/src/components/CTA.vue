<script lang="js">
export default {
    name: "CTA",
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
    <div class="container-fluid acon-bg-primary p-5 text-center rounded-5">
        <h2>Ready to Start Your Nursing Career?</h2>
        <p class="fs-5 fw-light mx-0 mx-md-5">Join thousands of successful nursing graduates who started their journey at ALECONS. Apply
            today and take the
            first step towards becoming a healthcare professional.</p>
        <div class="d-grid gap-2 d-md-flex justify-content-md-center">
                    <a
          :href="registrationUrl"
          target="_blank"
          class="btn btn-acon-secondary btn-lg px-5"
          rel="noopener noreferrer"
        >
          Apply Now
        </a>
            <button class="btn btn-outline-light btn-lg px-5" style="--bs-btn-hover-color: #2d7d7d" type="button">Schedule Campus
                Tour</button>
        </div>
    </div>
</template>

<style scoped></style>

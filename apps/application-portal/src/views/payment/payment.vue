<script>
export default {
  name: "Payment",
  components: {},
};
</script>

<template>
  <div class="mt-3 p-5">
    <h5>Payments</h5>
    <hr />

    <div class="row">
      <div class="col-md-8 mx-auto">
        <div class="mb-5">
          <h6 class="fw-bold">Unpaids charges</h6>
          <ul class="list-unstyled">
            <li
              class="d-flex justify-content-between align-items-center mb-3"
            >
            <div class="d-grid">
              <span>Acceptance Fee</span>
              <span class="fw-bold">₦10,000.00</span>
            </div>
            <button class="btn btn-acon-primary btn-sm">Pay Now</button>
            </li>
          </ul>
        </div>

        <div class="mb-5">
          <h6 class="fw-bold">Paid Charges</h6>
          <ul class="list-unstyled">
            <li
              class="d-flex justify-content-between align-items-center mb-3"
            >
            <div class="d-grid">
              <span>Form Fee</span>
              <span class="fw-bold">₦20,000.00</span>
            </div>
            <button class="btn btn-outline-secondary btn-sm">View Receipt</button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>

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
            <li class="d-flex justify-content-between align-items-center mb-3">
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
            <li class="d-flex justify-content-between align-items-center mb-3">
              <div class="d-grid">
                <span>Form Fee</span>
                <span class="fw-bold">₦20,000.00</span>
              </div>
              <button
                class="btn btn-outline-secondary btn-sm"
                type="button"
                data-bs-toggle="offcanvas"
                data-bs-target="#offcanvasViewReceipt"
                aria-controls="offcanvasViewReceipt"
              >
                View Receipt
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- View Receipt OffCanvas -->
    <div
      class="offcanvas offcanvas-end"
      tabindex="-1"
      id="offcanvasViewReceipt"
      aria-labelledby="offcanvasViewReceiptLabel"
    >
      <div class="offcanvas-header">
        <h5 class="offcanvas-title fw-bold" id="offcanvasViewReceiptLabel">
          Payment Receipt
        </h5>
        <button
          type="button"
          class="btn-close"
          data-bs-dismiss="offcanvas"
          aria-label="Close"
        ></button>
      </div>
      <div class="offcanvas-body">
        <div class="d-grid text-center mb-5">
          <h5 class="fw-bold acon-text-primary">₦20,000.00</h5>
          <span>Form Fee</span>
          <small class="text-body-secondary">on August 02, 2025</small>
        </div>

        <div class="mb-5">
          <ul class="list-group list-group-flush">
            <li class="list-group-item d-grid">
              <small>Description</small>
              <span class="fw-bold">Form Fee</span>
            </li>
            <li class="list-group-item d-flex justify-content-between">
              <div class="d-grid">
                <small>Payment Method</small>
                <span class="fw-bold">Paystack</span>
              </div>
              <div class="d-grid text-center">
                <small>fees</small>
                <span class="badge rounded-pill acon-bg-secondary">₦0.00</span>
              </div>
            </li>
            <li class="list-group-item">
              <div class="d-grid">
                <small>Reference</small>
                <span class="fw-bold">ALC-1-1753318732161</span>
              </div>
            </li>
            <li class="list-group-item">
              <div class="d-flex flex-column align-items-start">
                <small>Status</small>
                <span class="text-success fs-6 fw-bolder mt-2">Successful</span>
              </div>
            </li>
          </ul>
        </div>

        <div class="d-grid gap-2 d-md-flex justify-content-md-end">
          <button class="btn btn-acon-primary me-md-2" type="button">Download PDF</button>
          <button class="btn btn-outline-acon-primary" type="button">Send to mail</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>

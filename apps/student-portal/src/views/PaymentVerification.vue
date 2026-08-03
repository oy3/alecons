<script>
import Swal from "sweetalert2";
import { studentPaymentService } from "../services/payment.js";
import { logger } from "@shared/utils/logger";

export default {
  name: "PaymentVerification",
  data() {
    return {
      isVerifying: true,
      statusMessage: "Verifying payment with Paystack...",
    };
  },
  async mounted() {
    const reference = this.$route.params.reference;

    if (!reference) {
      this.statusMessage = "Missing payment reference.";
      this.isVerifying = false;
      return;
    }

    try {
      const result = await studentPaymentService.verifyPayment(reference);

      if (!result.success) {
        throw new Error(result.message || "Payment verification failed");
      }

      await Swal.fire({
        icon: "success",
        title: "Payment Verified",
        text: "Your payment has been verified successfully.",
        confirmButtonColor: "#1a5f5f",
      });

      this.$router.replace("/finance");
    } catch (error) {
      logger.error("Payment callback verification failed:", error);

      await Swal.fire({
        icon: "error",
        title: "Verification Failed",
        text: error.message || "Unable to verify this payment right now.",
        confirmButtonColor: "#1a5f5f",
      });

      this.$router.replace("/finance");
    } finally {
      this.isVerifying = false;
    }
  },
};
</script>

<template>
  <div class="container py-5">
    <div class="row justify-content-center">
      <div class="col-md-8 col-lg-6">
        <div class="card shadow-sm border-0">
          <div class="card-body text-center py-5">
            <div
              v-if="isVerifying"
              class="spinner-border text-primary mb-3"
              role="status"
            >
              <span class="visually-hidden">Loading...</span>
            </div>
            <h5 class="mb-2">Payment Verification</h5>
            <p class="text-muted mb-0">{{ statusMessage }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

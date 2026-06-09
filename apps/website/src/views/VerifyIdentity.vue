<script>
import { publicApiService } from "../services/publicApi";
import { toTitleCase } from "@shared/utils/string";

export default {
  name: "VerifyIdentity",
  metaInfo() {
    return {
      title: "Verify Identity | ALECONS",
      meta: [
        {
          name: "robots",
          content: "noindex, nofollow",
        },
        {
          name: "description",
          content:
            "Public identity verification page for ALECONS student and staff ID cards.",
        },
      ],
    };
  },
  data() {
    return {
      isLoading: true,
      error: "",
      verification: null,
    };
  },
  async mounted() {
    await this.loadVerificationRecord();
  },
  watch: {
    "$route.params.token": {
      async handler() {
        await this.loadVerificationRecord();
      },
    },
  },
  computed: {
    identity() {
      return this.verification?.identity || {};
    },
    formattedFullName() {
      return toTitleCase(this.identity.fullName || "");
    },
    verifiedOnLabel() {
      if (!this.verification?.verifiedAt) {
        return "";
      }

      return new Intl.DateTimeFormat("en-NG", {
        dateStyle: "long",
        timeStyle: "short",
      }).format(new Date(this.verification.verifiedAt));
    },
    isStudent() {
      return this.verification?.type === "student";
    },
  },
  methods: {
    async loadVerificationRecord() {
      const token = this.$route.params.token;

      if (!token) {
        this.error = "Verification token is missing.";
        this.isLoading = false;
        return;
      }

      try {
        this.isLoading = true;
        this.error = "";
        const response = await publicApiService.getVerificationRecord(token);
        this.verification = response.data;
      } catch (error) {
        this.error =
          error.message || "Unable to verify this identity card right now.";
        this.verification = null;
      } finally {
        this.isLoading = false;
      }
    },
  },
};
</script>

<template>
  <section class="verify-page py-5">
    <div class="container" style="margin-top: 117px">
      <div class="row justify-content-center">
        <div class="col-lg-9 col-xl-8">
          <div class="verify-shell shadow-sm border-0 overflow-hidden">
            <div class="verify-hero p-4 p-lg-5 text-white">
              <div class="d-flex flex-column flex-md-row justify-content-between gap-3">
                <div>
                  <div class="text-uppercase small fw-semibold opacity-75 mb-2">
                    ALECONS Identity Verification
                  </div>
                  <h1 class="h3 fw-bold mb-2">Public ID Card Verification</h1>
                  <p class="mb-0 opacity-75">
                    This page confirms institution identity only and does not grant
                    access to any portal account.
                  </p>
                </div>
                <div
                  v-if="verification"
                  class="verify-stamp align-self-start align-self-md-center"
                >
                  <i class="bi bi-patch-check-fill me-2"></i>
                  Verified
                </div>
              </div>
            </div>

            <div class="bg-white p-4 p-lg-5">
              <div v-if="isLoading" class="text-center py-5">
                <div class="spinner-border text-primary mb-3" role="status">
                  <span class="visually-hidden">Loading...</span>
                </div>
                <h5 class="fw-semibold mb-2">Checking identity record</h5>
                <p class="text-muted mb-0">
                  Please wait while ALECONS verifies this card.
                </p>
              </div>

              <div v-else-if="error" class="text-center py-5">
                <div class="verify-icon danger mx-auto mb-3">
                  <i class="bi bi-shield-x"></i>
                </div>
                <h5 class="fw-bold mb-2">Verification Unavailable</h5>
                <p class="text-muted mb-0">{{ error }}</p>
              </div>

              <div v-else-if="verification" class="row g-3 align-items-start">
                <div class="col-lg-4">
                  <div class="verify-photo-card h-100">
                    <div
                      v-if="isStudent && identity.photoUrl"
                      class="verify-photo-wrap mb-3"
                    >
                      <img
                        :src="identity.photoUrl"
                        :alt="`${formattedFullName} photograph`"
                        class="verify-photo"
                      />
                    </div>
                    <div v-else class="verify-photo-placeholder mb-3">
                      <i class="bi bi-person-badge"></i>
                    </div>

                    <div class="small text-uppercase text-muted fw-semibold mb-2">
                      Verification Details
                    </div>
                    <div class="verify-meta-item mb-2">
                      <span class="text-muted">Identity Type</span>
                      <strong>{{ verification.type }}</strong>
                    </div>
                    <div class="verify-meta-item">
                      <span class="text-muted">Verified On</span>
                      <strong>{{ verifiedOnLabel }}</strong>
                    </div>
                  </div>
                </div>

                <div class="col-lg-8">
                  <div class="verify-status-banner mb-4">
                    <div>
                      <div class="small text-uppercase fw-semibold text-muted mb-1">
                        Current Status
                      </div>
                      <div class="h5 fw-bold mb-0">{{ identity.status }}</div>
                    </div>
                  </div>

                  <div class="row g-3">
                    <div class="col-md-6">
                      <div class="verify-info-card h-100">
                        <small class="verify-label">Full Name</small>
                        <div class="verify-value">{{ formattedFullName }}</div>
                      </div>
                    </div>

                    <div class="col-md-6">
                      <div class="verify-info-card h-100">
                        <small class="verify-label">
                          {{ isStudent ? "Matric Number" : "Staff ID" }}
                        </small>
                        <div class="verify-value">
                          {{ isStudent ? identity.matricNumber : identity.staffId }}
                        </div>
                      </div>
                    </div>

                    <div v-if="isStudent" class="col-md-6">
                      <div class="verify-info-card h-100">
                        <small class="verify-label">Programme</small>
                        <div class="verify-value">{{ identity.programme }}</div>
                      </div>
                    </div>

                    <div class="col-md-6">
                      <div class="verify-info-card h-100">
                        <small class="verify-label">Department</small>
                        <div class="verify-value">{{ identity.department }}</div>
                      </div>
                    </div>

                    <div v-if="isStudent" class="col-md-6">
                      <div class="verify-info-card h-100">
                        <small class="verify-label">Current Level</small>
                        <div class="verify-value">
                          {{ identity.currentLevel ? `Year ${identity.currentLevel}` : "N/A" }}
                        </div>
                      </div>
                    </div>

                    <div v-else class="col-md-6">
                      <div class="verify-info-card h-100">
                        <small class="verify-label">Position</small>
                        <div class="verify-value">{{ identity.position }}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.verify-page {
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(13, 110, 253, 0.12), transparent 26%),
    linear-gradient(180deg, #f8fbff 0%, #eef4f3 100%);
}

.verify-shell {
  border-radius: 1.5rem;
  background: #fff;
}

.verify-hero {
  background: linear-gradient(135deg, #fb0606 0%, #bd0b0b 100%);
}

.verify-stamp {
  display: inline-flex;
  align-items: center;
  padding: 0.65rem 1rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.16);
  font-weight: 700;
}

.verify-photo-card,
.verify-info-card,
.verify-status-banner {
  border: 1px solid #e9ecef;
  border-radius: 1.25rem;
  background: #fff;
}

.verify-photo-card {
  padding: 1.25rem;
}

.verify-photo-wrap,
.verify-photo-placeholder {
  width: 100%;
  aspect-ratio: 4 / 5;
  border-radius: 1rem;
  overflow: hidden;
  background: linear-gradient(180deg, #f4f7fb 0%, #edf2f7 100%);
}

.verify-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.verify-photo-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6c757d;
  font-size: 3rem;
}

.verify-meta-item {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.verify-status-banner {
  padding: 1rem 1.25rem;
  background: #f8fbff;
}

.verify-info-card {
  padding: 1rem 1.1rem;
}

.verify-label {
  display: block;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #6c757d;
  margin-bottom: 0.45rem;
}

.verify-value {
  font-weight: 700;
  color: #1f2937;
  word-break: break-word;
}

.verify-icon {
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
}

.verify-icon.danger {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}
</style>
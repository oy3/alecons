<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import Swal from "sweetalert2";
import { accommodationService } from "../services/accommodation.js";
import {
  emergencyContacts,
  hostelRules,
  moveInGuide,
} from "../data/accommodationResources.js";

const router = useRouter();
const loading = ref(true);
const error = ref("");
const overview = ref(null);
const resource = ref(null);
const downloading = ref("");

const workflowSteps = [
  {
    number: 1,
    title: "Complete Agreement",
    description: "Read and sign your hostel tenancy agreement.",
  },
  {
    number: 2,
    title: "Pay Accommodation Fee",
    description: "Make payment for your hostel fees.",
  },
  {
    number: 3,
    title: "Get Room Allocation",
    description: "Receive your hostel, block and room details.",
  },
];

const applicationStatus = computed(
  () => overview.value?.application?.status || "not_started",
);
const agreementComplete = computed(
  () => overview.value?.agreement?.status !== "not_started",
);
const paymentComplete = computed(() =>
  ["paid_awaiting_allocation", "allocated"].includes(applicationStatus.value),
);
const allocated = computed(
  () => applicationStatus.value === "allocated" && !!overview.value?.assignment,
);
const activeStep = computed(() =>
  !agreementComplete.value ? 1 : !paymentComplete.value ? 2 : 3,
);
const status = computed(() => {
  if (allocated.value) {
    return {
      label: "Active",
      alertClass: "alert-success",
      badgeClass: "text-bg-success",
      icon: "bi-check-circle-fill",
      title: "Your accommodation is confirmed.",
      text: "You have completed all required steps and your room has been allocated.",
    };
  }
  if (paymentComplete.value) {
    return {
      label: "Awaiting allocation",
      alertClass: "alert-warning",
      badgeClass: "text-bg-warning",
      icon: "bi-clock-fill",
      title: "Your payment has been confirmed.",
      text: "Your room allocation is being processed.",
    };
  }
  if (applicationStatus.value === "payment_pending_review") {
    return {
      label: "Payment review",
      alertClass: "alert-warning",
      badgeClass: "text-bg-warning",
      icon: "bi-clock-fill",
      title: "Your payment is being reviewed.",
      text: "Allocation will begin after the payment is verified.",
    };
  }
  return {
    label: "Pending",
    alertClass: "bg-warning bg-opacity-10",
    badgeClass: "text-bg-warning",
    icon: "bi-clock-fill",
    title: "Your accommodation is not yet confirmed.",
    text: "Complete the required steps below to get your room allocation.",
  };
});
const resourceTitle = computed(() => {
  if (resource.value === "rules") return "Hostel Rules";
  if (resource.value === "contacts") return "Emergency Contacts";
  return "Move-in Guide";
});

function stepComplete(number) {
  return (
    (number === 1 && agreementComplete.value) ||
    (number === 2 && paymentComplete.value) ||
    (number === 3 && allocated.value)
  );
}

async function load() {
  loading.value = true;
  error.value = "";
  const response = await accommodationService.getOverview();
  if (response.success) overview.value = response.data;
  else {
    error.value =
      response.error || "Could not load your accommodation details.";
  }
  loading.value = false;
}

async function download(type) {
  try {
    downloading.value = type;
    await accommodationService.downloadDocument(type);
  } catch (downloadError) {
    Swal.fire({
      icon: "error",
      title: "Download failed",
      text: downloadError.message,
    });
  } finally {
    downloading.value = "";
  }
}

function openResource(type) {
  resource.value = type;
}

onMounted(load);
</script>

<template>
  <main class="container-fluid portal-page px-3 px-lg-4 py-4">
    <header
      class="d-flex flex-column flex-md-row align-items-md-start justify-content-between gap-2 mb-4"
    >
      <div>
        <h1 class="h2 fw-bold text-dark mb-1">
          <i class="bi bi-building text-primary me-2"></i>My Accommodation
        </h1>
        <p class="text-muted mb-0">
          Manage your hostel allocation, agreement and accommodation documents.
        </p>
      </div>
      <nav class="small text-muted d-none d-md-block" aria-label="Breadcrumb">
        Dashboard <i class="bi bi-chevron-right mx-2"></i> Accommodation
      </nav>
    </header>

    <section v-if="loading" class="card portal-card" aria-live="polite">
      <div
        class="card-body d-flex align-items-center justify-content-center gap-2 py-5 text-muted"
      >
        <span
          class="spinner-border spinner-border-sm"
          aria-hidden="true"
        ></span>
        Loading accommodation details...
      </div>
    </section>

    <section v-else-if="error" class="alert alert-danger text-center py-5">
      <p class="mb-3">{{ error }}</p>
      <button class="btn btn-outline-danger" type="button" @click="load">
        <i class="bi bi-arrow-clockwise me-1"></i>Retry
      </button>
    </section>

    <template v-else-if="overview">
      <section class="card portal-card mb-3">
        <div class="card-body p-3 p-lg-4">
          <div class="row g-4 align-items-center">
            <div class="col-xl-5">
              <div class="d-flex align-items-center gap-3 gap-lg-4">
                <img
                  v-if="overview.student.profileImageUrl"
                  :src="overview.student.profileImageUrl"
                  class="portal-avatar rounded-circle bg-light"
                  alt="Student profile"
                />
                <span
                  v-else
                  class="portal-avatar rounded-circle bg-light d-inline-flex align-items-center justify-content-center fs-1"
                  aria-hidden="true"
                >
                  <i class="bi bi-person"></i>
                </span>
                <div class="overflow-hidden">
                  <h2 class="h5 fw-bold text-dark mb-1 text-capitalize">
                    {{ overview.student.fullName }}
                  </h2>
                  <p class="text-muted mb-3">
                    {{ overview.student.matriculationNumber }}
                  </p>
                  <div class="d-flex flex-wrap gap-4">
                    <div>
                      <span class="d-block small text-muted">Programme</span>
                      <strong class="text-dark">{{
                        overview.student.program
                      }}</strong>
                    </div>
                    <div>
                      <span class="d-block small text-muted">Session</span>
                      <strong class="text-dark">{{
                        overview.student.session
                      }}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="col-md-6 col-xl-3">
              <div class="alert h-100 mb-0 p-3" :class="status.alertClass">
                <span class="badge rounded-pill mb-2" :class="status.badgeClass">
                  <i class="bi me-1" :class="status.icon"></i>{{ status.label }}
                </span>
                <strong class="d-block text-dark mb-1 small">{{
                  status.title
                }}</strong>
                <p class="small text-muted mb-0 small">{{ status.text }}</p>
              </div>
            </div>

            <div class="col-md-6 col-xl-4">
              <dl class="row small mb-0 border-start ms-md-2 ps-md-3">
                <dt class="col-5 text-muted fw-normal mb-2">
                  <i class="bi bi-building me-2"></i>Hostel
                </dt>
                <dd
                  class="col-7 fw-semibold mb-2"
                  :class="allocated ? 'text-dark' : 'text-danger'"
                >
                  {{ overview.assignment?.hostel || "Not yet allocated" }}
                </dd>
                <dt class="col-5 text-muted fw-normal mb-2">
                  <i class="bi bi-layers me-2"></i>Block
                </dt>
                <dd class="col-7 fw-semibold text-dark mb-2">
                  {{ overview.assignment?.block || "Not yet allocated" }}
                </dd>
                <dt class="col-5 text-muted fw-normal mb-2">
                  <i class="bi bi-door-open me-2"></i>Room
                </dt>
                <dd class="col-7 fw-semibold text-dark mb-2">
                  {{
                    overview.assignment
                      ? `${overview.assignment.room} · Slot ${overview.assignment.slotNumber}`
                      : "Not yet allocated"
                  }}
                </dd>
                <dt class="col-5 text-muted fw-normal mb-2">
                  <i class="bi bi-credit-card me-2"></i>Payment
                </dt>
                <dd
                  class="col-7 fw-semibold mb-2"
                  :class="paymentComplete ? 'text-success' : 'text-danger'"
                >
                  {{
                    paymentComplete
                      ? "Paid"
                      : overview.application?.status ===
                          "payment_pending_review"
                        ? "Under review"
                        : "Pending"
                  }}
                </dd>
                <dt class="col-5 text-muted fw-normal mb-0">
                  <i class="bi bi-file-earmark-text me-2"></i>Agreement
                </dt>
                <dd
                  class="col-7 fw-semibold mb-0"
                  :class="agreementComplete ? 'text-success' : 'text-danger'"
                >
                  {{ agreementComplete ? "Signed" : "Not completed" }}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section
        class="card portal-card mb-3"
        aria-label="Accommodation progress"
      >
        <div class="card-body p-3 p-lg-4">
          <div class="row row-cols-1 row-cols-lg-3 g-3">
            <div v-for="item in workflowSteps" :key="item.number" class="col">
              <div class="d-flex align-items-center gap-3 h-100">
                <span
                  class="portal-step-indicator"
                  :class="{
                    'is-complete': stepComplete(item.number),
                    'is-active':
                      activeStep === item.number && !stepComplete(item.number),
                  }"
                >
                  <i
                    v-if="stepComplete(item.number)"
                    class="bi bi-check-lg"
                  ></i>
                  <template v-else>{{ item.number }}</template>
                </span>
                <span>
                  <strong class="d-block text-dark">{{ item.title }}</strong>
                  <small class="d-block text-muted">{{
                    item.description
                  }}</small>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="card portal-card mb-3">
        <div class="card-body p-3 p-lg-4">
          <div
            class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-1 mb-3"
          >
            <h2 class="h5 fw-bold text-dark mb-0">
              <i class="bi bi-file-earmark-text text-primary me-2"></i>Documents
              &amp; Actions
            </h2>
            <span class="small text-muted">
              {{
                allocated
                  ? "Access and manage your accommodation documents."
                  : "Complete the required items to get your accommodation."
              }}
            </span>
          </div>

          <div class="row row-cols-1 row-cols-xl-3 g-3">
            <article class="col">
              <div class="border rounded-2 p-3 h-100 d-flex flex-column">
                <div class="d-flex gap-3">
                  <span class="portal-icon-box">
                    <i class="bi bi-file-earmark-arrow-down"></i>
                  </span>
                  <div>
                    <h3 class="h6 fw-bold text-dark mb-1">
                      Accommodation Allocation Slip
                    </h3>
                    <p class="small text-muted mb-2">
                      Your room allocation slip is available after payment and
                      allocation.
                    </p>
                    <span
                      class="badge rounded-pill mb-3"
                      :class="
                        allocated
                          ? 'text-bg-success bg-opacity-10 text-success'
                          : 'text-bg-secondary bg-opacity-10 text-secondary'
                      "
                    >
                      <i
                        class="bi me-1"
                        :class="allocated ? 'bi-check-circle' : 'bi-ban'"
                      ></i>
                      {{ allocated ? "Available" : "Unavailable" }}
                    </span>
                  </div>
                </div>
                <button
                  class="btn btn-primary w-100 mt-auto"
                  type="button"
                  :disabled="!allocated || !!downloading"
                  @click="download('allocation-slip')"
                >
                  <i class="bi bi-download me-1"></i>
                  {{
                    downloading === "allocation-slip"
                      ? "Preparing..."
                      : allocated
                        ? "Download Slip"
                        : "Download Locked"
                  }}
                </button>
              </div>
            </article>

            <article class="col">
              <div class="border rounded-2 p-3 h-100 d-flex flex-column">
                <div class="d-flex gap-3">
                  <span class="portal-icon-box">
                    <i class="bi bi-file-earmark-text"></i>
                  </span>
                  <div>
                    <h3 class="h6 fw-bold text-dark mb-1">Tenancy Agreement</h3>
                    <p class="small text-muted mb-2">
                      {{
                        agreementComplete
                          ? "Your hostel tenancy agreement has been signed."
                          : "Read and complete your hostel tenancy agreement to proceed."
                      }}
                    </p>
                    <span
                      class="badge rounded-pill"
                      :class="
                        agreementComplete
                          ? 'text-bg-success bg-opacity-10 text-success'
                          : 'text-bg-danger bg-opacity-10 text-danger'
                      "
                    >
                      <i
                        class="bi me-1"
                        :class="agreementComplete ? 'bi-check-circle' : 'bi-exclamation-circle'"
                      ></i>
                      {{ agreementComplete ? "Signed" : "Not completed" }}
                    </span>
                  </div>
                </div>
                <button
                  v-if="!agreementComplete"
                  class="btn btn-primary w-100 mt-auto"
                  type="button"
                  :disabled="!overview.configuration.internalApplicationsOpen"
                  @click="router.push('/accommodation/agreement')"
                >
                  <i class="bi bi-file-earmark-text me-1"></i>Continue Agreement
                </button>
                <button
                  v-else
                  class="btn btn-primary w-100 mt-auto"
                  type="button"
                  :disabled="!allocated || !!downloading"
                  @click="download('agreement')"
                >
                  <i class="bi bi-download me-1"></i>
                  {{
                    downloading === "agreement"
                      ? "Preparing..."
                      : allocated
                        ? "Download Agreement"
                        : "Available After Allocation"
                  }}
                </button>
              </div>
            </article>

            <article class="col">
              <div class="border rounded-2 p-3 h-100 d-flex flex-column">
                <div class="d-flex gap-3">
                  <span class="portal-icon-box"
                    ><i class="bi bi-credit-card"></i
                  ></span>
                  <div>
                    <h3 class="h6 fw-bold text-dark mb-1">Accommodation Fee</h3>
                    <p class="small text-muted mb-2">
                      {{
                        paymentComplete
                          ? "Your accommodation fee has been paid."
                          : "Make payment for your hostel accommodation fee."
                      }}
                    </p>
                    <span
                      class="badge rounded-pill"
                      :class="
                        paymentComplete
                          ? 'text-bg-success bg-opacity-10 text-success'
                          : 'text-bg-warning text-warning-emphasis bg-opacity-25'
                      "
                    >
                      <i
                        class="bi me-1"
                        :class="paymentComplete ? 'bi-check-circle' : 'bi-exclamation-circle'"
                      ></i>
                      {{
                        paymentComplete
                          ? "Paid"
                          : agreementComplete
                            ? "Payment required"
                            : "Agreement required"
                      }}
                    </span>
                  </div>
                </div>
                <button
                  class="btn btn-primary w-100 mt-auto"
                  type="button"
                  :disabled="!agreementComplete"
                  @click="router.push('/finance')"
                >
                  <i class="bi bi-credit-card me-1"></i>
                  {{
                    paymentComplete ? "View Receipt" : "Pay Accommodation Fee"
                  }}
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section class="card portal-card mb-3" aria-label="Accommodation support">
        <div
          class="card-body d-flex flex-column flex-md-row align-items-md-center gap-3"
        >
          <span class="portal-icon-box bg-light text-dark">
            <i class="bi bi-headset"></i>
          </span>
          <div class="flex-grow-1">
            <strong class="text-dark">
              Accommodation Support
              <span class="badge text-bg-secondary bg-opacity-10 text-secondary ms-1">Coming Soon</span>
            </strong>
            <p class="small text-muted mb-0">
              Report maintenance, utilities, safety and room-related issues.
            </p>
          </div>
          <button class="btn btn-secondary" type="button" disabled>
            <i class="bi bi-wrench-adjustable me-1"></i>Report an Issue
          </button>
        </div>
      </section>

      <section class="alert alert-danger mb-0">
        <div class="row g-3 align-items-center">
          <div class="col-xl">
            <div class="d-flex align-items-center gap-3">
              <i class="bi bi-info-circle-fill fs-4"></i>
              <span>
                <strong class="d-block">Important Information</strong>
                <small class="d-block text-muted">
                  Read these resources before moving into the hostel.
                </small>
              </span>
            </div>
          </div>
          <div class="col-md-4 col-xl-auto">
            <button
              class="btn btn-light border w-100"
              type="button"
              @click="openResource('rules')"
            >
              <i class="bi bi-clipboard2-check me-2"></i>Hostel Rules <i class="bi bi-chevron-right ms-3"></i>
            </button>
          </div>
          <div class="col-md-4 col-xl-auto">
            <button
              class="btn btn-light border w-100"
              type="button"
              @click="openResource('contacts')"
            >
              <i class="bi bi-telephone me-2"></i>Emergency Contact <i class="bi bi-chevron-right ms-3"></i>
            </button>
          </div>
          <div class="col-md-4 col-xl-auto">
            <button
              class="btn btn-light border w-100"
              type="button"
              @click="openResource('guide')"
            >
              <i class="bi bi-book me-2"></i>Move-in Guide <i class="bi bi-chevron-right ms-3"></i>
            </button>
          </div>
        </div>
      </section>
    </template>

    <template v-if="resource">
      <div
        class="modal d-block"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        :aria-label="resourceTitle"
        @click.self="resource = null"
      >
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
          <div class="modal-content">
            <div class="modal-header">
              <h2 class="modal-title h5 fw-bold text-dark">
                {{ resourceTitle }}
              </h2>
              <button
                type="button"
                class="btn-close"
                aria-label="Close"
                @click="resource = null"
              ></button>
            </div>
            <div class="modal-body">
              <ol v-if="resource === 'rules'" class="mb-0 ps-4">
                <li v-for="item in hostelRules" :key="item" class="mb-2">
                  {{ item }}
                </li>
              </ol>
              <ol v-else-if="resource === 'guide'" class="mb-0 ps-4">
                <li v-for="item in moveInGuide" :key="item" class="mb-2">
                  {{ item }}
                </li>
              </ol>
              <div v-else class="list-group">
                <a
                  v-for="item in emergencyContacts"
                  :key="item.phone"
                  :href="`tel:${item.phone.replace(/\s/g, '')}`"
                  class="list-group-item list-group-item-action d-flex align-items-center gap-3"
                >
                  <i class="bi bi-telephone text-primary"></i>
                  <span>
                    <span class="d-block text-muted small">{{
                      item.label
                    }}</span>
                    <strong class="text-dark">{{ item.phone }}</strong>
                  </span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show"></div>
    </template>
  </main>
</template>

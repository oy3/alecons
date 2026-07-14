<script setup>
import { computed, ref, watch } from "vue";
import { useAuthStore } from "../../stores/auth.js";
import Swal from "sweetalert2";
import { apiService } from "../../services/api.js";
import { useRouter } from "vue-router";
import BrandLogo from "../../components/BrandLogo.vue";

const authStore = useAuthStore();
const router = useRouter();

const CONTACT_URL = import.meta.env.VITE_APP_SITE_URL
  ? `${import.meta.env.VITE_APP_SITE_URL}/contact`
  : null;

const applications = computed(() => authStore.applications || []);
const currentApplication = computed(() => authStore.application || null);

async function logout() {
  const result = await Swal.fire({
    title: "Are you sure?",
    text: "You will be logged out.",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#2d7d7d",
    cancelButtonColor: "#6c757d",
    confirmButtonText: "Yes, logout",
  });
  if (!result.isConfirmed) return;
  await authStore.logout();
  router.push({ name: "Login" }).then(() => authStore.completeLogout());
}

// Modal state
const showModal = ref(false);
const isSubmitting = ref(false);

// Form data
const openSessions = ref([]);
const programTypes = ref([]);
const programModes = ref([]);
const programs = ref([]);

const selectedSessionId = ref("");
const selectedTypeId = ref("");
const selectedModeId = ref("");
const selectedProgramId = ref("");

// Derived filtered programs
const filteredPrograms = computed(() => {
  if (!selectedTypeId.value || !selectedModeId.value) return [];
  return programs.value.filter(
    (p) =>
      p.programTypeId === selectedTypeId.value &&
      p.programModeId === selectedModeId.value,
  );
});

const canSubmit = computed(
  () =>
    selectedSessionId.value &&
    selectedTypeId.value &&
    selectedModeId.value &&
    selectedProgramId.value,
);

watch([selectedTypeId, selectedModeId], () => {
  selectedProgramId.value = "";
});

async function openApplyModal() {
  selectedSessionId.value = "";
  selectedTypeId.value = "";
  selectedModeId.value = "";
  selectedProgramId.value = "";

  try {
    const [sessionsRes, typesRes, modesRes, programsRes] = await Promise.all([
      apiService.getOpenSessions(),
      apiService.getProgramTypes(),
      apiService.getProgramModes(),
      apiService.getPrograms(),
    ]);

    openSessions.value = sessionsRes.data || [];
    programTypes.value = (typesRes.data || []).filter(
      (t) => t.active !== false,
    );
    programModes.value = (modesRes.data || []).filter(
      (m) => m.active !== false,
    );
    programs.value = Array.isArray(programsRes.data) ? programsRes.data : [];

    if (!openSessions.value.length) {
      await Swal.fire({
        icon: "info",
        title: "No open intakes",
        text: "There are no intakes currently open for applications. Please check back later.",
        confirmButtonColor: "#2d7d7d",
      });
      return;
    }

    if (openSessions.value.length === 1) {
      selectedSessionId.value = openSessions.value[0].id;
    }

    showModal.value = true;
  } catch {
    await Swal.fire({
      icon: "error",
      title: "Error",
      text: "Failed to load intake information. Please try again.",
      confirmButtonColor: "#2d7d7d",
    });
  }
}

async function submitApplication() {
  if (!canSubmit.value || isSubmitting.value) return;

  const session = openSessions.value.find(
    (s) => s.id === selectedSessionId.value,
  );
  const program = programs.value.find((p) => p.id === selectedProgramId.value);

  const confirm = await Swal.fire({
    title: "Confirm Application",
    html: `
      <div class="text-start">
        <p class="mb-1"><strong>Intake:</strong> ${session?.label || session?.sessionYear}</p>
        <p class="mb-0"><strong>Program:</strong> ${programTypes.value.find((t) => t.id === program?.programTypeId)?.type} ${program?.name}</p>
      </div>
    `,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: "Submit Application",
    cancelButtonText: "Go Back",
    confirmButtonColor: "#2d7d7d",
  });

  if (!confirm.isConfirmed) return;

  isSubmitting.value = true;
  try {
    const response = await apiService.post("/auth/apply", {
      sessionId: selectedSessionId.value,
      programId: selectedProgramId.value,
    });

    if (!response.success)
      throw new Error(response.error || "Unable to create application.");

    authStore.application = response.data?.application || null;
    authStore.applications = response.data?.applications || [];
    showModal.value = false;

    await Swal.fire({
      icon: "success",
      title: "Application Created",
      text: "Your new application has been created. You can now continue from the dashboard.",
      confirmButtonColor: "#2d7d7d",
      timer: 2000,
      showConfirmButton: false,
    });

    router.push("/dashboard");
  } catch (error) {
    await Swal.fire({
      icon: "error",
      title: "Unable to Apply",
      text: error.message || "Please try again later.",
      confirmButtonColor: "#2d7d7d",
    });
  } finally {
    isSubmitting.value = false;
  }
}

function formatSessionLabel(application) {
  const session = application?.academicSession;
  if (!session) return "Unknown intake";
  return session.title || session.sessionYear || "Unknown intake";
}

function getStatusBadgeClass(status) {
  switch (status) {
    case "completed":
      return "bg-success";
    case "admitted":
      return "bg-info";
    case "rejected":
      return "bg-danger";
    case "expired":
      return "bg-secondary";
    default:
      return "bg-warning text-dark";
  }
}
</script>

<template>
  <div class="my-applications-page d-flex flex-column min-vh-100">
    <!-- Custom Header -->
    <header
      class="my-apps-header px-4 py-3 d-flex align-items-center justify-content-between"
    >
      <!-- Left: logo + school name -->
      <BrandLogo />

      <!-- Right: help link, applicant name, logout -->
      <div class="dropdown">
        <a
          href="#"
          class="d-flex align-items-center text-decoration-none dropdown-toggle text-dark"
          id="userDropdown"
          data-bs-toggle="dropdown"
          aria-expanded="false"
        >
          <div class="d-flex flex-column align-items-end me-2">
            <span
              class="text-dark fw-bold d-none d-md-inline text-capitalize small"
            >
              {{ authStore.user?.firstName }} {{ authStore.user?.lastName }}
            </span>
            <span class="text-muted small d-none d-md-inline text-capitalize">
              {{ authStore.user?.role }}
            </span>
          </div>
          <img
            :src="
              authStore.application?.profileImageUrl ||
              'https://placehold.co/40?text=IMG'
            "
            width="40"
            height="40"
            alt="Profile"
            class="rounded-circle border border-secondary object-fit-cover"
          />
        </a>

        <ul
          class="dropdown-menu dropdown-menu-end"
          aria-labelledby="userDropdown"
        >
          <li class="dropdown-item-text d-flex align-items-center gap-2">
            <img
              :src="
                authStore.application?.profileImageUrl ||
                'https://placehold.co/40?text=IMG'
              "
              width="40"
              height="40"
              alt="Profile"
              class="rounded-circle border border-secondary object-fit-cover"
            />
            <div class="d-flex flex-column align-items-start">
              <span class="text-dark fw-bold text-capitalize small">
                {{ authStore.user?.firstName }} {{ authStore.user?.lastName }}
              </span>
              <span class="small text-muted">
                {{ authStore.user?.email }}
              </span>
            </div>
          </li>
          <li>
            <hr class="dropdown-divider" />
          </li>
          <li class="dropdown-item">
            <a
              :href="CONTACT_URL"
              target="_blank"
              rel="noopener"
              class="text-muted text-decoration-none"
            >
              <i class="bi bi-question-circle me-3"></i>Need help?
            </a>
          </li>
          <li class="dropdown-item">
            <a href="#" @click.prevent="logout" class="text-danger">
              <i class="bi bi-box-arrow-right me-3"></i>Log out
            </a>
          </li>
        </ul>
      </div>
    </header>

    <!-- Page Body -->
    <div class="container py-5 flex-grow-1">
      <div class="row g-4">
        <div class="col-12">
          <div
            class="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3"
          >
            <div>
              <h2 class="fw-bold mb-1">My Applications</h2>
              <p class="text-muted mb-0">
                Review your applications and start a new one when a new intake
                opens.
              </p>
            </div>
            <button class="btn btn-acon-secondary" @click="openApplyModal">
              <i class="bi bi-plus-circle me-2"></i>New application
            </button>
          </div>
        </div>

        <div class="col-12">
          <div class="card p-2 shadow-sm border-0">
            <div class="card-body">
              <div
                v-if="applications.length"
                class="list-group list-group-flush"
              >
                <div
                  v-for="application in applications"
                  :key="application.id"
                  class="list-group-item px-0 py-3"
                >
                  <div
                    class="d-flex flex-column flex-lg-row justify-content-between gap-3"
                  >
                    <div>
                      <div class="d-flex align-items-center gap-2 mb-2">
                        <span
                          class="badge text-uppercase"
                          :class="getStatusBadgeClass(application.status)"
                          >{{ application.status }}</span
                        >
                        <span class="fw-semibold">{{
                          application.applicationNumber
                        }}</span>
                      </div>
                      <h6 class="mb-1">
                        {{ application.program?.programTypeId?.type }}
                        {{ application.program?.name || "Program" }}
                      </h6>
                      <p class="text-muted mb-1">
                        {{ formatSessionLabel(application) }}
                      </p>
                      <p class="text-muted small mb-0">
                        Created
                        {{
                          new Date(application.createdAt).toLocaleDateString()
                        }}
                      </p>
                    </div>
                    <div class="text-lg-end">
                      <p v-if="application.status !== 'expired'" class="mb-0">
                        <strong>Decision:</strong>
                        {{ application.admissionDecision || "n/a" }}
                      </p>
                      <button
                        v-if="application.status !== 'expired' && application.status !== 'completed'"
                        class="btn btn-sm btn-primary mt-2"
                        @click="
                          authStore.application = application;
                          router.push('/dashboard');
                        "
                      >
                        Continue
                      </button>
                      <button
                        v-if="application.status === 'completed'"
                        class="btn btn-sm btn-secondary mt-2"
                        @click="
                          authStore.application = application;
                          router.push('/dashboard');
                        "
                      >
                        <i class="bi bi-eye"></i> View
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="text-center py-4">
                <p class="text-muted mb-3">No applications yet.</p>
                <button class="btn btn-acon-secondary" @click="openApplyModal">
                  Start your first application
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Apply for New Intake Modal -->
  <div
    v-if="showModal"
    class="modal-backdrop-custom"
    @click.self="showModal = false"
  >
    <div class="modal-dialog-custom card shadow-lg border-0">
      <div
        class="card-header bg-white d-flex justify-content-between align-items-center border-0 pb-0"
      >
        <h5 class="fw-bold mb-0">Apply for a New Intake</h5>
        <button
          type="button"
          class="btn-close"
          @click="showModal = false"
        ></button>
      </div>
      <div class="card-body pt-3">
        <form @submit.prevent="submitApplication">
          <div class="mb-3">
            <label class="form-label fw-semibold"
              >Intake <span class="text-danger">*</span></label
            >
            <select v-model="selectedSessionId" class="form-select" required>
              <option value="" disabled>Select intake</option>
              <option v-for="s in openSessions" :key="s.id" :value="s.id">
                {{ s.label || s.sessionYear }}
              </option>
            </select>
          </div>

          <div class="mb-3">
            <label class="form-label fw-semibold"
              >Program Type <span class="text-danger">*</span></label
            >
            <select v-model="selectedTypeId" class="form-select" required>
              <option value="" disabled>Select program type</option>
              <option v-for="t in programTypes" :key="t.id" :value="t.id">
                {{ t.type
                }}<span v-if="t.description"> — {{ t.description }}</span>
              </option>
            </select>
          </div>

          <div class="mb-3">
            <label class="form-label fw-semibold"
              >Program Mode <span class="text-danger">*</span></label
            >
            <select v-model="selectedModeId" class="form-select" required>
              <option value="" disabled>Select program mode</option>
              <option v-for="m in programModes" :key="m.id" :value="m.id">
                {{ m.mode
                }}<span v-if="m.description"> — {{ m.description }}</span>
              </option>
            </select>
          </div>

          <div class="mb-4">
            <label class="form-label fw-semibold"
              >Program <span class="text-danger">*</span></label
            >
            <select
              v-model="selectedProgramId"
              class="form-select"
              required
              :disabled="!selectedTypeId || !selectedModeId"
            >
              <option value="" disabled>
                {{
                  !selectedTypeId || !selectedModeId
                    ? "Select type and mode first"
                    : "Select program"
                }}
              </option>
              <option v-for="p in filteredPrograms" :key="p.id" :value="p.id">
                {{ p.name }}
              </option>
            </select>
            <div
              v-if="
                selectedTypeId && selectedModeId && !filteredPrograms.length
              "
              class="form-text text-danger"
            >
              No programs available for the selected type and mode combination.
            </div>
          </div>

          <div class="d-flex gap-2 justify-content-end">
            <button
              type="button"
              class="btn btn-secondary"
              @click="showModal = false"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-acon-secondary"
              :disabled="!canSubmit || isSubmitting"
            >
              <span
                v-if="isSubmitting"
                class="spinner-border spinner-border-sm me-2"
              ></span>
              {{ isSubmitting ? "Submitting..." : "Continue" }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<style scoped>
.my-applications-page {
  background: #f8f9fa;
}

.my-apps-header {
  background: #fff;
  border-bottom: 1px solid #e9ecef;
  position: sticky;
  top: 0;
  z-index: 100;
}

.modal-backdrop-custom {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-dialog-custom {
  width: 100%;
  max-width: 480px;
  border-radius: 1rem;
  overflow: hidden;
}
</style>

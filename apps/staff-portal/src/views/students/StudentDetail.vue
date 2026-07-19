<script lang="js">
import Swal from "sweetalert2";
import { apiService } from "../../services/api.js";
import { logger } from "@shared/utils/logger";

export default {
  name: "StudentDetail",
  data() {
    return {
      isLoading: true,
      detail: null,
      activeTab: "overview",
      isSaving: false,
    };
  },
  computed: {
    student() {
      return this.detail?.student || null;
    },
    user() {
      return this.student?.userId || {};
    },
    name() {
      return (
        [this.user.firstName, this.user.otherName, this.user.lastName]
          .filter(Boolean)
          .join(" ") || "Student"
      );
    },
  },
  async mounted() {
    await this.loadStudent();
  },
  methods: {
    async loadStudent() {
      try {
        this.isLoading = true;
        const response = await apiService.getStaffStudent(
          this.$route.params.id,
        );
        if (!response.success)
          throw new Error(response.message || "Could not load student");
        this.detail = response.data;
      } catch (error) {
        logger.error("Failed to load student detail", error);
        await Swal.fire({
          icon: "error",
          title: "Load Failed",
          text: error.message || "Could not load the student record.",
          confirmButtonColor: "#1a5f5f",
        });
        this.$router.push({ name: "Students" });
      } finally {
        this.isLoading = false;
      }
    },
    sessionLabel(session) {
      return session?.title || session?.sessionYear || "Not assigned";
    },
    formatDate(value) {
      return value
        ? new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
            new Date(value),
          )
        : "Not available";
    },
    formatCurrency(value) {
      return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 2,
      }).format(Number(value || 0));
    },
    async changeStatus() {
      const result = await Swal.fire({
        title: "Update Student Status",
        input: "select",
        inputOptions: {
          active: "Active",
          suspended: "Suspended",
          graduated: "Graduated",
          withdrawn: "Withdrawn",
        },
        inputValue: this.student.status,
        showCancelButton: true,
        confirmButtonColor: "#1a5f5f",
        inputValidator: (value) => !value && "Choose a status",
      });
      if (!result.isConfirmed) return;
      try {
        this.isSaving = true;
        await apiService.updateStaffStudentStatus(
          this.student._id,
          result.value,
        );
        await this.loadStudent();
        await Swal.fire({
          icon: "success",
          title: "Status Updated",
          timer: 1600,
          showConfirmButton: false,
        });
      } catch (error) {
        await Swal.fire({
          icon: "error",
          title: "Update Failed",
          text: error.message || "Could not update status.",
        });
      } finally {
        this.isSaving = false;
      }
    },
    async togglePortalAccess() {
      const next = !this.student.isActive;
      const result = await Swal.fire({
        title: next ? "Enable Portal Access?" : "Disable Portal Access?",
        text: next
          ? "The student will be able to sign in again."
          : "The student will no longer be able to sign in.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#1a5f5f",
        confirmButtonText: next ? "Enable Access" : "Disable Access",
      });
      if (!result.isConfirmed) return;
      try {
        this.isSaving = true;
        await apiService.updateStaffStudentPortalAccess(this.student._id, next);
        await this.loadStudent();
      } catch (error) {
        await Swal.fire({
          icon: "error",
          title: "Update Failed",
          text: error.message || "Could not update portal access.",
        });
      } finally {
        this.isSaving = false;
      }
    },
  },
};
</script>

<template>
  <main class="container-fluid py-4 px-lg-4">
    <button
      class="btn btn-outline-dark px-2 mb-3 btn-sm rounded-3"
      @click="$router.push({ name: 'Students' })"
    >
      <i class="bi bi-chevron-left me-1"></i>Back
    </button>
    <div v-if="isLoading" class="text-center py-5 text-muted">
      <span class="spinner-border me-2"></span>Loading student record...
    </div>
    <template v-else-if="student">
      <section class="card border-0 shadow-sm mb-4">
        <div class="card-body p-4">
          <div
            class="d-flex flex-wrap gap-3 justify-content-between align-items-center"
          >
            <div class="d-flex align-items-center gap-3">
              <img
                :src="
                  student.profileImageUrl ||
                  user.profileImageUrl ||
                  'https://placehold.co/72x72?text=IMG'
                "
                class="rounded-circle object-fit-cover"
                width="72"
                height="72"
                alt=""
              />
              <div>
                <h1 class="h3 mb-1">{{ name }}</h1>
                <div class="text-muted">
                  {{ student.matriculationNumber }} ·
                  {{ student.programId?.name || "Program not assigned" }}
                </div>
                <div class="small text-muted mt-1">
                  {{ user.email }} · {{ user.phone || "No phone number" }}
                </div>
              </div>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <button
                class="btn btn-danger btn-sm"
                :disabled="isSaving"
                @click="togglePortalAccess"
              >
                <i
                  class="bi me-1"
                  :class="student.isActive ? 'bi-lock' : 'bi-unlock'"
                ></i
                >{{
                  student.isActive ? "Disable Access" : "Enable Access"
                }}</button
              ><button
                class="btn btn-staff-primary btn-sm"
                :disabled="isSaving"
                @click="changeStatus"
              >
                <i class="bi bi-pencil-square me-1"></i>Update Status
              </button>
            </div>
          </div>
        </div>
      </section>
      <ul class="nav nav-tabs mb-3">
        <li
          v-for="tab in [
            { key: 'overview', label: 'Overview' },
            { key: 'history', label: 'Academic History' },
            { key: 'payments', label: 'Payments' },
            { key: 'registrations', label: 'Course Registrations' },
          ]"
          :key="tab.key"
          class="nav-item"
        >
          <button
            class="nav-link rounded-bottom-0"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            {{ tab.label }}
          </button>
        </li>
      </ul>
      <section v-if="activeTab === 'overview'" class="row g-4">
        <div class="col-lg-7">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <h2 class="h5">Academic Record</h2>
              <dl class="row mb-0">
                <dt class="col-sm-5">Student status</dt>
                <dd class="col-sm-7 text-capitalize">{{ student.status }}</dd>
                <dt class="col-sm-5">Portal access</dt>
                <dd class="col-sm-7">
                  {{ student.isActive ? "Enabled" : "Disabled" }}
                </dd>
                <dt class="col-sm-5">Current standing</dt>
                <dd class="col-sm-7">
                  Level {{ student.currentLevel }} · Semester
                  {{ student.currentSemester }}
                </dd>
                <dt class="col-sm-5">Current session</dt>
                <dd class="col-sm-7">
                  {{ sessionLabel(student.academicSession) }}
                </dd>
                <dt class="col-sm-5">Entry session</dt>
                <dd class="col-sm-7">
                  {{ sessionLabel(student.entryAcademicSession) }}
                </dd>
                <dt class="col-sm-5">Cumulative GPA</dt>
                <dd class="col-sm-7">{{ student.cumulativeGPA || "0.00" }}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div class="col-lg-5">
          <div class="card border-0 shadow-sm h-100">
            <div class="card-body">
              <h2 class="h5">Account Details</h2>
              <dl class="row mb-0">
                <dt class="col-sm-5">Email verified</dt>
                <dd class="col-sm-7">
                  {{ user.isEmailVerified ? "Yes" : "No" }}
                </dd>
                <dt class="col-sm-5">Gender</dt>
                <dd class="col-sm-7 text-capitalize">
                  {{ user.gender || "Not available" }}
                </dd>
                <dt class="col-sm-5">Date of birth</dt>
                <dd class="col-sm-7">{{ formatDate(user.dob) }}</dd>
                <dt class="col-sm-5">Created</dt>
                <dd class="col-sm-7">{{ formatDate(student.createdAt) }}</dd>
              </dl>
            </div>
          </div>
        </div>
      </section>
      <section
        v-else-if="activeTab === 'history'"
        class="card border-0 shadow-sm p-0"
      >
        <div class="table-responsive rounded">
          <table class="table mb-0">
            <thead class="table-light">
              <tr>
                <th>Academic Session</th>
                <th>Status</th>
                <th>Started</th>
                <th>Ended</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!detail.sessionHistory.length">
                <td colspan="4" class="text-center py-4 text-muted">
                  No academic session history is recorded.
                </td>
              </tr>
              <tr v-for="record in detail.sessionHistory" :key="record._id">
                <td>{{ sessionLabel(record.academicSessionId) }}</td>
                <td class="text-capitalize">{{ record.status }}</td>
                <td>{{ formatDate(record.startedAt) }}</td>
                <td>{{ formatDate(record.endedAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section
        v-else-if="activeTab === 'payments'"
        class="card border-0 shadow-sm p-0 rounded"
      >
        <div class="table-responsive">
          <table class="table mb-0">
            <thead class="table-light">
              <tr>
                <th>Fee</th>
                <th>Session</th>
                <th>Reference</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!detail.payments.length">
                <td colspan="6" class="text-center py-4 text-muted">
                  No payments are recorded.
                </td>
              </tr>
              <tr v-for="payment in detail.payments" :key="payment._id">
                <td>{{ payment.paymentId?.name || "Payment" }}</td>
                <td>{{ sessionLabel(payment.academicSessionId) }}</td>
                <td>
                  <code>{{ payment.reference }}</code>
                </td>
                <td>{{ formatCurrency(payment.amount) }}</td>
                <td class="text-capitalize">{{ payment.status }}</td>
                <td>{{ formatDate(payment.paidAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
      <section v-else class="card p-0 border-0 shadow-sm">
        <div class="table-responsive rounded">
          <table class="table mb-0">
            <thead class="table-light">
              <tr>
                <th>Academic Session</th>
                <th>Level</th>
                <th>Semester</th>
                <th>Courses</th>
                <th>Units</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!detail.courseRegistrations.length">
                <td colspan="6" class="text-center py-4 text-muted">
                  No course registrations are recorded.
                </td>
              </tr>
              <tr
                v-for="registration in detail.courseRegistrations"
                :key="registration._id"
              >
                <td>{{ sessionLabel(registration.academicSessionId) }}</td>
                <td>{{ registration.level }}</td>
                <td>{{ registration.semester }}</td>
                <td>{{ registration.items?.length || 0 }}</td>
                <td>{{ registration.totalUnits }}</td>
                <td class="text-capitalize">{{ registration.status }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </main>
</template>

<script>
import Swal from "sweetalert2";
import { apiService } from "../../services/api.js";
import { useAuthStore } from "../../stores/auth.js";
import { logger } from "@shared/utils/logger";

const categoryLabels = {
  admissions: "Admissions",
  programmes: "Programme information",
  student_services: "Student services",
  finance: "Financial services",
  general: "General",
};

const statusLabels = {
  new: "New",
  assigned: "Assigned",
  in_progress: "In progress",
  awaiting_enquirer: "Awaiting enquirer",
  resolved: "Resolved",
  closed: "Closed",
  spam: "Spam",
};

export default {
  name: "ContactEnquiries",
  setup() {
    return { authStore: useAuthStore() };
  },
  data() {
    return {
      categoryLabels,
      statusLabels,
      enquiries: [],
      stats: { counts: {}, total: 0, globalQueue: false },
      filters: {
        search: "",
        status: "",
        category: "",
        priority: "",
        scope: "all",
      },
      page: 1,
      totalPages: 1,
      total: 0,
      loading: true,
      detailLoading: false,
      selected: null,
      showDetail: false,
      responseBody: "",
      noteBody: "",
      saving: false,
      assignees: [],
      selectedAssignee: "",
      filterTimer: null,
    };
  },
  computed: {
    canAssign() {
      return this.authStore.hasPermission("enquiries", "assign");
    },
    canRespond() {
      return this.authStore.hasPermission("enquiries", "respond");
    },
    canAddNote() {
      return this.authStore.hasPermission("enquiries", "add_note");
    },
    canUpdateStatus() {
      return this.authStore.hasPermission("enquiries", "update_status");
    },
    canExport() {
      return this.authStore.hasPermission("enquiries", "export");
    },
    enquiry() {
      return this.selected?.enquiry || null;
    },
    messages() {
      return this.selected?.messages || [];
    },
    activities() {
      return this.selected?.activities || [];
    },
    statusOptions() {
      const map = {
        new: ["in_progress", "resolved", "spam"],
        assigned: ["in_progress", "resolved", "spam"],
        in_progress: ["awaiting_enquirer", "resolved", "spam"],
        awaiting_enquirer: ["in_progress", "resolved"],
        resolved: ["in_progress", "closed"],
        closed: ["in_progress"],
        spam: ["new"],
      };
      return (map[this.enquiry?.status] || []).map((value) => ({
        value,
        label: statusLabels[value],
      }));
    },
  },
  watch: {
    filters: {
      deep: true,
      handler() {
        clearTimeout(this.filterTimer);
        this.filterTimer = setTimeout(() => {
          this.page = 1;
          this.loadEnquiries();
        }, 300);
      },
    },
  },
  async mounted() {
    document.addEventListener("keydown", this.handleKeydown);
    await Promise.all([this.loadEnquiries(), this.loadStats()]);
    await this.openLinkedEnquiry();
  },
  beforeUnmount() {
    clearTimeout(this.filterTimer);
    document.removeEventListener("keydown", this.handleKeydown);
    document.body.classList.remove("overflow-hidden");
  },
  methods: {
    handleKeydown(event) {
      if (event.key === "Escape" && this.showDetail) this.closeDetail();
    },
    async loadEnquiries() {
      try {
        this.loading = true;
        const response = await apiService.getContactEnquiries({
          ...this.filters,
          page: this.page,
          limit: 20,
        });
        this.enquiries = response.data?.items || [];
        this.total = response.data?.pagination?.total || 0;
        this.totalPages = response.data?.pagination?.pages || 1;
      } catch (error) {
        logger.error("Could not load enquiries", error);
        await this.alertError("Could not load enquiries", error);
      } finally {
        this.loading = false;
      }
    },
    async openLinkedEnquiry() {
      const enquiryId = String(this.$route.query.open || "").trim();
      if (!enquiryId) return;
      await this.openDetail({ _id: enquiryId });
      await this.$router.replace({
        query: { ...this.$route.query, open: undefined },
      });
    },
    async loadStats() {
      try {
        const response = await apiService.getContactEnquiryStats();
        this.stats = response.data || this.stats;
        if (!this.stats.globalQueue) this.filters.scope = "mine";
      } catch (error) {
        logger.error("Could not load enquiry statistics", error);
      }
    },
    async refresh() {
      await Promise.all([this.loadEnquiries(), this.loadStats()]);
    },
    async exportRows() {
      try {
        await apiService.exportContactEnquiries(this.filters);
      } catch (error) {
        await this.alertError("Could not export enquiries", error);
      }
    },
    async openDetail(item) {
      this.showDetail = true;
      this.detailLoading = true;
      this.responseBody = "";
      this.noteBody = "";
      document.body.classList.add("overflow-hidden");
      try {
        const response = await apiService.getContactEnquiry(item._id);
        this.selected = response.data;
        this.selectedAssignee = this.idOf(this.enquiry?.assignedToUserId) || "";
        if (this.canAssign && !this.assignees.length)
          await this.loadAssignees();
      } catch (error) {
        await this.alertError("Could not open enquiry", error);
        this.closeDetail();
      } finally {
        this.detailLoading = false;
      }
    },
    closeDetail() {
      this.showDetail = false;
      this.selected = null;
      document.body.classList.remove("overflow-hidden");
    },
    async reloadDetail() {
      if (!this.enquiry?._id) return;
      const response = await apiService.getContactEnquiry(this.enquiry._id);
      this.selected = response.data;
      this.selectedAssignee = this.idOf(this.enquiry?.assignedToUserId) || "";
    },
    async loadAssignees() {
      const response = await apiService.getContactEnquiryAssignees();
      this.assignees = response.data || [];
    },
    async assign() {
      if (!this.selectedAssignee || !this.enquiry) return;
      try {
        this.saving = true;
        const response = await apiService.assignContactEnquiry(
          this.enquiry._id,
          this.selectedAssignee,
        );
        this.selected = response.data;
        await this.refresh();
        this.toast("Enquiry assigned");
      } catch (error) {
        await this.alertError("Could not assign enquiry", error);
      } finally {
        this.saving = false;
      }
    },
    async changeStatus(event) {
      const status = event.target.value;
      event.target.value = "";
      if (!status || !this.enquiry) return;
      try {
        this.saving = true;
        const response = await apiService.updateContactEnquiry(
          this.enquiry._id,
          { status },
        );
        this.selected = response.data;
        await this.refresh();
        this.toast("Status updated");
      } catch (error) {
        await this.alertError("Could not update status", error);
      } finally {
        this.saving = false;
      }
    },
    async changePriority(event) {
      if (!this.enquiry) return;
      try {
        this.saving = true;
        const response = await apiService.updateContactEnquiry(
          this.enquiry._id,
          { priority: event.target.value },
        );
        this.selected = response.data;
        await this.refresh();
      } catch (error) {
        await this.alertError("Could not update priority", error);
      } finally {
        this.saving = false;
      }
    },
    async addNote() {
      if (this.noteBody.trim().length < 2) return;
      try {
        this.saving = true;
        const response = await apiService.addContactEnquiryNote(
          this.enquiry._id,
          this.noteBody.trim(),
        );
        this.selected = response.data;
        this.noteBody = "";
        this.toast("Internal note added");
      } catch (error) {
        await this.alertError("Could not add note", error);
      } finally {
        this.saving = false;
      }
    },
    async respond() {
      if (this.responseBody.trim().length < 2) return;
      const result = await Swal.fire({
        icon: "question",
        title: "Send this response?",
        text: `It will be emailed to ${this.enquiry.email}.`,
        showCancelButton: true,
        confirmButtonText: "Send response",
        confirmButtonColor: "#1a5f5f",
      });
      if (!result.isConfirmed) return;
      try {
        this.saving = true;
        const response = await apiService.respondToContactEnquiry(
          this.enquiry._id,
          this.responseBody.trim(),
        );
        this.selected = response.data;
        this.responseBody = "";
        await this.refresh();
        this.toast("Response sent");
      } catch (error) {
        await this.alertError("Response saved but not delivered", error);
        await this.reloadDetail();
      } finally {
        this.saving = false;
      }
    },
    async retry(message) {
      try {
        this.saving = true;
        const response = await apiService.retryContactEnquiryResponse(
          this.enquiry._id,
          message._id,
        );
        this.selected = response.data;
        await this.refresh();
        this.toast("Response delivered");
      } catch (error) {
        await this.alertError("Could not deliver response", error);
        await this.reloadDetail();
      } finally {
        this.saving = false;
      }
    },
    idOf(value) {
      return value?._id || value || "";
    },
    fullName(user) {
      return (
        [user?.firstName, user?.otherName, user?.lastName]
          .filter(Boolean)
          .join(" ") || "Unassigned"
      );
    },
    categoryLabel(value) {
      return categoryLabels[value] || value;
    },
    statusLabel(value) {
      return statusLabels[value] || value;
    },
    statusClass(value) {
      return (
        {
          new: "text-bg-primary",
          assigned: "text-bg-info",
          in_progress: "text-bg-warning",
          awaiting_enquirer: "text-bg-secondary",
          resolved: "text-bg-success",
          closed: "text-bg-dark",
          spam: "text-bg-danger",
        }[value] || "text-bg-light"
      );
    },
    formatDate(value) {
      return value
        ? new Intl.DateTimeFormat("en-NG", {
            dateStyle: "medium",
            timeStyle: "short",
            hour12: true,
          }).format(new Date(value))
        : "Not available";
    },
    async alertError(title, error) {
      await Swal.fire({
        icon: "error",
        title,
        text: error?.message || "Please try again.",
      });
    },
    toast(title) {
      Swal.fire({
        toast: true,
        position: "top-end",
        icon: "success",
        title,
        showConfirmButton: false,
        timer: 1500,
      });
    },
    previousPage() {
      if (this.page > 1) {
        this.page -= 1;
        this.loadEnquiries();
      }
    },
    nextPage() {
      if (this.page < this.totalPages) {
        this.page += 1;
        this.loadEnquiries();
      }
    },
  },
};
</script>

<template>
  <main class="container-fluid py-4 px-lg-4">
    <div
      class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4"
    >
      <div>
        <h1 class="h2 text-staff-primary fw-bold mb-1">Contact Enquiries</h1>
        <p class="text-muted mb-0">
          Triage, assign and respond to enquiries from the public website.
        </p>
      </div>
      <div class="d-flex gap-2">
        <button
          v-if="canExport"
          class="btn btn-outline-primary"
          @click="exportRows"
        >
          <i class="bi bi-download me-2"></i>Export</button
        ><button
          class="btn btn-outline-secondary"
          :disabled="loading"
          @click="refresh"
        >
          <i class="bi bi-arrow-clockwise me-2"></i>Refresh
        </button>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div
        v-for="item in [
          ['New', stats.counts?.new || 0, 'bi-inbox', 'primary'],
          ['Assigned', stats.counts?.assigned || 0, 'bi-person-check', 'info'],
          [
            'In progress',
            stats.counts?.in_progress || 0,
            'bi-hourglass-split',
            'warning',
          ],
          [
            'Resolved',
            stats.counts?.resolved || 0,
            'bi-check2-circle',
            'success',
          ],
        ]"
        :key="item[0]"
        class="col-sm-6 col-xl-3"
      >
        <div class="card border-0 shadow-sm h-100 p-0">
          <div
            class="card-body d-flex align-items-center justify-content-between"
          >
            <div>
              <div class="text-muted small">{{ item[0] }}</div>
              <div class="fs-2 fw-semibold">{{ item[1] }}</div>
            </div>
            <i :class="[item[2], `text-${item[3]}`]" class="bi fs-2"></i>
          </div>
        </div>
      </div>
    </div>

    <section class="card border-0 shadow-sm p-0">
      <div class="card-body border-bottom">
        <div class="row g-2">
          <div class="col-lg-4">
            <div class="input-group">
              <span class="input-group-text bg-white"
                ><i class="bi bi-search"></i></span
              ><input
                v-model="filters.search"
                class="form-control"
                placeholder="Reference, name or email"
              />
            </div>
          </div>
          <div v-if="stats.globalQueue" class="col-sm-6 col-lg-2">
            <select v-model="filters.scope" class="form-select">
              <option value="mine">Assigned to me</option>
              <option value="all">All enquiries</option>
              <option value="unassigned">Unassigned</option>
            </select>
          </div>
          <div class="col-sm-6 col-lg-2">
            <select v-model="filters.status" class="form-select">
              <option value="">All statuses</option>
              <option
                v-for="(label, value) in statusLabels"
                :key="value"
                :value="value"
              >
                {{ label }}
              </option>
            </select>
          </div>
          <div class="col-sm-6 col-lg-2">
            <select v-model="filters.category" class="form-select">
              <option value="">All categories</option>
              <option
                v-for="(label, value) in categoryLabels"
                :key="value"
                :value="value"
              >
                {{ label }}
              </option>
            </select>
          </div>
          <div class="col-sm-6 col-lg-2">
            <select v-model="filters.priority" class="form-select">
              <option value="">All priorities</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Enquirer</th>
              <th>Category</th>
              <th>Status</th>
              <th>Assigned to</th>
              <th>Last activity</th>
              <th class="text-end">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading">
              <td colspan="6" class="text-center py-5">
                <span
                  class="spinner-border text-primary"
                  aria-label="Loading"
                ></span>
              </td>
            </tr>
            <tr v-else-if="!enquiries.length">
              <td colspan="6" class="text-center text-muted py-5">
                <i class="bi bi-inbox fs-2 d-block mb-2"></i>No enquiries match
                these filters.
              </td>
            </tr>
            <tr v-for="item in enquiries" v-else :key="item._id">
              <td>
                <div class="fw-semibold">
                  {{ item.firstName }} {{ item.lastName }}
                </div>
                <div class="small text-muted">
                  {{ item.reference }} <br> {{ item.email }}
                </div>
              </td>
              <td>
                {{ categoryLabel(item.category) }}
                <div
                  v-if="item.priority !== 'normal'"
                  class="small text-danger text-capitalize"
                >
                  {{ item.priority }}
                </div>
              </td>
              <td>
                <span class="badge" :class="statusClass(item.status)">{{
                  statusLabel(item.status)
                }}</span>
              </td>
              <td>{{ fullName(item.assignedToUserId) }}</td>
              <td>{{ formatDate(item.lastActivityAt || item.updatedAt) }}</td>
              <td class="text-end">
                <button
                  class="btn btn-sm btn-outline-primary"
                  @click="openDetail(item)"
                >
                  <i class="bi bi-eye me-1"></i>Open
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        class="card-footer bg-white d-flex justify-content-between align-items-center"
      >
        <span class="small text-muted">{{ total }} enquiries</span>
        <div class="btn-group">
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="page <= 1"
            @click="previousPage"
          >
            Previous</button
          ><button class="btn btn-sm btn-outline-secondary" disabled>
            {{ page }} / {{ totalPages }}</button
          ><button
            class="btn btn-sm btn-outline-secondary"
            :disabled="page >= totalPages"
            @click="nextPage"
          >
            Next
          </button>
        </div>
      </div>
    </section>

    <div
      v-if="showDetail"
      class="offcanvas-backdrop fade show"
      @click="closeDetail"
    ></div>
    <aside
      v-if="showDetail"
      class="offcanvas offcanvas-end show enquiry-detail"
      tabindex="-1"
      aria-modal="true"
      role="dialog"
    >
      <div class="offcanvas-header border-bottom">
        <div>
          <div class="small text-muted">{{ enquiry?.reference }}</div>
          <h2 class="h5 mb-0">
            {{ enquiry?.firstName }} {{ enquiry?.lastName }}
          </h2>
        </div>
        <button
          class="btn-close"
          aria-label="Close"
          @click="closeDetail"
        ></button>
      </div>
      <div
        v-if="detailLoading"
        class="offcanvas-body d-flex align-items-center justify-content-center"
      >
        <span class="spinner-border text-primary"></span>
      </div>
      <div v-else-if="enquiry" class="offcanvas-body">
        <div class="d-flex flex-wrap gap-2 mb-3">
          <span class="badge" :class="statusClass(enquiry.status)">{{
            statusLabel(enquiry.status)
          }}</span
          ><span class="badge text-bg-light text-capitalize"
            >{{ enquiry.priority }} priority</span
          ><span class="badge text-bg-light">{{
            categoryLabel(enquiry.category)
          }}</span>
        </div>
        <dl class="row small border-bottom pb-2">
          <dt class="col-4">Email</dt>
          <dd class="col-8">
            <a :href="`mailto:${enquiry.email}`">{{ enquiry.email }}</a>
          </dd>
          <dt class="col-4">Phone</dt>
          <dd class="col-8">{{ enquiry.phone || "Not provided" }}</dd>
          <dt class="col-4">Submitted</dt>
          <dd class="col-8">{{ formatDate(enquiry.createdAt) }}</dd>
        </dl>

        <div v-if="canAssign" class="row g-2 border-bottom pb-3 mb-3">
          <div class="col-8">
            <label class="form-label small fw-semibold">Assigned staff</label
            ><select
              v-model="selectedAssignee"
              class="form-select form-select-sm"
            >
              <option value="">Select staff</option>
              <option
                v-for="person in assignees"
                :key="person._id"
                :value="person._id"
              >
                {{ fullName(person) }} · {{ person.staff?.department }}
              </option>
            </select>
          </div>
          <div class="col-4 d-flex align-items-end">
            <button
              class="btn btn-sm btn-primary w-100"
              :disabled="saving || !selectedAssignee"
              @click="assign"
            >
              Assign
            </button>
          </div>
          <div class="col-6">
            <label class="form-label small fw-semibold">Priority</label
            ><select
              :value="enquiry.priority"
              class="form-select form-select-sm"
              :disabled="saving"
              @change="changePriority"
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        <div v-if="canUpdateStatus && statusOptions.length" class="mb-3">
          <label class="form-label small fw-semibold">Move enquiry to</label
          ><select
            class="form-select form-select-sm"
            :disabled="saving"
            @change="changeStatus"
          >
            <option value="">Select next status</option>
            <option
              v-for="item in statusOptions"
              :key="item.value"
              :value="item.value"
            >
              {{ item.label }}
            </option>
          </select>
        </div>

        <h3 class="h6">Conversation</h3>
        <div class="conversation border rounded p-3 mb-3">
          <article
            v-for="message in messages.filter(
              (item) => item.kind !== 'internal_note',
            )"
            :key="message._id"
            class="message mb-3"
            :class="{ 'message--staff': message.kind === 'staff_response' }"
          >
            <div class="d-flex justify-content-between gap-2 small mb-1">
              <strong>{{
                message.kind === "staff_response"
                  ? fullName(message.createdByUserId)
                  : `${enquiry.firstName} ${enquiry.lastName}`
              }}</strong
              ><span class="text-muted">{{
                formatDate(message.receivedAt || message.sentAt || message.createdAt)
              }}</span>
            </div>
            <p class="mb-1 text-prewrap">{{ message.body }}</p>
            <div
              v-if="message.source === 'gmail'"
              class="small text-muted"
            >
              <i class="bi bi-envelope-check me-1"></i>Received by email
            </div>
            <div
              v-if="message.deliveryStatus === 'failed'"
              class="small text-danger"
            >
              Delivery failed.
              <button
                class="btn btn-link btn-sm p-0"
                :disabled="saving"
                @click="retry(message)"
              >
                Retry
              </button>
            </div>
            <div
              v-else-if="message.kind === 'staff_response'"
              class="small text-success"
            >
              <i class="bi bi-check2"></i> Sent
            </div>
          </article>
        </div>

        <div v-if="canRespond" class="mb-4">
          <label class="form-label fw-semibold">Response to enquirer</label
          ><textarea
            v-model="responseBody"
            class="form-control"
            rows="5"
            maxlength="12000"
            placeholder="Write the response that will be emailed to the enquirer"
          ></textarea>
          <div class="d-flex justify-content-between mt-2">
            <small class="text-muted"
              >Sent using the ALECONS enquiry identity</small
            ><button
              class="btn btn-primary btn-sm"
              :disabled="saving || responseBody.trim().length < 2"
              @click="respond"
            >
              <i class="bi bi-send me-1"></i>Send response
            </button>
          </div>
        </div>

        <div v-if="canAddNote" class="mb-4">
          <label class="form-label fw-semibold">Internal note</label
          ><textarea
            v-model="noteBody"
            class="form-control"
            rows="3"
            maxlength="12000"
            placeholder="Visible to staff only"
          ></textarea
          ><button
            class="btn btn-outline-secondary btn-sm mt-2"
            :disabled="saving || noteBody.trim().length < 2"
            @click="addNote"
          >
            Add note
          </button>
        </div>

        <div v-if="messages.some((item) => item.kind === 'internal_note')">
          <h3 class="h6">Internal notes</h3>
          <div
            v-for="note in messages.filter(
              (item) => item.kind === 'internal_note',
            )"
            :key="note._id"
            class="alert alert-light border small"
          >
            <div class="fw-semibold">
              {{ fullName(note.createdByUserId) }} ·
              {{ formatDate(note.createdAt) }}
            </div>
            <div class="text-prewrap mt-1">{{ note.body }}</div>
          </div>
        </div>
        <details class="mt-3">
          <summary class="small fw-semibold">
            Activity history ({{ activities.length }})
          </summary>
          <ol class="timeline small mt-2">
            <li v-for="activity in activities" :key="activity._id" class="mb-2">
              <span class="text-capitalize">{{
                activity.action.replaceAll("_", " ")
              }}</span>
              <div class="text-muted">
                {{ fullName(activity.actorUserId) }} ·
                {{ formatDate(activity.createdAt) }}
              </div>
            </li>
          </ol>
        </details>
      </div>
    </aside>
  </main>
</template>

<style scoped>
.enquiry-detail {
  visibility: visible;
  width: min(620px, 100vw);
  z-index: 1055;
}
.offcanvas-backdrop {
  z-index: 1050;
}
.conversation {
  max-height: 26rem;
  overflow-y: auto;
  background: #f8f9fa;
}
.message {
  background: #fff;
  border-left: 3px solid #adb5bd;
  padding: 0.8rem;
}
.message--staff {
  border-left-color: var(--acon-primary);
  background: #f1f8f8;
}
.text-prewrap {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.timeline {
  padding-left: 1.25rem;
}
@media (max-width: 575.98px) {
  .enquiry-detail {
    width: 100vw;
  }
}
</style>

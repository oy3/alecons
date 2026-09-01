<script>
import Swal from "sweetalert2";
import { apiService } from "../../services/api.js";
import { useAuthStore } from "../../stores/auth.js";
import RichTextEditor from "../../components/RichTextEditor.vue";
import { logger } from "@shared/utils/logger";

const emptyForm = () => ({
  title: "",
  messageHtml: "",
  category: "general",
  priority: "normal",
  audience: { type: "all", programId: "", level: null, userIds: [] },
  action: { label: "", url: "" },
  expiresAt: "",
  scheduledAt: "",
});

export default {
  name: "NotificationsManagement",
  components: { RichTextEditor },
  setup() {
    return { authStore: useAuthStore() };
  },
  data() {
    return {
      notifications: [],
      stats: {
        total: 0,
        drafts: 0,
        scheduled: 0,
        sent: 0,
        recipientTotal: 0,
        readRate: 0,
      },
      filters: { search: "", status: "", category: "" },
      page: 1,
      totalPages: 1,
      total: 0,
      isLoading: true,
      isSaving: false,
      showComposer: false,
      editingId: null,
      form: emptyForm(),
      audiencePreview: null,
      options: { programs: [] },
      selectedProgramTypeId: "",
      selectedProgramModeId: "",
      recipientSearch: "",
      recipientResults: [],
      selectedRecipients: [],
      searchTimer: null,
      selectedNotification: null,
      showDetail: false,
      filterTimer: null,
    };
  },
  computed: {
    canCreate() {
      return this.authStore.hasPermission("notifications", "create");
    },
    canEdit() {
      return this.authStore.hasPermission("notifications", "edit");
    },
    canSend() {
      return this.authStore.hasPermission("notifications", "send");
    },
    canArchive() {
      return this.authStore.hasPermission("notifications", "archive");
    },
    programTypes() {
      const items = new Map();
      this.options.programs.forEach((program) => {
        const value = program.programTypeId;
        if (value?._id) items.set(value._id, value);
      });
      return [...items.values()].sort((a, b) => a.type.localeCompare(b.type));
    },
    programModes() {
      const items = new Map();
      this.options.programs.forEach((program) => {
        const value = program.programModeId;
        if (value?._id) items.set(value._id, value);
      });
      return [...items.values()].sort((a, b) => a.mode.localeCompare(b.mode));
    },
    filteredPrograms() {
      return this.options.programs.filter(
        (program) =>
          (!this.selectedProgramTypeId ||
            program.programTypeId?._id === this.selectedProgramTypeId) &&
          (!this.selectedProgramModeId ||
            program.programModeId?._id === this.selectedProgramModeId),
      );
    },
    selectedProgram() {
      return this.options.programs.find(
        (program) => program._id === this.form.audience.programId,
      );
    },
    levels() {
      return Array.from(
        { length: Number(this.selectedProgram?.durationYears || 0) },
        (_, index) => index + 1,
      );
    },
    messageTextLength() {
      return this.form.messageHtml.replace(/<[^>]*>/g, "").length;
    },
    isFormValid() {
      const hasContent =
        this.form.title.trim().length >= 2 &&
        this.form.messageHtml.replace(/<[^>]*>/g, "").trim().length >= 2;
      if (!hasContent) return false;
      if (this.messageTextLength > 12000) return false;
      if (this.form.audience.type === "student_cohort")
        return Boolean(
          this.form.audience.programId && this.form.audience.level,
        );
      if (this.form.audience.type === "specific_users")
        return this.selectedRecipients.length > 0;
      return true;
    },
  },
  watch: {
    filters: {
      deep: true,
      handler() {
        clearTimeout(this.filterTimer);
        this.filterTimer = setTimeout(() => {
          this.page = 1;
          this.loadNotifications();
        }, 300);
      },
    },
    "form.audience.type"() {
      this.audiencePreview = null;
    },
    selectedProgramTypeId() {
      this.form.audience.programId = "";
      this.form.audience.level = null;
    },
    selectedProgramModeId() {
      this.form.audience.programId = "";
      this.form.audience.level = null;
    },
    recipientSearch(value) {
      clearTimeout(this.searchTimer);
      if (value.trim().length < 2) {
        this.recipientResults = [];
        return;
      }
      this.searchTimer = setTimeout(() => this.searchRecipients(), 300);
    },
  },
  async mounted() {
    await Promise.all([
      this.loadNotifications(),
      this.loadStats(),
      this.loadOptions(),
    ]);
  },
  methods: {
    async loadNotifications() {
      try {
        this.isLoading = true;
        const response = await apiService.getNotifications({
          ...this.filters,
          page: this.page,
          limit: 15,
        });
        this.notifications = response.data?.notifications || [];
        this.totalPages = response.data?.pagination?.pages || 1;
        this.total = response.data?.pagination?.total || 0;
      } catch (error) {
        logger.error("Could not load notifications", error);
        await this.errorAlert("Could not load notifications", error);
      } finally {
        this.isLoading = false;
      }
    },
    async loadStats() {
      try {
        const response = await apiService.getNotificationStats();
        this.stats = { ...this.stats, ...(response.data || {}) };
      } catch (error) {
        logger.error("Could not load notification stats", error);
      }
    },
    async loadOptions() {
      try {
        const response = await apiService.getStaffStudentFilterOptions();
        this.options = response.data || this.options;
      } catch (error) {
        logger.error("Could not load audience options", error);
      }
    },
    openComposer(notification = null) {
      this.editingId = notification?.id || notification?._id || null;
      this.form = emptyForm();
      this.selectedRecipients = [];
      this.recipientResults = [];
      this.recipientSearch = "";
      this.audiencePreview = null;
      this.selectedProgramTypeId = "";
      this.selectedProgramModeId = "";
      if (notification) this.populateForm(notification);
      this.showComposer = true;
      document.body.classList.add("modal-open");
    },
    async editNotification(notification) {
      try {
        const response = await apiService.getNotification(
          notification.id || notification._id,
        );
        this.openComposer(response.data);
      } catch (error) {
        await this.errorAlert("Could not open notification", error);
      }
    },
    populateForm(notification) {
      const audience = notification.audience || { type: "all" };
      const program = audience.programId;
      this.form = {
        title: notification.title || "",
        messageHtml: notification.messageHtml || "",
        category: notification.category || "general",
        priority: notification.priority || "normal",
        audience: {
          type: audience.type,
          programId: program?._id || program || "",
          level: audience.level || null,
          userIds: (audience.userIds || []).map((id) => id?._id || id),
        },
        action: {
          label: notification.action?.label || "",
          url: notification.action?.url || "",
        },
        expiresAt: this.toLocalInput(notification.expiresAt),
        scheduledAt: "",
      };
      if (program?._id) {
        this.selectedProgramTypeId = program.programTypeId?._id || "";
        this.selectedProgramModeId = program.programModeId?._id || "";
      }
      if (audience.type === "specific_users")
        this.selectedRecipients = (audience.userIds || []).map((user) =>
          typeof user === "object"
            ? {
                id: user._id,
                name: [user.firstName, user.lastName].filter(Boolean).join(" "),
                email: user.email,
                role: user.role,
              }
            : { id: user },
        );
    },
    closeComposer() {
      this.showComposer = false;
      document.body.classList.remove("modal-open");
    },
    payload() {
      const audience = { type: this.form.audience.type };
      if (audience.type === "student_cohort")
        Object.assign(audience, {
          programId: this.form.audience.programId,
          level: Number(this.form.audience.level),
        });
      if (audience.type === "specific_users")
        audience.userIds = this.selectedRecipients.map((user) => user.id);
      const payload = {
        title: this.form.title.trim(),
        messageHtml: this.form.messageHtml,
        category: this.form.category,
        priority: this.form.priority,
        audience,
        action:
          this.form.action.label.trim() && this.form.action.url.trim()
            ? {
                label: this.form.action.label.trim(),
                url: this.form.action.url.trim(),
              }
            : null,
        expiresAt: this.form.expiresAt
          ? new Date(this.form.expiresAt).toISOString()
          : null,
      };
      return payload;
    },
    async saveDraft(close = true) {
      if (!this.isFormValid) return null;
      try {
        this.isSaving = true;
        const response = this.editingId
          ? await apiService.updateNotification(this.editingId, this.payload())
          : await apiService.createNotification(this.payload());
        this.editingId =
          response.data?.id || response.data?._id || this.editingId;
        if (close) {
          this.closeComposer();
          await Swal.fire({
            icon: "success",
            title: "Draft saved",
            timer: 1400,
            showConfirmButton: false,
          });
        }
        await Promise.all([this.loadNotifications(), this.loadStats()]);
        return this.editingId;
      } catch (error) {
        await this.errorAlert("Could not save notification", error);
        return null;
      } finally {
        this.isSaving = false;
      }
    },
    async previewAudience() {
      try {
        const response = await apiService.previewNotificationAudience(
          this.payload().audience,
        );
        this.audiencePreview = response.data;
      } catch (error) {
        await this.errorAlert("Could not preview audience", error);
      }
    },
    async sendFromComposer() {
      await this.previewAudience();
      if (!this.audiencePreview) return;
      if (!this.audiencePreview.count) {
        await Swal.fire({
          icon: "warning",
          title: "No recipients found",
          text: "Change the audience before sending.",
        });
        return;
      }
      const result = await Swal.fire({
        icon: "question",
        title: "Send notification?",
        text: `This will notify ${this.audiencePreview.count} recipient${this.audiencePreview.count === 1 ? "" : "s"}.`,
        showCancelButton: true,
        confirmButtonText: "Send now",
        confirmButtonColor: "#1a5f5f",
      });
      if (!result.isConfirmed) return;
      const id = await this.saveDraft(false);
      if (!id) return;
      try {
        await apiService.publishNotification(id);
        this.closeComposer();
        await Swal.fire({
          icon: "success",
          title: "Delivery started",
          timer: 1600,
          showConfirmButton: false,
        });
        await Promise.all([this.loadNotifications(), this.loadStats()]);
      } catch (error) {
        await this.errorAlert("Could not send notification", error);
      }
    },
    async scheduleFromComposer() {
      if (!this.form.scheduledAt) return;
      const id = await this.saveDraft(false);
      if (!id) return;
      try {
        await apiService.scheduleNotification(
          id,
          new Date(this.form.scheduledAt).toISOString(),
        );
        this.closeComposer();
        await Swal.fire({
          icon: "success",
          title: "Notification scheduled",
          timer: 1600,
          showConfirmButton: false,
        });
        await Promise.all([this.loadNotifications(), this.loadStats()]);
      } catch (error) {
        await this.errorAlert("Could not schedule notification", error);
      }
    },
    async publishDraft(item) {
      try {
        const preview = await apiService.previewNotificationAudience(
          item.audience,
        );
        const count = preview.data?.count || 0;
        const result = await Swal.fire({
          icon: "question",
          title: "Send notification?",
          text: `This will notify ${count} recipient${count === 1 ? "" : "s"}.`,
          showCancelButton: true,
          confirmButtonText: "Send now",
          confirmButtonColor: "#1a5f5f",
        });
        if (!result.isConfirmed) return;
        await apiService.publishNotification(item.id || item._id);
        await Promise.all([this.loadNotifications(), this.loadStats()]);
      } catch (error) {
        await this.errorAlert("Could not send notification", error);
      }
    },
    async deleteDraft(item) {
      const result = await Swal.fire({
        icon: "warning",
        title: "Delete draft?",
        text: "This action cannot be undone.",
        showCancelButton: true,
        confirmButtonText: "Delete",
        confirmButtonColor: "#dc3545",
      });
      if (!result.isConfirmed) return;
      try {
        await apiService.deleteNotification(item.id || item._id);
        await Promise.all([this.loadNotifications(), this.loadStats()]);
      } catch (error) {
        await this.errorAlert("Could not delete draft", error);
      }
    },
    async duplicate(item) {
      try {
        await apiService.duplicateNotification(item.id || item._id);
        await Promise.all([this.loadNotifications(), this.loadStats()]);
        await Swal.fire({
          icon: "success",
          title: "Draft copy created",
          timer: 1400,
          showConfirmButton: false,
        });
      } catch (error) {
        await this.errorAlert("Could not duplicate notification", error);
      }
    },
    async cancelScheduled(item) {
      const result = await Swal.fire({
        icon: "warning",
        title: "Cancel scheduled notification?",
        showCancelButton: true,
        confirmButtonText: "Cancel notification",
      });
      if (!result.isConfirmed) return;
      try {
        await apiService.cancelNotification(item.id || item._id);
        await Promise.all([this.loadNotifications(), this.loadStats()]);
      } catch (error) {
        await this.errorAlert("Could not cancel notification", error);
      }
    },
    async archive(item) {
      try {
        await apiService.archiveNotification(item.id || item._id);
        await Promise.all([this.loadNotifications(), this.loadStats()]);
      } catch (error) {
        await this.errorAlert("Could not archive notification", error);
      }
    },
    async openDetail(item) {
      try {
        const response = await apiService.getNotification(item.id || item._id);
        this.selectedNotification = response.data;
        this.showDetail = true;
        document.body.classList.add("overflow-hidden");
      } catch (error) {
        await this.errorAlert("Could not load notification", error);
      }
    },
    closeDetail() {
      this.showDetail = false;
      document.body.classList.remove("overflow-hidden");
    },
    async searchRecipients() {
      try {
        const response = await apiService.searchNotificationRecipients({
          search: this.recipientSearch,
          limit: 20,
        });
        this.recipientResults = (response.data || []).filter(
          (result) =>
            !this.selectedRecipients.some(
              (selected) => selected.id === result.id,
            ),
        );
      } catch (error) {
        logger.error("Recipient search failed", error);
      }
    },
    addRecipient(user) {
      this.selectedRecipients.push(user);
      this.recipientResults = this.recipientResults.filter(
        (result) => result.id !== user.id,
      );
    },
    removeRecipient(user) {
      this.selectedRecipients = this.selectedRecipients.filter(
        (selected) => selected.id !== user.id,
      );
    },
    formatDate(value) {
      return value
        ? new Intl.DateTimeFormat("en-NG", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(value))
        : "Not set";
    },
    toLocalInput(value) {
      if (!value) return "";
      const date = new Date(value);
      return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
    },
    statusClass(status) {
      return (
        {
          draft: "text-bg-secondary",
          scheduled: "text-bg-info",
          processing: "text-bg-warning",
          sent: "text-bg-success",
          partially_failed: "text-bg-danger",
          cancelled: "text-bg-dark",
          archived: "text-bg-light",
        }[status] || "text-bg-secondary"
      );
    },
    priorityClass(priority) {
      return (
        {
          normal: "text-bg-light",
          high: "text-bg-warning",
          urgent: "text-bg-danger",
        }[priority] || "text-bg-light"
      );
    },
    async errorAlert(title, error) {
      return Swal.fire({
        icon: "error",
        title,
        text: error?.message || "Please try again.",
        confirmButtonColor: "#1a5f5f",
      });
    },
  },
  beforeUnmount() {
    document.body.classList.remove("modal-open", "overflow-hidden");
    clearTimeout(this.searchTimer);
    clearTimeout(this.filterTimer);
  },
};
</script>

<template>
  <main class="container-fluid py-4 px-lg-4">
    <div
      class="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-4"
    >
      <div>
        <h2 class="fw-bold text-staff-primary mb-1">
          Notifications Management
        </h2>
        <p class="text-muted mb-0">
          Create and manage institutional notifications.
        </p>
      </div>
      <button
        v-if="canCreate"
        class="btn btn-staff-primary"
        type="button"
        @click="openComposer()"
      >
        <i class="bi bi-plus-lg me-2"></i>New Notification
      </button>
    </div>

    <div class="row g-3 mb-4">
      <div
        v-for="card in [
          {
            label: 'Campaigns',
            value: stats.total,
            icon: 'bi-megaphone',
            tone: 'primary',
          },
          {
            label: 'Drafts',
            value: stats.drafts,
            icon: 'bi-file-earmark',
            tone: 'secondary',
          },
          {
            label: 'Scheduled',
            value: stats.scheduled,
            icon: 'bi-clock',
            tone: 'info',
          },
          {
            label: 'Read rate',
            value: `${stats.readRate}%`,
            icon: 'bi-check2-all',
            tone: 'success',
          },
        ]"
        :key="card.label"
        class="col-sm-6 col-xl-3"
      >
        <div class="card border-0 shadow-sm h-100 py-0 px-2">
          <div
            class="card-body d-flex justify-content-between align-items-center"
          >
            <div>
              <div class="small text-muted">{{ card.label }}</div>
              <div class="h3 mb-0">{{ card.value }}</div>
            </div>
            <i :class="[card.icon, `text-${card.tone}`]" class="bi fs-2"></i>
          </div>
        </div>
      </div>
    </div>

    <section class="card border-0 shadow-sm p-0">
      <div class="card-body border-bottom">
        <div class="row g-2">
          <div class="col-lg-6">
            <div class="input-group">
              <span class="input-group-text bg-white"
                ><i class="bi bi-search"></i></span
              ><input
                v-model="filters.search"
                class="form-control"
                placeholder="Search notifications"
              />
            </div>
          </div>
          <div class="col-sm-6 col-lg-3">
            <select v-model="filters.status" class="form-select">
              <option value="">All statuses</option>
              <option
                v-for="status in [
                  'draft',
                  'scheduled',
                  'processing',
                  'sent',
                  'partially_failed',
                  'cancelled',
                  'archived',
                ]"
                :key="status"
                :value="status"
              >
                {{ status.replaceAll("_", " ") }}
              </option>
            </select>
          </div>
          <div class="col-sm-6 col-lg-3">
            <select v-model="filters.category" class="form-select">
              <option value="">All categories</option>
              <option
                v-for="category in [
                  'general',
                  'admissions',
                  'academic',
                  'payment',
                  'system',
                  'emergency',
                ]"
                :key="category"
                :value="category"
              >
                {{ category }}
              </option>
            </select>
          </div>
        </div>
      </div>
      <div class="table-responsive">
        <table class="table align-middle mb-0">
          <thead class="table-light">
            <tr>
              <th>Notification</th>
              <th>Audience</th>
              <th>Status</th>
              <th>Delivery</th>
              <th>Created</th>
              <th class="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="isLoading">
              <td colspan="6" class="text-center py-5">
                <span
                  class="spinner-border text-staff-primary"
                  aria-label="Loading"
                ></span>
              </td>
            </tr>
            <tr v-else-if="!notifications.length">
              <td colspan="6" class="text-center py-5 text-muted">
                <i class="bi bi-bell-slash fs-2 d-block mb-2"></i>No
                notifications found
              </td>
            </tr>
            <tr v-for="item in notifications" v-else :key="item.id || item._id">
              <td>
                <button
                  class="btn btn-link p-0 text-start text-decoration-none text-dark fw-semibold"
                  @click="openDetail(item)"
                >
                  {{ item.title }}
                </button>
                <div class="small text-muted text-capitalize">
                  {{ item.category }}
                  <span
                    class="badge ms-1"
                    :class="priorityClass(item.priority)"
                    >{{ item.priority }}</span
                  >
                </div>
              </td>
              <td>
                <span class="small">{{ item.audienceSummary }}</span>
              </td>
              <td>
                <span
                  class="badge text-capitalize"
                  :class="statusClass(item.status)"
                  >{{ item.status.replaceAll("_", " ") }}</span
                >
              </td>
              <td>
                <div class="small">
                  {{ item.recipientCount || 0 }} recipients
                </div>
                <div class="text-muted small">
                  {{ item.readCount || 0 }} read
                </div>
              </td>
              <td>
                <div class="small">{{ formatDate(item.createdAt) }}</div>
                <div class="text-muted small">
                  {{ item.createdBy?.firstName }} {{ item.createdBy?.lastName }}
                </div>
              </td>
              <td class="text-end text-nowrap">
                <button
                  class="btn btn-sm btn-link text-secondary"
                  title="View"
                  @click="openDetail(item)"
                >
                  <i class="bi bi-eye"></i>
                </button>
                <button
                  v-if="canCreate"
                  class="btn btn-sm btn-link text-secondary"
                  title="Duplicate"
                  @click="duplicate(item)"
                >
                  <i class="bi bi-copy"></i>
                </button>
                <button
                  v-if="canEdit && ['draft', 'cancelled'].includes(item.status)"
                  class="btn btn-sm btn-link text-primary"
                  title="Edit"
                  @click="editNotification(item)"
                >
                  <i class="bi bi-pencil"></i>
                </button>
                <button
                  v-if="canSend && item.status === 'draft'"
                  class="btn btn-sm btn-link text-success"
                  title="Send"
                  @click="publishDraft(item)"
                >
                  <i class="bi bi-send"></i>
                </button>
                <button
                  v-if="canSend && item.status === 'scheduled'"
                  class="btn btn-sm btn-link text-warning"
                  title="Cancel"
                  @click="cancelScheduled(item)"
                >
                  <i class="bi bi-x-circle"></i>
                </button>
                <button
                  v-if="
                    canArchive &&
                    ['sent', 'partially_failed'].includes(item.status)
                  "
                  class="btn btn-sm btn-link text-secondary"
                  title="Archive"
                  @click="archive(item)"
                >
                  <i class="bi bi-archive"></i>
                </button>
                <button
                  v-if="canEdit && item.status === 'draft'"
                  class="btn btn-sm btn-link text-danger"
                  title="Delete"
                  @click="deleteDraft(item)"
                >
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div
        v-if="totalPages > 1"
        class="card-footer bg-white d-flex justify-content-between align-items-center"
      >
        <span class="small text-muted">{{ total }} notifications</span>
        <div class="btn-group">
          <button
            class="btn btn-sm btn-outline-secondary"
            :disabled="page <= 1"
            @click="
              page--;
              loadNotifications();
            "
          >
            <i class="bi bi-chevron-left"></i></button
          ><button class="btn btn-sm btn-outline-secondary" disabled>
            {{ page }} / {{ totalPages }}</button
          ><button
            class="btn btn-sm btn-outline-secondary"
            :disabled="page >= totalPages"
            @click="
              page++;
              loadNotifications();
            "
          >
            <i class="bi bi-chevron-right"></i>
          </button>
        </div>
      </div>
    </section>

    <div
      v-if="showComposer"
      class="modal fade show d-block"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
    >
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <div>
              <h5 class="modal-title fw-bold">
                {{ editingId ? "Edit Notification" : "New Notification" }}
              </h5>
              <div class="small text-muted">
                Drafts can be reviewed before delivery.
              </div>
            </div>
            <button
              class="btn-close"
              aria-label="Close"
              @click="closeComposer"
            ></button>
          </div>
          <div class="modal-body">
            <div class="row g-4">
              <div class="col-lg-7">
                <h6 class="fw-bold mb-3">Content</h6>
                <div class="mb-3">
                  <label class="form-label" for="notificationTitle">Title</label
                  ><input
                    id="notificationTitle"
                    v-model="form.title"
                    maxlength="140"
                    class="form-control"
                  />
                </div>
                <div class="mb-3">
                  <label class="form-label">Message</label>
                  <RichTextEditor
                    v-model="form.messageHtml"
                    :max-length="12000"
                    placeholder="Write the notification message"
                  />
                </div>
                <div class="row g-3">
                  <div class="col-md-6">
                    <label class="form-label">Category</label
                    ><select v-model="form.category" class="form-select">
                      <option
                        v-for="value in [
                          'general',
                          'admissions',
                          'academic',
                          'payment',
                          'system',
                          'emergency',
                        ]"
                        :key="value"
                        :value="value"
                      >
                        {{ value }}
                      </option>
                    </select>
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Priority</label
                    ><select v-model="form.priority" class="form-select">
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div class="row g-3 mt-0">
                  <div class="col-md-6">
                    <label class="form-label">Action label</label
                    ><input
                      v-model="form.action.label"
                      class="form-control"
                      maxlength="50"
                      placeholder="Optional"
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Action URL</label
                    ><input
                      v-model="form.action.url"
                      class="form-control"
                      maxlength="500"
                      placeholder="/path or https://..."
                    />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label">Expires</label
                    ><input
                      v-model="form.expiresAt"
                      type="datetime-local"
                      class="form-control"
                    />
                  </div>
                </div>
              </div>
              <div class="col-lg-5">
                <h6 class="fw-bold mb-3">Audience</h6>
                <div class="list-group mb-3">
                  <label
                    v-for="audience in [
                      { value: 'all', label: 'All users' },
                      { value: 'staff', label: 'Staff' },
                      { value: 'students', label: 'Students' },
                      { value: 'applicants', label: 'Applicants' },
                      { value: 'student_cohort', label: 'Student cohort' },
                      { value: 'specific_users', label: 'Specific users' },
                    ]"
                    :key="audience.value"
                    class="list-group-item d-flex gap-2 align-items-center"
                    ><input
                      v-model="form.audience.type"
                      class="form-check-input mt-0"
                      type="radio"
                      :value="audience.value"
                    />{{ audience.label }}</label
                  >
                </div>
                <div
                  v-if="form.audience.type === 'student_cohort'"
                  class="border rounded p-3 mb-3"
                >
                  <div class="row g-2">
                    <div class="col-6">
                      <label class="form-label small">Program Type</label
                      ><select
                        v-model="selectedProgramTypeId"
                        class="form-select"
                      >
                        <option value="">All</option>
                        <option
                          v-for="type in programTypes"
                          :key="type._id"
                          :value="type._id"
                        >
                          {{ type.type }}
                        </option>
                      </select>
                    </div>
                    <div class="col-6">
                      <label class="form-label small">Program Mode</label
                      ><select
                        v-model="selectedProgramModeId"
                        class="form-select"
                      >
                        <option value="">All</option>
                        <option
                          v-for="mode in programModes"
                          :key="mode._id"
                          :value="mode._id"
                        >
                          {{ mode.mode }}
                        </option>
                      </select>
                    </div>
                    <div class="col-12">
                      <label class="form-label small">Program</label
                      ><select
                        v-model="form.audience.programId"
                        class="form-select"
                      >
                        <option value="">Select program</option>
                        <option
                          v-for="program in filteredPrograms"
                          :key="program._id"
                          :value="program._id"
                        >
                          {{ program.name }}
                        </option>
                      </select>
                    </div>
                    <div class="col-12">
                      <label class="form-label small">Level</label
                      ><select
                        v-model="form.audience.level"
                        :disabled="!form.audience.programId"
                        class="form-select"
                      >
                        <option :value="null">Select level</option>
                        <option
                          v-for="level in levels"
                          :key="level"
                          :value="level"
                        >
                          Level {{ level }}
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
                <div
                  v-if="form.audience.type === 'specific_users'"
                  class="border rounded p-3 mb-3"
                >
                  <label class="form-label small">Find recipients</label
                  ><input
                    v-model="recipientSearch"
                    class="form-control"
                    placeholder="Name or email"
                  />
                  <div
                    v-if="recipientResults.length"
                    class="list-group mt-2 recipient-results"
                  >
                    <button
                      v-for="user in recipientResults"
                      :key="user.id"
                      type="button"
                      class="list-group-item list-group-item-action d-flex justify-content-between"
                      @click="addRecipient(user)"
                    >
                      <span
                        ><strong>{{ user.name }}</strong
                        ><small class="d-block text-muted">{{
                          user.email
                        }}</small></span
                      ><span class="badge text-bg-light align-self-center">{{
                        user.identifier || user.role
                      }}</span>
                    </button>
                  </div>
                  <div class="d-flex flex-wrap gap-2 mt-3">
                    <span
                      v-for="user in selectedRecipients"
                      :key="user.id"
                      class="badge text-bg-light border py-2"
                      >{{ user.name || user.email || user.id
                      }}<button
                        type="button"
                        class="btn-close ms-2"
                        aria-label="Remove"
                        @click="removeRecipient(user)"
                      ></button
                    ></span>
                  </div>
                </div>
                <button
                  type="button"
                  class="btn btn-outline-staff-primary w-100"
                  :disabled="!isFormValid"
                  @click="previewAudience"
                >
                  <i class="bi bi-people me-2"></i>Preview audience
                </button>
                <div
                  v-if="audiencePreview"
                  class="alert alert-light border mt-3 mb-0"
                >
                  <strong>{{ audiencePreview.count }}</strong> recipient{{
                    audiencePreview.count === 1 ? "" : "s"
                  }}
                  <div class="small text-muted">
                    {{ audiencePreview.summary }}
                  </div>
                </div>
                <div v-if="canSend" class="mt-4">
                  <label class="form-label">Schedule delivery</label>
                  <div class="input-group">
                    <input
                      v-model="form.scheduledAt"
                      type="datetime-local"
                      class="form-control"
                    /><button
                      class="btn btn-outline-secondary"
                      type="button"
                      :disabled="!isFormValid || !form.scheduledAt || isSaving"
                      @click="scheduleFromComposer"
                    >
                      <i class="bi bi-clock"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-light" @click="closeComposer">Cancel</button
            ><button
              class="btn btn-outline-staff-primary"
              :disabled="!isFormValid || isSaving"
              @click="saveDraft(true)"
            >
              <span
                v-if="isSaving"
                class="spinner-border spinner-border-sm me-2"
              ></span
              >Save Draft</button
            ><button
              v-if="canSend"
              class="btn btn-staff-primary"
              :disabled="!isFormValid || isSaving"
              @click="sendFromComposer"
            >
              <i class="bi bi-send me-2"></i>Send Now
            </button>
          </div>
        </div>
      </div>
      <div class="modal-backdrop fade show" @click="closeComposer"></div>
    </div>

    <template v-if="showDetail && selectedNotification"
      ><div
        class="offcanvas offcanvas-end show"
        tabindex="-1"
        style="visibility: visible"
        aria-modal="true"
        role="dialog"
      >
        <div class="offcanvas-header border-bottom">
          <h5 class="offcanvas-title fw-bold">Notification details</h5>
          <button class="btn-close" @click="closeDetail"></button>
        </div>
        <div class="offcanvas-body">
          <div class="d-flex gap-2 mb-3">
            <span
              class="badge text-capitalize"
              :class="statusClass(selectedNotification.status)"
              >{{ selectedNotification.status }}</span
            ><span
              class="badge"
              :class="priorityClass(selectedNotification.priority)"
              >{{ selectedNotification.priority }}</span
            >
          </div>
          <h4>{{ selectedNotification.title }}</h4>
          <div
            class="notification-content my-3"
            v-html="selectedNotification.messageHtml"
          ></div>
          <hr />
          <dl class="row small">
            <dt class="col-5">Audience</dt>
            <dd class="col-7">{{ selectedNotification.audienceSummary }}</dd>
            <dt class="col-5">Recipients</dt>
            <dd class="col-7">{{ selectedNotification.recipientCount }}</dd>
            <dt class="col-5">Read</dt>
            <dd class="col-7">{{ selectedNotification.readCount }}</dd>
            <dt class="col-5">Sent</dt>
            <dd class="col-7">{{ formatDate(selectedNotification.sentAt) }}</dd>
          </dl>
          <h6 class="fw-bold mt-4">Activity</h6>
          <div class="list-group list-group-flush">
            <div
              v-for="audit in selectedNotification.audits"
              :key="audit._id"
              class="list-group-item px-0"
            >
              <div class="fw-semibold text-capitalize">
                {{ audit.action.replaceAll("_", " ") }}
              </div>
              <div class="small text-muted">
                {{ audit.actorUserId?.firstName }}
                {{ audit.actorUserId?.lastName }} ·
                {{ formatDate(audit.createdAt) }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="offcanvas-backdrop fade show" @click="closeDetail"></div
    ></template>
  </main>
</template>

<style scoped>
.modal {
  z-index: 1060;
}
.modal-backdrop {
  z-index: -1;
}
.recipient-results {
  max-height: 230px;
  overflow-y: auto;
}
.offcanvas {
  width: min(460px, 100vw);
  z-index: 1080;
}
.offcanvas-backdrop {
  z-index: 1070;
}
.notification-content :deep(img) {
  max-width: 100%;
  height: auto;
}
.notification-content :deep(p:last-child) {
  margin-bottom: 0;
}
@media (max-width: 575.98px) {
  .modal-dialog {
    margin: 0;
    min-height: 100%;
  }
  .modal-content {
    min-height: 100vh;
    border: 0;
    border-radius: 0;
  }
}
</style>

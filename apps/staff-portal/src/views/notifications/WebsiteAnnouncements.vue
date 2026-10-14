<script setup>
import {
  computed,
  nextTick,
  onMounted,
  onBeforeUnmount,
  ref,
  watch,
} from "vue";
import Swal from "sweetalert2";
import { apiService } from "../../services/api.js";
import { useAuthStore } from "../../stores/auth.js";

const emit = defineEmits(["close"]);
const auth = useAuthStore();
const entries = ref([]);
const revision = ref(0);
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const editing = ref(null);
const emptyForm = () => ({
  message: "",
  linkUrl: "",
  linkLabel: "",
  startsAt: "",
  endsAt: "",
});
const form = ref(emptyForm());
const search = ref("");
const status = ref("");
const page = ref(1);
const now = ref(Date.now());
const dialog = ref(null);
const canCreate = computed(() => auth.hasPermission("notifications", "create"));
const canEdit = computed(() => auth.hasPermission("notifications", "edit"));
const canSend = computed(() => auth.hasPermission("notifications", "send"));
const canExpire = computed(() =>
  auth.hasPermission("notifications", "archive"),
);
const currentEntries = computed(() => {
  const timestamp = Math.max(now.value, Date.now());
  return entries.value.map((item) => ({
    ...item,
    status:
      item.expiredAt ||
      (item.endsAt && Date.parse(item.endsAt) <= timestamp) ||
      (item.supersededAt && Date.parse(item.supersededAt) <= timestamp)
        ? "expired"
        : Date.parse(item.startsAt) > timestamp
          ? "scheduled"
          : "active",
  }));
});
const filtered = computed(() =>
  currentEntries.value.filter(
    (item) =>
      (!status.value || item.status === status.value) &&
      `${item.message} ${item.linkLabel || ""} ${item.linkUrl || ""}`
        .toLowerCase()
        .includes(search.value.toLowerCase()),
  ),
);
const pages = computed(() =>
  Math.max(1, Math.ceil(filtered.value.length / 10)),
);
const visibleEntries = computed(() =>
  filtered.value.slice((page.value - 1) * 10, page.value * 10),
);
watch(pages, () => {
  page.value = Math.min(page.value, pages.value);
});
const pagination = computed(() => {
  const numbers = [
    ...new Set([
      1,
      2,
      pages.value - 1,
      pages.value,
      page.value - 1,
      page.value,
      page.value + 1,
    ]),
  ]
    .filter((value) => value > 0 && value <= pages.value)
    .sort((a, b) => a - b);
  const result = [];
  numbers.forEach((value, index) => {
    if (index && value - numbers[index - 1] > 1) result.push(`gap-${value}`);
    result.push(value);
  });
  return result;
});
watch([search, status], () => {
  page.value = 1;
});
const toInput = (value) =>
  value ? new Date(Date.parse(value) + 3600000).toISOString().slice(0, 16) : "";
const toIso = (value) =>
  value ? new Date(`${value}:00+01:00`).toISOString() : undefined;
const dateLabel = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Lagos",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "No end date";
const endDate = (item) =>
  [item.endsAt, item.supersededAt, item.expiredAt].filter(Boolean).sort()[0];
function reset() {
  editing.value = null;
  form.value = emptyForm();
}
function edit(item) {
  editing.value = item;
  form.value = {
    message: item.message,
    linkUrl: item.linkUrl || "",
    linkLabel: item.linkLabel || "",
    startsAt: item.status === "expired" ? "" : toInput(item.startsAt),
    endsAt: item.status === "expired" ? "" : toInput(item.endsAt),
  };
  document.getElementById("websiteAnnouncementMessage")?.focus();
}
async function load() {
  loading.value = true;
  error.value = "";
  try {
    const response = await apiService.getWebsiteAnnouncements();
    entries.value = response.data.entries;
    revision.value = response.data.revision;
    page.value = Math.min(page.value, pages.value);
  } catch (failure) {
    error.value = failure.message || "Unable to load announcements.";
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (saving.value) return;
  error.value = "";
  try {
    const payload = {
      ...form.value,
      message: form.value.message.trim(),
      startsAt:
        editing.value?.status === "active"
          ? editing.value.startsAt
          : toIso(form.value.startsAt),
      endsAt: toIso(form.value.endsAt),
      expectedRevision: revision.value,
      replaceConfirmed: false,
    };
    const active = currentEntries.value.find(
      (item) => item.status === "active" && item.id !== editing.value?.id,
    );
    const scheduled = currentEntries.value.find(
      (item) => item.status === "scheduled" && item.id !== editing.value?.id,
    );
    const publishing = !editing.value || editing.value.status === "expired";
    const changingStart =
      editing.value && payload.startsAt !== editing.value.startsAt;
    if ((publishing || changingStart) && (active || scheduled)) {
      const scheduledStart =
        payload.startsAt && Date.parse(payload.startsAt) > Date.now();
      const parts = [];
      if (active)
        parts.push(
          scheduledStart
            ? `The current announcement will expire when this announcement starts on ${dateLabel(payload.startsAt)}.`
            : "The current announcement will expire immediately.",
        );
      if (scheduled)
        parts.push(
          "The existing upcoming announcement will be expired and its schedule replaced.",
        );
      if (!payload.endsAt)
        parts.push("This announcement will have no end date.");
      const decision = await Swal.fire({
        icon: "warning",
        title: "Replace Announcement?",
        text: parts.join(" "),
        showCancelButton: true,
        confirmButtonText: "Confirm Replacement",
        confirmButtonColor: "#1a5f5f",
      });
      if (!decision.isConfirmed) return;
      payload.replaceConfirmed = true;
    } else if (editing.value?.status === "expired") {
      const decision = await Swal.fire({
        icon: "question",
        title: "Republish Announcement?",
        text: `${payload.startsAt ? `Starts ${dateLabel(payload.startsAt)}.` : "Starts immediately."} ${payload.endsAt ? `Ends ${dateLabel(payload.endsAt)}.` : "No end date; it stays visible until expired or replaced."}`,
        showCancelButton: true,
        confirmButtonText: "Republish",
        confirmButtonColor: "#1a5f5f",
      });
      if (!decision.isConfirmed) return;
    }
    saving.value = true;
    const response = await apiService.saveWebsiteAnnouncement(
      payload,
      editing.value?.id,
    );
    entries.value = response.data.entries;
    revision.value = response.data.revision;
    reset();
    await Swal.fire({
      icon: "success",
      title: "Announcement saved",
      toast: true,
      position: "top-end",
      timer: 1800,
      showConfirmButton: false,
    });
  } catch (failure) {
    error.value = failure.message || "Unable to save announcement.";
  } finally {
    saving.value = false;
  }
}
async function expire(item) {
  const decision = await Swal.fire({
    icon: "warning",
    title: "Expire Announcement?",
    text:
      item.status === "scheduled"
        ? "Cancel this upcoming announcement? The current announcement keeps its original end date."
        : "This announcement will stop appearing on the website.",
    showCancelButton: true,
    confirmButtonText: "Expire",
    confirmButtonColor: "#dc3545",
  });
  if (!decision.isConfirmed) return;
  saving.value = true;
  try {
    const response = await apiService.expireWebsiteAnnouncement(
      item.id,
      revision.value,
    );
    entries.value = response.data.entries;
    revision.value = response.data.revision;
    if (editing.value?.id === item.id) reset();
  } catch (failure) {
    error.value = failure.message || "Unable to expire announcement.";
  } finally {
    saving.value = false;
  }
}
let previousOverflow;
let previousFocus;
let clock;
const close = () => {
  if (!saving.value) emit("close");
};
const keydown = (event) => {
  if (Swal.isVisible()) return;
  if (event.key === "Escape") close();
  if (event.key !== "Tab") return;
  const controls = [
    ...dialog.value.querySelectorAll(
      "button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]",
    ),
  ];
  const first = controls[0],
    last = controls.at(-1);
  if (
    event.shiftKey &&
    (document.activeElement === first ||
      document.activeElement === dialog.value)
  ) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
};
onMounted(async () => {
  clock = setInterval(() => {
    now.value = Date.now();
  }, 15000);
  previousFocus = document.activeElement;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";
  document.addEventListener("keydown", keydown);
  await nextTick();
  dialog.value?.focus();
  load();
});
onBeforeUnmount(() => {
  clearInterval(clock);
  document.body.style.overflow = previousOverflow;
  document.removeEventListener("keydown", keydown);
  previousFocus?.focus();
});
</script>

<template>
  <Teleport to="body">
    <div class="modal-backdrop fade show"></div>
    <div
      ref="dialog"
      class="modal fade show d-block"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="websiteAnnouncementsTitle"
      @click.self="close"
    >
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        <div class="modal-content">
          <div class="modal-header">
            <h5 id="websiteAnnouncementsTitle" class="modal-title fw-bold">
              Website Announcements
            </h5>
            <button
              type="button"
              class="btn-close"
              aria-label="Close"
              :disabled="saving"
              @click="close"
            ></button>
          </div>
          <div class="modal-body">
            <div v-if="error" class="alert alert-danger" role="alert">
              {{ error }}
              <button
                type="button"
                class="btn btn-sm btn-outline-danger ms-2"
                :disabled="saving"
                @click="load"
              >
                Refresh
              </button>
            </div>
            <form
              v-if="canSend && (editing ? canEdit : canCreate)"
              class="border-bottom pb-4 mb-4"
              @submit.prevent="save"
            >
              <h6 class="fw-bold">
                {{
                  editing
                    ? editing.status === "expired"
                      ? "Republish Announcement"
                      : "Edit Announcement"
                    : "New Announcement"
                }}
              </h6>
              <div
                v-if="editing?.status === 'active' && editing.supersededAt"
                class="alert alert-info py-2"
              >
                The scheduled replacement takes over on
                {{ dateLabel(editing.supersededAt) }}.
              </div>
              <label class="form-label" for="websiteAnnouncementMessage"
                >Message</label
              >
              <textarea
                id="websiteAnnouncementMessage"
                v-model="form.message"
                class="form-control"
                rows="2"
                maxlength="240"
                required
                :disabled="saving"
              ></textarea>
              <div class="small text-muted text-end mt-1">
                {{ form.message.length }}/240
              </div>
              <div class="row g-3 mb-3">
                <div class="col-md-8">
                  <label for="websiteAnnouncementUrl" class="form-label"
                    >Link URL <span class="text-muted">(optional)</span></label
                  ><input
                    id="websiteAnnouncementUrl"
                    v-model="form.linkUrl"
                    class="form-control"
                    maxlength="500"
                    placeholder="/admissions or https://..."
                    :disabled="saving"
                  />
                </div>
                <div class="col-md-4">
                  <label for="websiteAnnouncementLabel" class="form-label"
                    >Link label</label
                  ><input
                    id="websiteAnnouncementLabel"
                    v-model="form.linkLabel"
                    class="form-control"
                    maxlength="50"
                    :required="Boolean(form.linkUrl.trim())"
                    :disabled="saving"
                    placeholder="Apply now"
                  />
                </div>
                <div class="col-md-6">
                  <label for="websiteAnnouncementStart" class="form-label"
                    >Show from <span class="text-muted">(optional)</span></label
                  ><input
                    id="websiteAnnouncementStart"
                    v-model="form.startsAt"
                    type="datetime-local"
                    class="form-control"
                    :disabled="saving || editing?.status === 'active'"
                  />
                  <div class="form-text">
                    {{
                      editing?.status === "active"
                        ? "Already published"
                        : "Leave empty to publish now"
                    }}. Africa/Lagos time.
                  </div>
                </div>
                <div class="col-md-6">
                  <label for="websiteAnnouncementEnd" class="form-label"
                    >Show until
                    <span class="text-muted">(optional)</span></label
                  ><input
                    id="websiteAnnouncementEnd"
                    v-model="form.endsAt"
                    type="datetime-local"
                    class="form-control"
                    :disabled="saving"
                  />
                  <div class="form-text">
                    Leave empty for no end date. Africa/Lagos time.
                  </div>
                </div>
              </div>
              <div class="d-flex gap-2">
                <button
                  class="btn btn-staff-primary"
                  type="submit"
                  :disabled="saving || loading"
                >
                  <span
                    v-if="saving"
                    class="spinner-border spinner-border-sm me-2"
                  ></span
                  ><i v-else class="bi bi-check-lg me-2"></i
                  >{{
                    editing
                      ? editing.status === "expired"
                        ? "Republish"
                        : "Save Changes"
                      : "Save Announcement"
                  }}</button
                ><button
                  v-if="editing"
                  type="button"
                  class="btn btn-outline-secondary"
                  :disabled="saving"
                  @click="reset"
                >
                  Cancel Edit
                </button>
              </div>
            </form>
            <div class="row g-2 mb-3">
              <div class="col-md-8">
                <input
                  v-model="search"
                  class="form-control"
                  aria-label="Search announcements"
                  placeholder="Search announcements..."
                />
              </div>
              <div class="col-md-4">
                <select
                  v-model="status"
                  class="form-select"
                  aria-label="Filter by status"
                >
                  <option value="">All statuses</option>
                  <option value="active">Active</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            </div>
            <div v-if="loading" class="text-center py-4" role="status">
              <span class="spinner-border spinner-border-sm me-2"></span
              >Loading...
            </div>
            <div v-else class="table-responsive">
              <table class="table align-middle">
                <thead>
                  <tr>
                    <th>Message</th>
                    <th>Link</th>
                    <th>Status</th>
                    <th>Show From</th>
                    <th>Show Until</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="!visibleEntries.length">
                    <td colspan="6" class="text-center text-muted py-4">
                      No announcements found.
                    </td>
                  </tr>
                  <tr v-for="item in visibleEntries" :key="item.id">
                    <td class="announcement-message">{{ item.message }}</td>
                    <td>
                      <a
                        v-if="item.linkUrl"
                        :href="
                          item.linkUrl.startsWith('/')
                            ? `https://alecons.edu.ng${item.linkUrl}`
                            : item.linkUrl
                        "
                        target="_blank"
                        rel="noopener noreferrer"
                        >{{ item.linkLabel }}</a
                      ><span v-else class="text-muted">None</span>
                    </td>
                    <td>
                      <span
                        class="badge text-capitalize"
                        :class="{
                          'text-bg-success': item.status === 'active',
                          'text-bg-primary': item.status === 'scheduled',
                          'text-bg-secondary': item.status === 'expired',
                        }"
                        >{{ item.status }}</span
                      >
                    </td>
                    <td>{{ dateLabel(item.startsAt) }}</td>
                    <td>{{ dateLabel(endDate(item)) }}</td>
                    <td class="text-end text-nowrap">
                      <button
                        v-if="canEdit && canSend"
                        type="button"
                        class="btn btn-sm btn-outline-secondary me-1"
                        :title="
                          item.status === 'expired' ? 'Republish' : 'Edit'
                        "
                        :aria-label="
                          item.status === 'expired'
                            ? 'Republish announcement'
                            : 'Edit announcement'
                        "
                        :disabled="saving"
                        @click="edit(item)"
                      >
                        <i
                          :class="
                            item.status === 'expired'
                              ? 'bi bi-arrow-repeat'
                              : 'bi bi-pencil'
                          "
                        ></i></button
                      ><button
                        v-if="canExpire && item.status !== 'expired'"
                        type="button"
                        class="btn btn-sm btn-outline-danger"
                        title="Expire"
                        aria-label="Expire announcement"
                        :disabled="saving"
                        @click="expire(item)"
                      >
                        <i class="bi bi-x-circle"></i>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <nav
              v-if="pages > 1"
              aria-label="Website announcements pagination"
              class="overflow-auto"
            >
              <ul
                class="pagination pagination-sm justify-content-center flex-nowrap mb-0"
              >
                <li
                  v-for="[label, target] in [
                    ['First', 1],
                    ['Prev', Math.max(1, page - 1)],
                  ]"
                  :key="label"
                  class="page-item"
                  :class="{ disabled: page === 1 }"
                >
                  <button
                    class="page-link"
                    type="button"
                    :disabled="page === 1"
                    @click="page = target"
                  >
                    {{ label }}
                  </button>
                </li>
                <li
                  v-for="number in pagination"
                  :key="number"
                  class="page-item"
                  :class="{
                    active: page === number,
                    disabled: typeof number !== 'number',
                  }"
                >
                  <button
                    v-if="typeof number === 'number'"
                    type="button"
                    class="page-link"
                    :aria-current="page === number ? 'page' : undefined"
                    @click="page = number"
                  >
                    {{ number }}</button
                  ><span v-else class="page-link" aria-hidden="true"
                    >&hellip;</span
                  >
                </li>
                <li
                  v-for="[label, target] in [
                    ['Next', Math.min(pages, page + 1)],
                    ['Last', pages],
                  ]"
                  :key="label"
                  class="page-item"
                  :class="{ disabled: page === pages }"
                >
                  <button
                    class="page-link"
                    type="button"
                    :disabled="page === pages"
                    @click="page = target"
                  >
                    {{ label }}
                  </button>
                </li>
              </ul>
            </nav>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-secondary"
              :disabled="saving"
              @click="close"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.announcement-message {
  min-width: 220px;
  max-width: 400px;
  overflow-wrap: anywhere;
}
td {
  font-size: 0.875rem;
}
</style>

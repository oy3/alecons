<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

const props = defineProps({
  api: { type: Object, required: true },
  accentColor: { type: String, default: "var(--acon-primary, #9e2a2b)" },
});

const notifications = ref([]);
const unreadCount = ref(0);
const isOpen = ref(false);
const isLoading = ref(false);
const error = ref("");
const selected = ref(null);
const nextCursor = ref(null);
const detailPanel = ref(null);
const root = ref(null);
let pollTimer = null;

const bellLabel = computed(() =>
  unreadCount.value
    ? `Notifications, ${unreadCount.value} unread`
    : "Notifications",
);

async function loadCount() {
  try {
    const response = await props.api.getNotificationUnreadCount();
    unreadCount.value = Number(response.data?.count || 0);
  } catch {
    /* The inbox remains usable when a background count refresh fails. */
  }
}

async function loadInbox(reset = true) {
  try {
    isLoading.value = true;
    error.value = "";
    const response = await props.api.getNotificationInbox({
      limit: 12,
      before: reset ? undefined : nextCursor.value,
    });
    if (response.success === false)
      throw new Error(response.error || "Could not load notifications");
    const incoming = response.data?.notifications || [];
    notifications.value = reset
      ? incoming
      : [...notifications.value, ...incoming];
    nextCursor.value = response.data?.nextCursor || null;
  } catch (requestError) {
    error.value = requestError?.message || "Could not load notifications";
  } finally {
    isLoading.value = false;
  }
}

async function toggle() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) await loadInbox(true);
}

async function openNotification(item) {
  if (!item.isRead) {
    try {
      const response = await props.api.markNotificationRead(item.id);
      if (response.success === false)
        throw new Error(
          response.error || "Could not mark notification as read",
        );
      item.isRead = true;
      item.readAt = response.data?.readAt || new Date().toISOString();
      unreadCount.value = Math.max(0, unreadCount.value - 1);
    } catch {
      /* Opening the content should not be blocked by a receipt update. */
    }
  }
  selected.value = item;
  isOpen.value = false;
  document.body.classList.add("notification-offcanvas-open");
  await nextTick();
  detailPanel.value?.focus();
}

async function markAllRead() {
  try {
    const response = await props.api.markAllNotificationsRead();
    if (response.success === false)
      throw new Error(response.error || "Could not update notifications");
    notifications.value = notifications.value.map((item) => ({
      ...item,
      isRead: true,
      readAt: item.readAt || new Date().toISOString(),
    }));
    unreadCount.value = 0;
  } catch (requestError) {
    error.value = requestError?.message || "Could not update notifications";
  }
}

function closeDetail() {
  selected.value = null;
  document.body.classList.remove("notification-offcanvas-open");
}

function outsideClick(event) {
  if (isOpen.value && root.value && !root.value.contains(event.target))
    isOpen.value = false;
}

function keydown(event) {
  if (event.key === "Escape")
    selected.value ? closeDetail() : (isOpen.value = false);
}

function parseDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatListDate(value) {
  const date = parseDate(value);
  if (!date) return "";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = new Intl.DateTimeFormat("en-NG", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);

  if (date.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (date.toDateString() === yesterday.toDateString())
    return `Yesterday, ${time}`;
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(date);
}

function formatDetailDate(value) {
  const date = parseDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-NG", { dateStyle: "long" }).format(date);
}

function icon(category) {
  return (
    {
      admissions: "bi-file-earmark-check",
      academic: "bi-mortarboard",
      payment: "bi-credit-card",
      system: "bi-gear",
      emergency: "bi-exclamation-triangle",
    }[category] || "bi-megaphone"
  );
}

onMounted(() => {
  loadCount();
  pollTimer = window.setInterval(() => {
    if (!document.hidden) loadCount();
  }, 60_000);
  document.addEventListener("click", outsideClick);
  document.addEventListener("keydown", keydown);
  window.addEventListener("focus", loadCount);
});

onBeforeUnmount(() => {
  window.clearInterval(pollTimer);
  document.removeEventListener("click", outsideClick);
  document.removeEventListener("keydown", keydown);
  window.removeEventListener("focus", loadCount);
  document.body.classList.remove("notification-offcanvas-open");
});
</script>

<template>
  <div
    ref="root"
    class="notification-center"
    :style="{ '--notification-accent': accentColor }"
  >
    <button
      class="notification-bell btn btn-link text-body p-2"
      type="button"
      :aria-label="bellLabel"
      :aria-expanded="isOpen"
      @click.stop="toggle"
    >
      <i class="bi bi-bell fs-5" aria-hidden="true"></i>
      <span v-if="unreadCount" class="notification-dot" aria-hidden="true"></span>
    </button>

    <div
      v-if="isOpen"
      class="notification-dropdown shadow"
      role="dialog"
      aria-label="Notifications"
    >
      <div
        class="notification-header d-flex align-items-center justify-content-between border-bottom"
      >
        <div>
          <h6 class="mb-0 fw-bold">Notifications</h6>
          <small class="text-muted">{{ unreadCount }} unread</small>
        </div>
        <button
          v-if="unreadCount"
          type="button"
          class="btn btn-sm btn-link text-decoration-none"
          @click="markAllRead"
        >
          Mark all read
        </button>
      </div>
      <div class="notification-list">
        <div v-if="isLoading" class="text-center py-5">
          <span
            class="spinner-border spinner-border-sm"
            aria-label="Loading"
          ></span>
        </div>
        <div v-else-if="error" class="text-center p-4">
          <i class="bi bi-wifi-off d-block fs-4 text-muted mb-2"></i>
          <div class="small text-muted mb-2">{{ error }}</div>
          <button
            class="btn btn-sm btn-outline-secondary"
            @click="loadInbox(true)"
          >
            Retry
          </button>
        </div>
        <div
          v-else-if="!notifications.length"
          class="text-center text-muted p-5"
        >
          <i class="bi bi-bell-slash d-block fs-3 mb-2"></i
          ><span class="small">No notifications yet</span>
        </div>
        <button
          v-for="item in notifications"
          v-else
          :key="item.id"
          type="button"
          class="notification-row w-100 border-0 border-bottom text-start"
          :class="{ unread: !item.isRead }"
          @click="openNotification(item)"
        >
          <span class="notification-icon flex-shrink-0"
            ><i class="bi" :class="icon(item.category)"></i
          ></span>
          <span class="min-w-0 flex-grow-1"
            ><span
              class="d-flex align-items-start justify-content-between gap-2"
              ><strong class="notification-title text-truncate">{{
                item.title
              }}</strong
              ><i
                v-if="item.isRead"
                class="bi bi-check2-all text-success"
                title="Read"
              ></i
              ><span v-else class="unread-dot" aria-label="Unread"></span></span
            ><span class="notification-preview text-muted">{{
              item.messageText
            }}</span
            ><small class="text-muted d-block mt-1">{{
              formatListDate(item.deliveredAt)
            }}</small></span
          >
        </button>
        <div v-if="!isLoading && nextCursor" class="text-center p-2">
          <button
            type="button"
            class="btn btn-sm btn-link text-decoration-none"
            @click="loadInbox(false)"
          >
            Load more
          </button>
        </div>
      </div>
    </div>
  </div>

  <Teleport to="body">
    <template v-if="selected">
      <div
        ref="detailPanel"
        class="notification-offcanvas offcanvas offcanvas-end show"
        :style="{ '--notification-accent': accentColor }"
        tabindex="-1"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notificationDetailTitle"
      >
        <div class="offcanvas-header border-bottom">
          <div>
            <div class="small text-uppercase text-muted fw-semibold">
              {{ selected.category }}
            </div>
            <h5 id="notificationDetailTitle" class="offcanvas-title fw-bold">
              {{ selected.title }}
            </h5>
          </div>
          <button
            type="button"
            class="btn-close"
            aria-label="Close"
            @click="closeDetail"
          ></button>
        </div>
        <div class="offcanvas-body">
          <div class="d-flex align-items-center gap-2 mb-4">
            <span
              v-if="selected.priority !== 'normal'"
              class="badge"
              :class="
                selected.priority === 'urgent'
                  ? 'text-bg-danger'
                  : 'text-bg-warning'
              "
              >{{ selected.priority }}</span
            ><span class="small text-muted">{{
              formatDetailDate(selected.deliveredAt)
            }}</span
            ><span class="ms-auto small text-success"
              ><i class="bi bi-check2-all me-1"></i>Read</span
            >
          </div>
          <div class="notification-message" v-html="selected.messageHtml"></div>
          <a
            v-if="selected.action?.url"
            class="btn notification-action mt-4"
            :href="selected.action.url"
            :target="
              selected.action.url.startsWith('http') ? '_blank' : undefined
            "
            :rel="
              selected.action.url.startsWith('http') ? 'noopener' : undefined
            "
            >{{ selected.action.label }}<i class="bi bi-arrow-right ms-2"></i
          ></a>
        </div>
      </div>
      <div
        class="offcanvas-backdrop fade show notification-backdrop"
        @click="closeDetail"
      ></div>
    </template>
  </Teleport>
</template>

<style scoped>
.notification-center {
  position: relative;
}
.notification-bell {
  position: relative;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  padding: 0 !important;
}
.notification-bell:hover,
.notification-bell:focus-visible {
  color: var(--notification-accent) !important;
}
.notification-center .notification-bell > .notification-dot {
  position: absolute;
  top: 9px;
  right: 9px;
  z-index: 1;
  width: 10px;
  height: 10px;
  border: 1px solid #fff;
  border-radius: 50%;
  background: #dc3545;
}
.notification-dropdown {
  position: absolute;
  z-index: 1060;
  top: calc(100% + 10px);
  right: 0;
  width: min(390px, calc(100vw - 24px));
  background: #fff;
  border: 1px solid #e9ecef;
  border-radius: 8px;
  overflow: hidden;
}
.notification-header {
  padding: 0.9rem 1rem;
}
.notification-list {
  max-height: min(430px, calc(100vh - 120px));
  overflow-y: auto;
  overscroll-behavior: contain;
}
.notification-row {
  display: flex;
  gap: 0.75rem;
  padding: 0.9rem 1rem;
  background: #fff;
}
.notification-row:hover {
  background: #f8f9fa;
}
.notification-row.unread {
  background: color-mix(in srgb, var(--notification-accent) 7%, white);
}
.notification-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: var(--notification-accent);
  background: color-mix(in srgb, var(--notification-accent) 10%, white);
}
.notification-title {
  display: block;
  max-width: 255px;
  color: #212529;
  font-size: 0.9rem;
}
.notification-preview {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 0.82rem;
  line-height: 1.35;
}
.unread-dot {
  flex: 0 0 auto;
  width: 8px;
  height: 8px;
  margin-top: 0.35rem;
  border-radius: 50%;
  background: var(--notification-accent);
}
.min-w-0 {
  min-width: 0;
}
.notification-offcanvas {
  visibility: visible;
  z-index: 1090;
  width: min(460px, 100vw);
}
.notification-backdrop {
  z-index: 1085;
}
.notification-message {
  line-height: 1.7;
  overflow-wrap: anywhere;
}
.notification-message :deep(img) {
  max-width: 100%;
  height: auto;
}
.notification-action {
  color: #fff;
  background: var(--notification-accent);
}
.notification-action:hover {
  color: #fff;
  filter: brightness(0.92);
}
@media (max-width: 575.98px) {
  .notification-dropdown {
    position: fixed;
    top: 64px;
    right: 8px;
    left: 8px;
    width: auto;
  }
  .notification-title {
    max-width: calc(100vw - 145px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .notification-offcanvas {
    transition: none;
  }
}
</style>

<style>
body.notification-offcanvas-open {
  overflow: hidden;
}
</style>

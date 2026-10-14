<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useRoute } from "vue-router";
import BrandLogo from "./BrandLogo.vue";
import { publicApiService } from "../services/publicApi";
import { applyUrl, navigation, portalLinks, whatsappUrl } from "../data/site";

const route = useRoute();
const menuOpen = ref(false);
const announcement = ref(null);
const dismissedVersion = ref("");
const announcementKey = computed(() =>
  announcement.value
    ? `${announcement.value.id}:${announcement.value.version}`
    : "",
);
const announcementVisible = computed(
  () => announcement.value && dismissedVersion.value !== announcementKey.value,
);
const announcementPaused = ref(false);
const announcementViewport = ref(null);
const announcementTrack = ref(null);
const announcementOverflows = ref(false);
let announcementRefreshTimer;
let announcementBoundaryTimer;
let announcementObserver;
let fetchingAnnouncement = false;
let headerUnmounted = false;
const scrolled = ref(false);
const overlayHeader = computed(
  () => route.meta.overlayHeader === true && !scrolled.value,
);
const drawer = ref(null);
const menuButton = ref(null);
let previousOverflow = "";

const focusable = () =>
  drawer.value?.querySelectorAll(
    'a, button:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ) || [];
const closeMenu = (restoreFocus = true) => {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  if (restoreFocus) nextTick(() => menuButton.value?.focus());
};
const handleKeydown = (event) => {
  if (!menuOpen.value) return;
  if (event.key === "Escape") return closeMenu();
  if (event.key !== "Tab") return;
  const items = [...focusable()];
  if (!items.length) return;
  const first = items[0];
  const last = items.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
};
const dismissAnnouncement = () => {
  dismissedVersion.value = announcementKey.value;
  try {
    sessionStorage.setItem(
      "alecons-announcement-dismissed-version",
      announcementKey.value,
    );
  } catch {}
};
const measureAnnouncement = () => {
  const overflow = Math.max(
    0,
    (announcementTrack.value?.scrollWidth || 0) -
      (announcementViewport.value?.clientWidth || 0),
  );
  announcementOverflows.value = overflow > 1;
  announcementTrack.value?.style.setProperty(
    "--announcement-overflow",
    `${overflow}px`,
  );
};
const refreshAnnouncement = async () => {
  if (fetchingAnnouncement || document.hidden) return;
  fetchingAnnouncement = true;
  try {
    const response = await publicApiService.getWebsiteAnnouncement();
    if (headerUnmounted) return;
    announcement.value = response.data;
    clearTimeout(announcementBoundaryTimer);
    const boundary = [response.data?.endsAt, response.data?.supersededAt]
      .filter(Boolean)
      .map(Date.parse)
      .sort((a, b) => a - b)[0];
    if (boundary)
      announcementBoundaryTimer = setTimeout(
        () => {
          announcement.value = null;
          refreshAnnouncement();
        },
        Math.max(1, Math.min(boundary - Date.now(), 2147483647)),
      );
  } catch {
    const boundary = [
      announcement.value?.endsAt,
      announcement.value?.supersededAt,
    ]
      .filter(Boolean)
      .map(Date.parse)
      .sort((a, b) => a - b)[0];
    if (boundary && boundary <= Date.now()) announcement.value = null;
  } finally {
    fetchingAnnouncement = false;
  }
};
watch(announcementVisible, async () => {
  await nextTick();
  announcementObserver?.disconnect();
  if (announcementViewport.value)
    announcementObserver?.observe(announcementViewport.value);
  measureAnnouncement();
});
watch(announcement, async () => {
  await nextTick();
  measureAnnouncement();
});
const onScroll = () => {
  scrolled.value = window.scrollY > 20;
};

watch(menuOpen, async (open) => {
  if (open) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    await nextTick();
    focusable()[0]?.focus();
  } else document.body.style.overflow = previousOverflow;
});
watch(
  () => route.fullPath,
  () => closeMenu(false),
);

onMounted(() => {
  try {
    dismissedVersion.value =
      sessionStorage.getItem("alecons-announcement-dismissed-version") || "";
  } catch {}
  if (typeof ResizeObserver !== "undefined")
    announcementObserver = new ResizeObserver(measureAnnouncement);
  refreshAnnouncement();
  announcementRefreshTimer = setInterval(refreshAnnouncement, 60000);
  document.addEventListener("visibilitychange", refreshAnnouncement);
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("keydown", handleKeydown);
  onScroll();
});
onBeforeUnmount(() => {
  headerUnmounted = true;
  clearInterval(announcementRefreshTimer);
  clearTimeout(announcementBoundaryTimer);
  announcementObserver?.disconnect();
  document.removeEventListener("visibilitychange", refreshAnnouncement);
  window.removeEventListener("scroll", onScroll);
  document.removeEventListener("keydown", handleKeydown);
  document.body.style.overflow = previousOverflow;
});
</script>

<template>
  <div
    v-if="announcementVisible"
    class="announcement"
    role="region"
    aria-label="Website announcement"
  >
    <div class="site-container announcement__inner">
      <div ref="announcementViewport" class="announcement__viewport">
        <div
          ref="announcementTrack"
          class="announcement__track"
          :class="{
            'announcement__track--scrolling': announcementOverflows,
            'announcement__track--paused': announcementPaused,
          }"
        >
          <span
            ><i class="bi bi-circle-fill" aria-hidden="true"></i
            >{{ announcement.message }}</span
          >
          <a
            v-if="announcement.linkUrl"
            :href="announcement.linkUrl"
            target="_blank"
            rel="noopener noreferrer"
            data-umami-event="announcement-click"
            >{{ announcement.linkLabel }}
            <i class="bi bi-chevron-right" aria-hidden="true"></i
          ></a>
        </div>
      </div>
      <button
        v-if="announcementOverflows"
        type="button"
        class="announcement__pause"
        :aria-label="
          announcementPaused ? 'Resume announcement' : 'Pause announcement'
        "
        :title="announcementPaused ? 'Resume' : 'Pause'"
        :aria-pressed="announcementPaused"
        @click="announcementPaused = !announcementPaused"
      >
        <i
          :class="announcementPaused ? 'bi bi-play-fill' : 'bi bi-pause-fill'"
          aria-hidden="true"
        ></i>
      </button>
      <button
        type="button"
        aria-label="Dismiss announcement"
        @click="dismissAnnouncement"
      >
        <i class="bi bi-x-lg" aria-hidden="true"></i>
      </button>
    </div>
  </div>

  <header
    class="site-header"
    :class="{
      'site-header--overlay': overlayHeader,
      'site-header--scrolled': scrolled,
    }"
  >
    <div class="site-header__nav">
      <div class="site-container nav-shell">
        <RouterLink to="/" class="brand-link" aria-label="ALECONS home">
          <BrandLogo compact :inverse="overlayHeader" />
        </RouterLink>
        <nav class="desktop-nav" aria-label="Primary navigation">
          <RouterLink
            v-for="item in navigation.filter((link) => !link.footerOnly)"
            :key="item.to"
            :to="item.to"
          >
            {{ item.label }}
          </RouterLink>
          <details class="portal-menu">
            <summary>
              Portal <i class="bi bi-chevron-down" aria-hidden="true"></i>
            </summary>
            <div class="portal-menu__panel">
              <a
                v-for="portal in portalLinks"
                :key="portal.label"
                :href="portal.href"
                target="_blank"
                rel="noopener noreferrer"
                data-umami-event="portal-click"
              >
                {{ portal.label }}
                <i class="bi bi-box-arrow-up-right" aria-hidden="true"></i>
              </a>
            </div>
          </details>
        </nav>
        <div class="nav-actions">
          <a
            :href="applyUrl"
            class="button btn-sm button--primary nav-apply py-0"
            target="_blank"
            rel="noopener noreferrer"
            data-umami-event="apply-click"
          >
            Apply Now
          </a>
          <a
            :href="whatsappUrl"
            class="button btn-sm button--whatsapp nav-whatsapp"
            target="_blank"
            rel="noopener noreferrer"
            data-umami-event="whatsapp-click"
          >
            <i class="bi bi-whatsapp" aria-hidden="true"></i>
            Chat on WhatsApp
          </a>
        </div>
        <button
          ref="menuButton"
          type="button"
          class="menu-toggle"
          aria-controls="mobile-navigation"
          :aria-expanded="menuOpen"
          :aria-label="menuOpen ? 'Close menu' : 'Open menu'"
          @click="menuOpen = !menuOpen"
        >
          <i
            :class="menuOpen ? 'bi bi-x-lg' : 'bi bi-list'"
            aria-hidden="true"
          ></i>
        </button>
      </div>
    </div>
  </header>

  <Transition name="drawer">
    <div v-if="menuOpen" class="mobile-overlay" @mousedown.self="closeMenu">
      <aside
        id="mobile-navigation"
        ref="drawer"
        class="mobile-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
      >
        <div class="mobile-drawer__header">
          <BrandLogo compact />
          <button type="button" aria-label="Close menu" @click="closeMenu">
            <i class="bi bi-x-lg" aria-hidden="true"></i>
          </button>
        </div>
        <nav aria-label="Mobile navigation">
          <RouterLink
            v-for="item in navigation.filter((link) => !link.footerOnly)"
            :key="item.to"
            :to="item.to"
          >
            {{ item.label }}
            <i class="bi bi-chevron-right" aria-hidden="true"></i>
          </RouterLink>
          <p>Portals</p>
          <a
            v-for="portal in portalLinks"
            :key="portal.label"
            :href="portal.href"
            target="_blank"
            rel="noopener noreferrer"
            data-umami-event="portal-click"
            >{{ portal.label
            }}<i class="bi bi-box-arrow-up-right" aria-hidden="true"></i
          ></a>
        </nav>
        <a
          :href="applyUrl"
          class="button button--primary mobile-drawer__apply"
          target="_blank"
          rel="noopener noreferrer"
          data-umami-event="apply-click"
        >
          Apply Now
        </a>
        <a
          :href="whatsappUrl"
          class="button button--whatsapp mobile-drawer__whatsapp"
          target="_blank"
          rel="noopener noreferrer"
          data-umami-event="whatsapp-click"
        >
          <i class="bi bi-whatsapp" aria-hidden="true"></i>
          Chat on WhatsApp
        </a>
      </aside>
    </div>
  </Transition>
</template>

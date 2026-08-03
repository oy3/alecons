<script setup>
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import Swal from "sweetalert2";
import BrandLogo from "./BrandLogo.vue";
import { useAuthStore } from "../stores/auth.js";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const application = computed(() =>
  authStore.getApplicationFromList(route.params.id),
);
const profileImageUrl = computed(
  () =>
    authStore.user?.profileImageUrl ||
    application.value?.profileImageUrl ||
    "https://placehold.co/40?text=IMG",
);

const CONTACT_URL = import.meta.env.VITE_APP_SITE_URL
  ? `${import.meta.env.VITE_APP_SITE_URL}/contact`
  : null;

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
  await router.push({ name: "Login" });
  authStore.completeLogout();
}
</script>

<template>
  <header
    class="account-header px-4 py-3 d-flex align-items-center justify-content-between"
  >
    <BrandLogo />
    <div class="dropdown">
      <a
        href="#"
        class="d-flex align-items-center text-decoration-none dropdown-toggle text-dark"
        id="accountHeaderUser"
        data-bs-toggle="dropdown"
        aria-expanded="false"
      >
        <div class="d-flex flex-column align-items-end me-2">
          <span
            class="text-dark fw-bold d-none d-md-inline text-capitalize small"
            >{{ authStore.user?.firstName }}
            {{ authStore.user?.lastName }}</span
          >
          <span class="text-muted small d-none d-md-inline text-capitalize">{{
            authStore.user?.role
          }}</span>
        </div>
        <img
          :src="profileImageUrl"
          width="40"
          height="40"
          alt="Profile"
          class="rounded-circle border border-secondary object-fit-cover"
        />
      </a>
      <ul
        class="dropdown-menu dropdown-menu-end"
        aria-labelledby="accountHeaderUser"
      >
        <li class="dropdown-item-text d-flex align-items-center gap-2">
          <img
            :src="profileImageUrl"
            width="40"
            height="40"
            alt="Profile"
            class="rounded-circle border border-secondary object-fit-cover"
          />
          <div class="d-flex flex-column align-items-start">
            <span class="text-dark fw-bold text-capitalize small"
              >{{ authStore.user?.firstName }}
              {{ authStore.user?.lastName }}</span
            >
            <span class="small text-muted">{{ authStore.user?.email }}</span>
          </div>
        </li>
        <li><hr class="dropdown-divider" /></li>
        <li class="dropdown-item small">
          <router-link
            to="/my-applications"
            class="text-muted text-decoration-none"
            ><i class="bi bi-grid me-3"></i>My Applications</router-link
          >
        </li>
        <li class="dropdown-item small">
          <router-link to="/settings" class="text-muted text-decoration-none">
            <i class="bi bi-person me-3"></i>Account Settings
          </router-link>
        </li>
        <li class="dropdown-item small">
          <a
            :href="CONTACT_URL"
            target="_blank"
            rel="noopener"
            class="text-muted text-decoration-none"
          >
            <i class="bi bi-question-circle me-3"></i>Need help?
          </a>
        </li>
        <li class="dropdown-item small">
          <a
            href="#"
            class="text-danger text-decoration-none"
            @click.prevent="logout"
            ><i class="bi bi-box-arrow-right me-3"></i>Log out</a
          >
        </li>
      </ul>
    </div>
  </header>
</template>

<style scoped>
.account-header {
  background: #fff;
  border-bottom: 1px solid #e9ecef;
  position: sticky;
  top: 0;
  z-index: 100;
}
</style>

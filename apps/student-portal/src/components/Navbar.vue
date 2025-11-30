<script lang="js">
import { useAuthStore } from '../stores/auth.js';
import { useRouter } from 'vue-router';
import Swal from 'sweetalert2';

export default {
  name: "Navbar",
  setup() {
    const auth = useAuthStore();
    const router = useRouter();

    const logout = async () => {
      const result = await Swal.fire({
        title: 'Are you sure?',
        text: 'You will be logged out of the student portal.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, logout'
      });

      if (result.isConfirmed) {
        await auth.logout();
        router.push({ name: 'Login' });

        Swal.fire({
          toast: true,
          position: "top-end",
          icon: "success",
          title: "Logged out successfully.",
          showConfirmButton: false,
          timer: 2000,
        });
      }
    };

    const showNotifications = () => {
      Swal.fire({
        icon: 'info',
        title: 'Coming Soon',
        text: 'Notifications feature will be available soon.',
        confirmButtonText: 'OK'
      });
    };

    const showMessages = () => {
      Swal.fire({
        icon: 'info',
        title: 'Coming Soon',
        text: 'Messages feature will be available soon.',
        confirmButtonText: 'OK'
      });
    };

    return {
      auth,
      logout,
      showNotifications,
      showMessages
    };
  }
};
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-light bg-white px-3 shadow-sm">
    <div class="w-100 p-0 d-flex align-items-center justify-content-between">
      <!-- Mobile Sidebar Toggle -->
      <button
        class="btn d-md-none me-2"
        data-bs-toggle="offcanvas"
        data-bs-target="#mobileSidebar"
        aria-controls="mobileSidebar"
      >
        <i class="bi bi-list fs-4"></i>
      </button>

      <!-- Search + Right Icons -->
      <div class="d-flex align-items-center flex-grow-1 flex-md-grow-0 w-100">
        <!-- Search -->
        <form class="d-flex me-3 flex-grow-1 flex-md-grow-0 w-100 custom-search-width">
          <div class="input-group">
            <input
              type="text"
              class="form-control border-0 bg-light"
              placeholder="Search resources, courses..."
            />
            <span class="input-group-text border-0 bg-light">
              <i class="bi bi-search text-muted"></i>
            </span>
          </div>
        </form>

        <!-- Right Icons -->
        <div class="d-flex align-items-center ms-auto">
          <!-- Notifications -->
          <div class="position-relative me-3">
            <i class="bi bi-bell fs-5 text-muted cursor-pointer" @click="showNotifications"></i>
            <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger small">
              0
            </span>
          </div>

          <!-- Messages -->
          <div class="position-relative me-3 d-none d-sm-block">
            <i class="bi bi-chat-dots fs-5 text-muted cursor-pointer" @click="showMessages"></i>
          </div>

          <!-- User Profile -->
          <div class="d-flex align-items-center">
            <img
              :src="auth.profileImageUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(auth.userName) + '&background=2d7d7d&color=fff'"
              width="40"
              height="40"
              alt="Profile"
              class="rounded-circle me-2 border border-2 border-primary"
            />
            <div class="d-none d-lg-block">
              <div class="fw-bold text-dark small">{{ auth.userName }}</div>
              <div class="text-muted small">Student</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.cursor-pointer {
  cursor: pointer;
}

.custom-search-width {
  max-width: 400px;
}

@media (max-width: 768px) {
  .custom-search-width {
    max-width: none;
  }
}
</style>
<script lang="js">
import { useAuth, authManager } from '../services/auth.js';
import { useRouter } from 'vue-router';
import Swal from 'sweetalert2';

export default {
  name: "Navbar",
  setup() {
    const { user, isAuthenticated } = useAuth();
    const router = useRouter();

    const logout = () => {

      Swal.fire({
        title: 'Are you sure?',
        text: 'You will be logged out of the application.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, logout'
      }).then((result) => {
        if (result.isConfirmed) {
          authManager.clearAuth();
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
      });
    };

    return {
      user,
      isAuthenticated,
      logout
    };
  }
};
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-light bg-white px-3">
    <div class="w-100 p-0 d-flex align-items-center justify-content-between">
      <!-- Mobile Sidebar Toggle -->
      <button class="btn d-md-none me-2" data-bs-toggle="offcanvas" data-bs-target="#mobileSidebar">
        <i class="bi bi-list"></i>
      </button>

      <!-- Search + Right Icons -->
      <div class="d-flex align-items-center flex-grow-1 flex-md-grow-0 w-100">
        <!-- Search -->
        <form class="d-flex me-3 flex-grow-1 flex-md-grow-0 w-100 custom-search-width">
          <div class="input-group">
            <input type="text" class="form-control border-0 bg-light" placeholder="What do you need?" />
            <span class="input-group-text border-0">
              <i class="bi bi-search text-muted"></i>
            </span>
          </div>
        </form>

        <!-- Right Icons -->
        <div class="d-flex align-items-center ms-auto">
          <i class="bi bi-bell fs-5 me-3"></i>

          <!-- User Profile Dropdown -->
          <!-- <div class="dropdown">
            <a href="#" class="d-flex align-items-center text-decoration-none dropdown-toggle text-dark" id="userDropdown"
              data-bs-toggle="dropdown" aria-expanded="false"> -->
              <img src="https://placehold.co/40?text=IMG" width="40" alt="Profile"
                class="rounded-circle me-2 border border-secondary" />
              <span class="fw-bold d-none d-sm-inline">{{ user?.firstName || 'User' }}</span>
            <!-- </a>

            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
              <li>
                <h6 class="dropdown-header">{{ user?.fullName || 'User' }}</h6>
              </li>
              <li>
                <span class="dropdown-item-text small text-muted">{{ user?.email }}</span>
              </li>
              <li>
                <hr class="dropdown-divider">
              </li>
              <li>
                <router-link to="/settings" class="dropdown-item">
                  <i class="bi bi-gear me-2"></i>Settings
                </router-link>
              </li>
              <li>
                <a href="#" @click.prevent="logout" class="dropdown-item text-danger">
                  <i class="bi bi-box-arrow-right me-2"></i>Logout
                </a>
              </li>
            </ul>
          </div> -->
        </div>
      </div>
    </div>
  </nav>
</template>

<style scoped>
/* Large screen: limit search bar width */
@media (min-width: 992px) {
  .custom-search-width {
    width: 350px !important;
  }
}

/* Small screen: make search full width */
@media (max-width: 991px) {
  .custom-search-width {
    width: 100% !important;
  }
}
</style>

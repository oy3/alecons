x<script lang="js">
import BrandLogo from "./BrandLogo.vue";
import { useAuthStore } from "../stores/auth.js";
import { useRouter } from 'vue-router';
import { onMounted } from 'vue';
import { logger } from '@shared/utils/logger';
import Swal from "sweetalert2";

export default {
  name: "MobileSidebar",
  components: { BrandLogo },
  setup() {
    const auth = useAuthStore();
    const router = useRouter();

    const logout = async () => {
      const result = await Swal.fire({
        title: "Are you sure?",
        text: "You will be logged out of the student portal.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, logout",
      });

      if (result.isConfirmed) {
        await auth.logout();
        router.push({ name: "Login" });

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

    const closeOffcanvas = () => {
      // Use setTimeout to ensure navigation completes first
      setTimeout(() => {
        try {
          const offcanvasElement = document.getElementById('mobileSidebar');
          if (offcanvasElement) {
            // Try to get existing instance first
            let offcanvas = window.bootstrap?.Offcanvas?.getInstance(offcanvasElement);
            
            // If no instance exists, create one
            if (!offcanvas && window.bootstrap?.Offcanvas) {
              offcanvas = new window.bootstrap.Offcanvas(offcanvasElement);
            }
            
            // Hide the offcanvas
            if (offcanvas) {
              offcanvas.hide();
            } else {
              // Fallback: manually trigger Bootstrap's dismiss
              const closeButton = offcanvasElement.querySelector('[data-bs-dismiss="offcanvas"]');
              if (closeButton) {
                closeButton.click();
              }
            }
          }
        } catch (error) {
          logger.error('Error closing mobile sidebar:', error);
          // Fallback: try to close via CSS class manipulation
          const offcanvasElement = document.getElementById('mobileSidebar');
          if (offcanvasElement) {
            offcanvasElement.classList.remove('show');
            document.body.classList.remove('offcanvas-open');
            const backdrop = document.querySelector('.offcanvas-backdrop');
            if (backdrop) {
              backdrop.remove();
            }
          }
        }
      }, 100); // Small delay to ensure navigation completes
    };

    // Set up router navigation listener to auto-close sidebar
    onMounted(() => {
      router.afterEach(() => {
        // Auto-close sidebar after any route change
        closeOffcanvas();
      });
    });

    return {
      auth,
      logout,
      closeOffcanvas
    };
  }
};
</script>

<template>
  <!-- Mobile Offcanvas Sidebar -->
  <div
    class="offcanvas offcanvas-start acon-bg-dark text-white"
    tabindex="-1"
    id="mobileSidebar"
    aria-labelledby="mobileSidebarLabel"
  >
    <div class="offcanvas-header border-bottom border-light-subtle">
      <div class="w-100">
        <BrandLogo />
      </div>
      <button
        type="button"
        class="btn-close btn-close-white"
        data-bs-dismiss="offcanvas"
        aria-label="Close"
      ></button>
    </div>
    
    <div class="offcanvas-body p-0">
      <nav class="nav flex-column p-3">
        <!-- User Info -->
        <div class="d-flex align-items-center mb-4 p-3 bg-dark bg-opacity-50 rounded">
          <img
            :src="auth.user?.profileImageUrl || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(auth.userName) + '&background=2d7d7d&color=fff'"
            width="50"
            height="50"
            alt="Profile"
            class="rounded-circle me-3"
          />
          <div>
            <div class="fw-bold">{{ auth.userName }}</div>
            <div class="text-light small">Student</div>
            <div class="text-info small">{{ auth.userEmail }}</div>
          </div>
        </div>

        <!-- Navigation Links -->
        <router-link
          to="/dashboard"
          class="nav-link text-white py-3 acon-mobile-link rounded mb-2"
          active-class="active"
          @click="closeOffcanvas"
        >
          <i class="bi bi-house-door h5 me-3 mb-0"></i> 
          <span>Dashboard</span>
        </router-link>
        
        <router-link
          to="/academics"
          class="nav-link text-white py-3 acon-mobile-link rounded mb-2"
          active-class="active"
          @click="closeOffcanvas"
        >
          <i class="bi bi-book h5 me-3 mb-0"></i> 
          <span>Academics</span>
        </router-link>
        
        <router-link
          to="/resources"
          class="nav-link text-white py-3 acon-mobile-link rounded mb-2"
          active-class="active"
          @click="closeOffcanvas"
        >
          <i class="bi bi-collection h5 me-3 mb-0"></i> 
          <span>Resources</span>
        </router-link>
        
        <router-link
          to="/finance"
          class="nav-link text-white py-3 acon-mobile-link rounded mb-2"
          active-class="active"
          @click="closeOffcanvas"
        >
          <i class="bi bi-credit-card h5 me-3 mb-0"></i> 
          <span>Finance</span>
        </router-link>
        
        <router-link
          to="/tenancy-agreement"
          class="nav-link text-white py-3 acon-mobile-link rounded mb-2"
          active-class="active"
          @click="closeOffcanvas"
        >
          <i class="bi bi-file-text h5 me-3 mb-0"></i> 
          <span>Tenancy Agreement</span>
        </router-link>
        
        <router-link
          to="/settings"
          class="nav-link text-white py-3 acon-mobile-link rounded mb-2"
          active-class="active"
          @click="closeOffcanvas"
        >
          <i class="bi bi-gear h5 me-3 mb-0"></i> 
          <span>Settings</span>
        </router-link>

        <hr class="border-light my-4">

        <!-- Logout -->
        <button
          @click="logout"
          class="nav-link text-white py-3 acon-mobile-link rounded btn btn-link text-decoration-none text-start w-100"
        >
          <i class="bi bi-box-arrow-right h5 me-3 mb-0"></i> 
          <span>Logout</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>

.acon-mobile-link {
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
}

.acon-mobile-link:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: translateX(5px);
}

.acon-mobile-link.active {
  background-color: rgba(255, 255, 255, 0.2);
  font-weight: 600;
}

/* Button specific styles for logout */
.btn-link.acon-mobile-link {
  border: none;
  background: none;
  color: white !important;
  text-decoration: none !important;
}

.btn-link.acon-mobile-link:hover {
  background-color: rgba(220, 53, 69, 0.2);
  color: #ff6b6b !important;
}
</style>
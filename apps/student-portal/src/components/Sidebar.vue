<script lang="js">
import BrandLogo from "./BrandLogo.vue";
import { useAuthStore } from "../stores/auth.js";
import { useRouter } from 'vue-router';
import Swal from "sweetalert2";

export default {
  name: "Sidebar",
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

    return {
      auth,
      logout
    };
  }
};
</script>

<template>
  <aside class="sidebar d-none d-md-flex flex-column acon-bg-dark rounded-start-0 nav-custom-rounded text-white p-3">
    <div class="text-center my-4">
      <BrandLogo />
    </div>
    
    <nav class="nav flex-column flex-grow-1">
      <!-- Main Navigation -->
      <router-link
        to="/dashboard"
        class="nav-link text-white py-3 acon-link rounded mb-1"
        active-class="active"
      >
        <i class="bi bi-house-door h5 me-2 mb-0"></i> 
        <span>Dashboard</span>
      </router-link>
      
      <router-link
        to="/academics"
        class="nav-link text-white py-3 acon-link rounded mb-1"
        active-class="active"
      >
        <i class="bi bi-book h5 me-2 mb-0"></i> 
        <span>Academics</span>
      </router-link>
      
      <router-link
        to="/resources"
        class="nav-link text-white py-3 acon-link rounded mb-1"
        active-class="active"
      >
        <i class="bi bi-collection h5 me-2 mb-0"></i> 
        <span>Resources</span>
      </router-link>
      
      <router-link
        to="/finance"
        class="nav-link text-white py-3 acon-link rounded mb-1"
        active-class="active"
      >
        <i class="bi bi-credit-card h5 me-2 mb-0"></i> 
        <span>Finance</span>
      </router-link>
      
      <router-link
        to="/tenancy-agreement"
        class="nav-link text-white py-3 acon-link rounded mb-1"
        active-class="active"
      >
        <i class="bi bi-file-text h5 me-2 mb-0"></i> 
        <span>Tenancy Agreement</span>
      </router-link>
      
      <router-link
        to="/settings"
        class="nav-link text-white py-3 acon-link rounded mb-1"
        active-class="active"
      >
        <i class="bi bi-gear h5 me-2 mb-0"></i> 
        <span>Settings</span>
      </router-link>

      <!-- Spacer -->
      <div class="flex-grow-1"></div>

      <!-- Logout at bottom -->
      <button
        @click="logout"
        class="nav-link text-white py-3 acon-link rounded mb-1 btn btn-link text-decoration-none text-start"
      >
        <i class="bi bi-box-arrow-right h5 me-2 mb-0"></i> 
        <span>Logout</span>
      </button>
    </nav>
  </aside>
</template>

<style scoped>
.nav-custom-rounded {
  border-radius: 20px 0 0 20px;
}

.sidebar {
  width: 250px;
  min-width: 250px;
  max-width: 250px;
  height: 100vh;
  position: sticky;
  top: 0;
}

.acon-link {
  transition: all 0.3s ease;
  display: flex;
  align-items: center;
}

.acon-link:hover {
  background-color: rgba(255, 255, 255, 0.1);
  transform: translateX(5px);
}

.acon-link.active {
  background-color: rgba(255, 255, 255, 0.2);
  font-weight: 600;
}

/* Button specific styles for logout */
.btn-link.acon-link {
  border: none;
  background: none;
  color: white !important;
  text-decoration: none !important;
  width: 100%;
}

.btn-link.acon-link:hover {
  background-color: rgba(220, 53, 69, 0.2);
  color: #ff6b6b !important;
}
</style>
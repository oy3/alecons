<script lang="js">
import BrandLogo from '../../components/BrandLogo.vue';
import { apiService } from '../../services/api.js';
import { authManager } from '../../services/auth.js';
import { logger } from '@shared/utils/logger';
import Swal from 'sweetalert2';

export default {
  name: "Registration",
  components: { BrandLogo },
  data() {
    return {
      formData: {
        firstName: '',
        otherName: '',
        lastName: '',
        email: '',
        confirmEmail: '',
        phone: '',
        dateOfBirth: '',
        gender: '',
        programTypeId: '',
        programModeId: '',
        programId: '',
        password: '',
        confirmPassword: '',
      },
      programTypes: [],
      programModes: [],
      programs: [],
      isLoading: false,
      isLoadingData: false,
    };
  },
  async mounted() {
    await this.loadInitialData();
  },
  methods: {
    async loadInitialData() {
      try {
        this.isLoadingData = true;
        
        // Load all data in parallel
        const [programTypesResult, programModesResult, programsResult] = await Promise.all([
          apiService.getProgramTypes(),
          apiService.getProgramModes(),
          apiService.getPrograms()
        ]);

        if (programTypesResult.success) {
          this.programTypes = programTypesResult.data;
        } else {
          logger.error("Failed to load program types:", programTypesResult);
        }

        if (programModesResult.success) {
          this.programModes = programModesResult.data;
        } else {
          logger.error("Failed to load program modes:", programModesResult);
        }

        if (programsResult.success) {
          this.programs = programsResult.data;
        } else {
          logger.error("Failed to load programs:", programsResult);
        }

        logger.info("All data loaded - Arrays:", {
          programTypes: this.programTypes,
          programModes: this.programModes, 
          programs: this.programs
        });
      } catch (error) {
        logger.error('Error loading initial data:', error);
        Swal.fire({
          icon: 'error',
          title: 'Loading Error',
          text: 'Failed to load program data. Please refresh the page.',
          confirmButtonColor: '#2d7d7d',
        });
      } finally {
        this.isLoadingData = false;
      }
    },

    async onSubmit() {
      try {
        // Validate form
        if (!this.validateForm()) {
          return;
        }

        this.isLoading = true;

        // Show loading state
        Swal.fire({
          title: 'Creating Account...',
          html: 'Please wait',
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        // Call backend API
        const result = await apiService.register({
          firstName: this.formData.firstName,
          otherName: this.formData.otherName,
          lastName: this.formData.lastName,
          email: this.formData.email,
          phone: this.formData.phone,
          dateOfBirth: this.formData.dateOfBirth,
          gender: this.formData.gender,
          programTypeId: this.formData.programTypeId,
          programModeId: this.formData.programModeId,
          programId: this.formData.programId,
          password: this.formData.password,
        });

        if (result.success) {
          logger.info('Registration successful:', result.data.user);

          // Create application object for consistency with login response
          const applicationData = {
            id: result.data.applicationId,
            applicationNumber: result.data.applicationNumber,
            currentStage: 1,
            status: 'pending'
          };

          // Set authentication using auth manager
          authManager.setAuth(
            result.data.user,
            result.data.access_token,
            applicationData
          );

          // Success message
          await Swal.fire({
            icon: 'success',
            title: 'Account Created!',
            text: `Welcome to Alecons, ${result.data.user.firstName}! Your application number is ${result.data.applicationNumber}`,
            confirmButtonColor: '#2d7d7d',
          });

          // Redirect to dashboard
          this.$router.push({ name: 'Dashboard' });
        } else {
          // Handle API errors
          await Swal.fire({
            icon: 'error',
            title: 'Registration Failed',
            text: result.error || 'Please check your information and try again',
            confirmButtonColor: '#2d7d7d',
          });
        }
      } catch (error) {
        logger.error('Registration error:', error);

        await Swal.fire({
          icon: 'error',
          title: 'Oops...',
          text: 'Something went wrong! Please try again.',
          confirmButtonColor: '#2d7d7d',
        });
      } finally {
        this.isLoading = false;
      }
    },

    validateForm() {
      const {
        firstName,
        lastName,
        email,
        confirmEmail,
        phone,
        dateOfBirth,
        gender,
        programTypeId,
        programModeId,
        programId,
        password,
        confirmPassword
      } = this.formData;

      // Check required fields
      if (!firstName || !lastName || !email || !phone || !dateOfBirth ||
        !gender || !programTypeId || !programModeId || !programId || !password) {
        Swal.fire({
          icon: 'warning',
          title: 'Missing Information',
          text: 'Please fill in all required fields',
          confirmButtonColor: '#2d7d7d',
        });
        return false;
      }

      // Email validation
      if (email !== confirmEmail) {
        Swal.fire({
          icon: 'warning',
          title: 'Email Mismatch',
          text: 'Email addresses do not match',
          confirmButtonColor: '#2d7d7d',
        });
        return false;
      }

      // Password validation
      if (password !== confirmPassword) {
        Swal.fire({
          icon: 'warning',
          title: 'Password Mismatch',
          text: 'Passwords do not match',
          confirmButtonColor: '#2d7d7d',
        });
        return false;
      }

      if (password.length < 6) {
        Swal.fire({
          icon: 'warning',
          title: 'Weak Password',
          text: 'Password must be at least 6 characters long',
          confirmButtonColor: '#2d7d7d',
        });
        return false;
      }

      return true;
    },
  },
};
</script>

<template>
  <div class="container-fluid vh-100">
    <nav class="navbar navbar-light bg-transparent w-100 px-4 navbar-expand-md fixed-top position-absolute"
      style="z-index: 1030">
      <BrandLogo class="navbar-brand" />
    </nav>

    <div class="row h-100">
      <div class="col-md-5 d-none d-md-block px-0">
        <img src="../../assets/stethoscope.png" class="img-fluid vh-100 w-100 object-fit-cover" alt="" />
      </div>

      <div class="col-md-7 p-5 d-flex align-items-center justify-content-center form-container text-white text-md-dark">
        <div class="mt-md-0 mt-5 pt-5 pt-md-0">
          <h2 class="mb-4">Registration</h2>
          <form @submit.prevent="onSubmit" class="mb-5">
            <div class="row g-3">

              <div class="col-sm-4">
                <label for="programType">Program Type <span class="text-danger">*</span></label>
                <select id="programType" v-model="formData.programTypeId" class="form-select" required :disabled="isLoadingData">
                  <option value="" disabled>{{ isLoadingData ? 'Loading...' : '-- Select --' }}</option>
                  <option v-for="programType in programTypes" :key="programType.id" :value="programType.id">
                    {{ programType.name }}
                  </option>
                </select>
              </div>

              <div class="col-sm-4">
                <label for="programMode">Program Mode<span class="text-danger">*</span></label>
                <select id="programMode" v-model="formData.programModeId" class="form-select" required :disabled="isLoadingData">
                  <option value="" disabled>{{ isLoadingData ? 'Loading...' : '-- Select --' }}</option>
                  <option v-for="programMode in programModes" :key="programMode.id" :value="programMode.id">
                    {{ programMode.name }}
                  </option>
                </select>
              </div>

              <div class="col-sm-4">
                <label for="program">Program <span class="text-danger">*</span></label>
                <select id="program" v-model="formData.programId" class="form-select" required :disabled="isLoadingData">
                  <option value="" disabled>{{ isLoadingData ? 'Loading...' : '-- Select --' }}</option>
                  <option v-for="program in programs" :key="program.id" :value="program.id">
                    {{ program.name }}
                  </option>
                </select>
              </div>


              <div class="col-sm-4">
                <label for="firstName">First Name <span class="text-danger">*</span></label>
                <input type="text" id="firstName" v-model="formData.firstName" placeholder="John" class="form-control"
                  required />
              </div>

              <div class="col-sm-4">
                <label for="otherName">Other Name (optional)</label>
                <input type="text" id="otherName" v-model="formData.otherName" placeholder="Matt"
                  class="form-control" />
              </div>

              <div class="col-sm-4">
                <label for="lastName">Last Name <span class="text-danger">*</span></label>
                <input type="text" id="lastName" v-model="formData.lastName" placeholder="Doe" class="form-control"
                  required />
              </div>

              <div class="col-sm-6">
                <label for="email">Email <span class="text-danger">*</span></label>
                <input type="email" id="email" v-model="formData.email" placeholder="john.doe@mail.com"
                  class="form-control" required />
              </div>

              <div class="col-sm-6">
                <label for="confirmEmail">
                  Confirm Email <span class="text-danger">*</span></label>
                <input type="email" id="confirmEmail" v-model="formData.confirmEmail" placeholder="john.doe@mail.com"
                  class="form-control" required />
              </div>

              <div class="col-sm-6">
                <label for="phone">
                  Phone <span class="text-danger">*</span></label>
                <input type="tel" id="phone" v-model="formData.phone" placeholder="08012345678" class="form-control"
                  required />
              </div>

              <div class="col-sm-3">
                <label for="dateOfBirth">
                  Date of Birth <span class="text-danger">*</span></label>
                <input type="date" id="dateOfBirth" v-model="formData.dateOfBirth" class="form-control" required />
              </div>

              <!-- <div class="col-sm-4">
                <label for="nationality">
                  Nationality <span class="text-danger">*</span></label>
                <input type="text" id="nationality" v-model="formData.nationality" class="form-control"
                  placeholder="Nigeria" required />
              </div>

              <div class="col-sm-4">
                <label for="stateOfOrigin">
                  State of Origin <span class="text-danger">*</span></label>
                <input type="text" id="stateOfOrigin" v-model="formData.stateOfOrigin" class="form-control"
                  placeholder="Ekiti" required />
              </div>

              <div class="col-sm-4">
                <label for="lga"> LGA <span class="text-danger">*</span></label>
                <input type="text" id="lga" v-model="formData.lga" class="form-control" placeholder="Ado-Ekiti"
                  required />
              </div> -->

              <div class="col-sm-3">
                <label for="gender">
                  Gender <span class="text-danger">*</span></label>
                  
                <select id="gender" v-model="formData.gender" class="form-select" required>
                  <option value="" disabled>-- Select --</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>

              <div class="col-sm-6">
                <label for="password"> Password <span class="text-danger">*</span></label>
                <input type="password" id="password" v-model="formData.password" placeholder="********"
                  class="form-control" required />
              </div>

              <div class="col-sm-6">
                <label for="confirmPassword"> Confirm Password <span class="text-danger">*</span></label>
                <input type="password" id="confirmPassword" v-model="formData.confirmPassword" placeholder="********"
                  class="form-control" required />
              </div>

              <div class="col-12 mt-5">
                <button type="submit" class="btn btn-primary w-100" :disabled="isLoading">
                  {{ isLoading ? "Creating Account..." : "Create Account" }}
                </button>
              </div>
            </div>
          </form>

          <p class="mt-3">
            Already have an account? <router-link to="/">Sign in</router-link>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Image as background for mobile view */
@media (max-width: 768px) {
  .form-container {
    background: url("../../assets/stethoscope.png") no-repeat center center;
    background-size: cover;
    position: relative;
    padding: 2rem;
  }

  /* Dark overlay to make form readable */
  .form-container::before {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
  }

  /* Make form content above overlay */
  .form-container>div {
    position: relative;
    z-index: 1;
  }

  .text-md-dark {
    color: white !important;
  }
}

/* For desktop text colors */
@media (min-width: 769px) {
  .text-md-dark {
    color: #000 !important;
  }
}

/* Transparent navbar text color for dark background */
.navbar.bg-transparent .navbar-brand,
.navbar.bg-transparent .nav-link {
  color: #fff;
}

/* @media (min-width: 768px) {
  .navbar.position-md-absolute {
    position: absolute !important; 
    top: 0;
    left: 0;
    z-index: 10;
  }
} */
</style>

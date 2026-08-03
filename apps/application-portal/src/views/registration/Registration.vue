<script lang="js">
import BrandLogo from "../../components/BrandLogo.vue";
import { apiService } from "../../services/api.js";
import { useAuthStore } from "../../stores/auth.js";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";

export default {
  name: "Registration",
  components: { BrandLogo },
  setup() {
    return { authStore: useAuthStore() };
  },
  data() {
    return {
      formData: {
        firstName: "",
        otherName: "",
        lastName: "",
        email: "",
        confirmEmail: "",
        phone: "",
        dateOfBirth: "",
        gender: "",
        programTypeId: "",
        programModeId: "",
        programId: "",
        password: "",
        confirmPassword: "",
      },
      programTypes: [],
      programModes: [],
      programs: [],
      filteredPrograms: [],
      isLoading: false,
      isLoadingData: false,
      showPassword: false,
      showConfirmPassword: false,
      registrationAllowed: false,
      eligibilityMessage: "",
      currentAcademicSession: null,
      isScrolled: false,
      isMobile: false,
      intersectionObserver: null,
    };
  },
  computed: {
    maximumDateOfBirth() {
      const today = new Date();
      const minimumEligibleDate = new Date(
        today.getFullYear() - 15,
        today.getMonth(),
        today.getDate(),
      );

      return minimumEligibleDate.toISOString().split("T")[0];
    },

    // Filter programs based on selected type and mode
    availablePrograms() {
      if (!this.formData.programTypeId || !this.formData.programModeId) {
        return [];
      }

      return this.programs.filter(
        (program) =>
          program.programTypeId === this.formData.programTypeId &&
          program.programModeId === this.formData.programModeId &&
          program.active,
      );
    },

    // Dynamic navbar classes based on scroll and screen size
    navbarClasses() {
      const baseClasses =
        "navbar navbar-light w-100 px-4 navbar-expand-md fixed-top position-absolute";

      if (this.isMobile && this.isScrolled) {
        return `${baseClasses} acon-bg-dark`;
      }

      return `${baseClasses} bg-transparent`;
    },
  },
  watch: {
    // Reset program selection when type or mode changes
    "formData.programTypeId"() {
      this.formData.programId = "";
    },
    "formData.programModeId"() {
      this.formData.programId = "";
    },
  },
  async mounted() {
    await this.checkRegistrationEligibility();
    await this.loadInitialData();
    this.setupScrollAndResizeListeners();
  },

  unmounted() {
    this.removeScrollAndResizeListeners();
  },
  methods: {
    normalizeNameValue(value) {
      if (typeof value !== "string") {
        return value;
      }

      return value.trim().replace(/\s+/g, " ").toLowerCase();
    },

    normalizeEmailValue(value) {
      if (typeof value !== "string") {
        return value;
      }

      return value.trim().replace(/\s+/g, "").toLowerCase();
    },

    sanitizePhoneValue(value) {
      if (typeof value !== "string") {
        return "";
      }

      let sanitized = value.replace(/[^\d+]/g, "");

      if (sanitized.startsWith("+")) {
        sanitized = `+${sanitized.slice(1).replace(/\+/g, "")}`;
        return sanitized.slice(0, 14);
      }

      sanitized = sanitized.replace(/\+/g, "");
      return sanitized.slice(0, 11);
    },

    normalizeRegistrationFields() {
      this.formData.firstName = this.normalizeNameValue(
        this.formData.firstName,
      );
      this.formData.otherName = this.normalizeNameValue(
        this.formData.otherName || "",
      );
      this.formData.lastName = this.normalizeNameValue(this.formData.lastName);
      this.formData.email = this.normalizeEmailValue(this.formData.email);
      this.formData.confirmEmail = this.normalizeEmailValue(
        this.formData.confirmEmail,
      );
      this.formData.phone = this.sanitizePhoneValue(this.formData.phone);
    },

    normalizeField(field) {
      if (["email", "confirmEmail"].includes(field)) {
        this.formData[field] = this.normalizeEmailValue(this.formData[field]);
        return;
      }

      if (["firstName", "otherName", "lastName"].includes(field)) {
        this.formData[field] = this.normalizeNameValue(
          this.formData[field] || "",
        );
      }
    },

    onPhoneInput(event) {
      this.formData.phone = this.sanitizePhoneValue(
        event?.target?.value ?? this.formData.phone,
      );
    },

    async checkRegistrationEligibility() {
      try {
        logger.info("Checking registration eligibility...");
        const response = await apiService.checkRegistrationEligibility();

        if (response.success) {
          this.registrationAllowed = response.data.eligible;
          this.eligibilityMessage = response.data.reason || "";
          this.currentAcademicSession =
            response.data.academicSession?.status === "open"
              ? response.data.academicSession
              : null;

          logger.info("Registration eligibility check result:", {
            eligible: this.registrationAllowed,
            reason: this.eligibilityMessage,
            academicSession: this.currentAcademicSession,
          });

          if (!this.registrationAllowed) {
            await Swal.fire({
              icon: "warning",
              title: "Registration Not Available",
              text: this.eligibilityMessage,
              confirmButtonColor: "#2d7d7d",
            });
          }
        } else {
          throw new Error(
            response.message || "Failed to check registration eligibility",
          );
        }
      } catch (error) {
        logger.error("Error checking registration eligibility:", error);
        this.registrationAllowed = false;
        this.eligibilityMessage =
          "Unable to verify registration availability. Please try again later.";

        await Swal.fire({
          icon: "error",
          title: "System Error",
          text: this.eligibilityMessage,
          confirmButtonColor: "#2d7d7d",
        });
      }
    },

    async loadInitialData() {
      try {
        this.isLoadingData = true;

        // Load all data in parallel
        const [programTypesResult, programModesResult, programsResult] =
          await Promise.all([
            apiService.getProgramTypes(),
            apiService.getProgramModes(),
            apiService.getPrograms(),
          ]);

        if (programTypesResult.success) {
          // Handle both nested and direct data structure
          this.programTypes =
            (programTypesResult.data?.data || programTypesResult.data || []).filter(
              (programType) => programType.active !== false,
            );
          logger.info("Program types loaded:", this.programTypes);
        } else {
          logger.error("Failed to load program types:", programTypesResult);
        }

        if (programModesResult.success) {
          // Handle both nested and direct data structure
          this.programModes =
            (programModesResult.data?.data || programModesResult.data || []).filter(
              (programMode) => programMode.active !== false,
            );
          logger.info("Program modes loaded:", this.programModes);
        } else {
          logger.error("Failed to load program modes:", programModesResult);
        }

        if (programsResult.success) {
          // Handle both nested and direct data structure
          this.programs =
            programsResult.data?.data || programsResult.data || [];
          logger.info("Programs loaded:", this.programs);
        } else {
          logger.error("Failed to load programs:", programsResult);
        }

        logger.info("All data loaded - Arrays:", {
          programTypes: this.programTypes,
          programModes: this.programModes,
          programs: this.programs,
        });
      } catch (error) {
        logger.error("Error loading initial data:", error);
        Swal.fire({
          icon: "error",
          title: "Loading Error",
          text: "Failed to load program data. Please refresh the page.",
          confirmButtonColor: "#2d7d7d",
        });
      } finally {
        this.isLoadingData = false;
      }
    },

    async onSubmit() {
      try {
        this.normalizeRegistrationFields();

        // Check if registration is allowed
        if (!this.registrationAllowed) {
          await Swal.fire({
            icon: "warning",
            title: "Registration Not Available",
            text: this.eligibilityMessage,
            confirmButtonColor: "#2d7d7d",
          });
          return;
        }

        // Validate form
        if (!this.validateForm()) {
          return;
        }

        this.isLoading = true;

        // Show loading state
        Swal.fire({
          title: "Creating Account...",
          html: "Please wait",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          },
        });

        // Call backend API
        const result = await this.authStore.register({
          firstName: this.formData.firstName,
          otherName: this.formData.otherName,
          lastName: this.formData.lastName,
          email: this.formData.email,
          phone: this.formData.phone,
          dateOfBirth: this.formData.dateOfBirth,
          gender: this.formData.gender,
          programId: this.formData.programId,
          password: this.formData.password,
        });

        if (result.success) {
          logger.info("Registration successful:", result.data.user);

          // Success message
          await Swal.fire({
            icon: "success",
            title: "Account Created!",
            text: `Welcome to Alecons, ${result.data.user.firstName}! Your application number is ${result.data.applicationNumber}`,
            confirmButtonColor: "#2d7d7d",
          });

          const applicationId = this.authStore.applications[0]?.id;
          await this.$router.push(
            applicationId
              ? { name: "Dashboard", params: { id: applicationId } }
              : { name: "MyApplications" },
          );
        } else {
          // Handle API errors
          await Swal.fire({
            icon: "error",
            title: "Registration Failed",
            text: result.error || "Please check your information and try again",
            confirmButtonColor: "#2d7d7d",
          });
        }
      } catch (error) {
        logger.error("Registration error:", error);

        await Swal.fire({
          icon: "error",
          title: "Oops...",
          text: "Something went wrong! Please try again.",
          confirmButtonColor: "#2d7d7d",
        });
      } finally {
        this.isLoading = false;
      }
    },

    validateForm() {
      this.normalizeRegistrationFields();

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
        confirmPassword,
      } = this.formData;

      // Check required fields
      if (
        !firstName ||
        !lastName ||
        !email ||
        !phone ||
        !dateOfBirth ||
        !gender ||
        !programTypeId ||
        !programModeId ||
        !programId ||
        !password
      ) {
        Swal.fire({
          icon: "warning",
          title: "Missing Information",
          text: "Please fill in all required fields",
          confirmButtonColor: "#2d7d7d",
        });
        return false;
      }

      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        Swal.fire({
          icon: "warning",
          title: "Invalid Email",
          text: "Please enter a valid email address",
          confirmButtonColor: "#2d7d7d",
        });
        return false;
      }

      // Email confirmation validation
      if (email !== confirmEmail) {
        Swal.fire({
          icon: "warning",
          title: "Email Mismatch",
          text: "Email addresses do not match",
          confirmButtonColor: "#2d7d7d",
        });
        return false;
      }

      // Phone number validation (Nigerian format: starts with 0 or +234, 11 digits total)
      const phoneRegex = /^(\+234|0)[789][01]\d{8}$/;
      if (!phoneRegex.test(phone.replace(/\s/g, ""))) {
        Swal.fire({
          icon: "warning",
          title: "Invalid Phone Number",
          text: "Please enter a valid Nigerian phone number (e.g., 08012345678 or +2348012345678)",
          confirmButtonColor: "#2d7d7d",
        });
        return false;
      }

      // Password validation
      if (password !== confirmPassword) {
        Swal.fire({
          icon: "warning",
          title: "Password Mismatch",
          text: "Passwords do not match",
          confirmButtonColor: "#2d7d7d",
        });
        return false;
      }

      if (password.length < 6) {
        Swal.fire({
          icon: "warning",
          title: "Weak Password",
          text: "Password must be at least 6 characters long",
          confirmButtonColor: "#2d7d7d",
        });
        return false;
      }

      return true;
    },

    togglePasswordVisibility() {
      this.showPassword = !this.showPassword;
    },

    toggleConfirmPasswordVisibility() {
      this.showConfirmPassword = !this.showConfirmPassword;
    },

    setupScrollAndResizeListeners() {
      this.checkScreenSize();

      this.resizeHandler = () => {
        this.checkScreenSize();
      };
      window.addEventListener("resize", this.resizeHandler);

      this.$nextTick(() => {
        this.setupScrollObserver();
      });
    },

    setupScrollObserver() {
      const sentinel = this.$refs.topSentinel;
      if (!sentinel || !("IntersectionObserver" in window)) {
        return;
      }

      this.intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          this.isScrolled = !entry.isIntersecting;
        },
        { threshold: 0 },
      );

      this.intersectionObserver.observe(sentinel);
    },

    removeScrollAndResizeListeners() {
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
        this.intersectionObserver = null;
      }
      if (this.resizeHandler) {
        window.removeEventListener("resize", this.resizeHandler);
      }
    },

    checkScreenSize() {
      this.isMobile = window.innerWidth < 768;
    },
  },
};
</script>

<template>
  <div class="container-fluid registration-container">
    <nav
      :class="navbarClasses"
      style="z-index: 1030; transition: background-color 0.3s ease"
    >
      <BrandLogo class="navbar-brand" />
    </nav>

    <div class="row min-vh-100">
      <div class="col-md-5 d-none d-md-block px-0 left-panel">
        <img
          src="@shared/assets/schoolImg3.jpg"
          class="img-fluid vh-100 w-100 object-fit-cover"
          alt=""
        />
      </div>

      <div class="col-md-7 form-container text-white text-md-dark">
        <div class="scrollable-content p-2 p-md-5">
          <div
            ref="topSentinel"
            aria-hidden="true"
            style="height: 1px; pointer-events: none"
          ></div>
          <div class="content-wrapper w-100">
            <div class="mt-md-0 mt-5">
              <h3 class="mb-4 pt-md-0 pt-5 acon-text-primary page-title">
                Registration
                <span v-if="currentAcademicSession">
                  for {{ currentAcademicSession?.title }} Admission
                </span>
              </h3>

              <!-- <div class="alert alert-warning mb-4 small">
                <i class="bi bi-exclamation-triangle me-1"></i> Only direct
                entry JAMB candidates and graduates from
                <b>Community Midwifery and Nursing</b> program should select
                <b>Full-Time (CM&N)</b> program mode during registration. All
                other applicants should select the <b>Full-Time</b> program
                mode. Please ensure you select the correct program mode to avoid
                any issues with your application.
              </div> -->

              <!-- Academic Session Info -->
              <!-- <div v-if="currentAcademicSession" class="alert alert-info mb-4">
                <div class="d-flex align-items-center">
                  <i class="bi bi-calendar-event me-2"></i>
                  <small>
                    <strong>Open Registration Session:</strong>
                    {{ currentAcademicSession.sessionYear }}
                    <span class="badge bg-primary ms-2">{{ currentAcademicSession.status?.toUpperCase() }}</span>
                  </small>
                </div>
              </div> -->

              <!-- Registration Status Alert -->
              <div v-if="!registrationAllowed" class="alert alert-warning mb-4">
                <div class="d-flex align-items-center">
                  <i class="bi bi-exclamation-triangle me-2"></i>
                  <small
                    ><strong>Registration Status:</strong>
                    {{ eligibilityMessage }}</small
                  >
                </div>
              </div>

              <form
                @submit.prevent="onSubmit"
                class="mb-5"
                :class="{ 'opacity-50': !registrationAllowed }"
              >
                <div class="row g-3">
                  <div class="col-sm-4">
                    <label for="programType">
                      Program Type <span class="text-danger">*</span></label
                    >
                    <select
                      id="programType"
                      v-model="formData.programTypeId"
                      class="form-select"
                      required
                      :disabled="isLoadingData || !registrationAllowed"
                    >
                      <option value="" disabled>
                        {{
                          isLoadingData
                            ? "Loading..."
                            : "-- Select Program Type --"
                        }}
                      </option>
                      <option
                        v-for="programType in programTypes"
                        :key="programType.id"
                        :value="programType.id"
                      >
                        {{ programType.description || programType.type }}
                      </option>
                    </select>
                  </div>

                  <div class="col-sm-4">
                    <label for="programMode">
                      Program Mode<span class="text-danger">*</span></label
                    >
                    <select
                      id="programMode"
                      v-model="formData.programModeId"
                      class="form-select"
                      required
                      :disabled="isLoadingData || !registrationAllowed"
                    >
                      <option value="" disabled>
                        {{
                          isLoadingData
                            ? "Loading..."
                            : "-- Select Program Mode --"
                        }}
                      </option>
                      <option
                        v-for="programMode in programModes"
                        :key="programMode.id"
                        :value="programMode.id"
                      >
                        {{ programMode.description || programMode.mode }}
                      </option>
                    </select>
                  </div>

                  <div class="col-sm-4">
                    <label for="program">
                      Program <span class="text-danger">*</span></label
                    >
                    <select
                      id="program"
                      v-model="formData.programId"
                      class="form-select"
                      required
                      :disabled="
                        isLoadingData ||
                        !registrationAllowed ||
                        availablePrograms.length === 0
                      "
                    >
                      <option value="" disabled>
                        {{
                          isLoadingData
                            ? "Loading..."
                            : !formData.programTypeId || !formData.programModeId
                              ? "-- Select Type & Mode First --"
                              : availablePrograms.length === 0
                                ? "-- No Programs Available --"
                                : "-- Select Program --"
                        }}
                      </option>
                      <option
                        v-for="program in availablePrograms"
                        :key="program.id"
                        :value="program.id"
                      >
                        {{ program.name }}
                      </option>
                    </select>
                  </div>

                  <div class="col-sm-4">
                    <label for="firstName"
                      >First Name <span class="text-danger">*</span></label
                    >
                    <input
                      type="text"
                      id="firstName"
                      v-model="formData.firstName"
                      autocapitalize="off"
                      spellcheck="false"
                      placeholder="John"
                      class="form-control"
                      @blur="normalizeField('firstName')"
                      required
                    />
                  </div>

                  <div class="col-sm-4">
                    <label for="otherName">Other Name (optional)</label>
                    <input
                      type="text"
                      id="otherName"
                      v-model="formData.otherName"
                      autocapitalize="off"
                      spellcheck="false"
                      placeholder="Matt"
                      class="form-control"
                      @blur="normalizeField('otherName')"
                    />
                  </div>

                  <div class="col-sm-4">
                    <label for="lastName"
                      >Last Name <span class="text-danger">*</span></label
                    >
                    <input
                      type="text"
                      id="lastName"
                      v-model="formData.lastName"
                      autocapitalize="off"
                      spellcheck="false"
                      placeholder="Doe"
                      class="form-control"
                      @blur="normalizeField('lastName')"
                      required
                    />
                  </div>

                  <div class="col-sm-6">
                    <label for="email"
                      >Email <span class="text-danger">*</span></label
                    >
                    <input
                      type="email"
                      id="email"
                      v-model="formData.email"
                      autocapitalize="off"
                      spellcheck="false"
                      placeholder="john.doe@mail.com"
                      class="form-control"
                      @blur="normalizeField('email')"
                      required
                    />
                  </div>

                  <div class="col-sm-6">
                    <label for="confirmEmail">
                      Confirm Email <span class="text-danger">*</span></label
                    >
                    <input
                      type="email"
                      id="confirmEmail"
                      v-model="formData.confirmEmail"
                      autocapitalize="off"
                      spellcheck="false"
                      placeholder="john.doe@mail.com"
                      class="form-control"
                      @blur="normalizeField('confirmEmail')"
                      required
                    />
                  </div>

                  <div class="col-sm-6">
                    <label for="phone">
                      Phone <span class="text-danger">*</span></label
                    >
                    <input
                      type="tel"
                      id="phone"
                      v-model="formData.phone"
                      inputmode="numeric"
                      autocomplete="tel"
                      maxlength="14"
                      placeholder="08012345678"
                      class="form-control"
                      @input="onPhoneInput"
                      required
                    />
                  </div>

                  <div class="col-sm-3">
                    <label for="dateOfBirth">
                      Date of Birth <span class="text-danger">*</span></label
                    >
                    <input
                      type="date"
                      id="dateOfBirth"
                      v-model="formData.dateOfBirth"
                      :max="maximumDateOfBirth"
                      class="form-control"
                      required
                    />
                  </div>

                  <div class="col-sm-3">
                    <label for="gender">
                      Gender <span class="text-danger">*</span></label
                    >

                    <select
                      id="gender"
                      v-model="formData.gender"
                      class="form-select"
                      required
                    >
                      <option value="" disabled>-- Select --</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                  </div>

                  <div class="col-sm-6">
                    <label for="password">
                      Password <span class="text-danger">*</span></label
                    >
                    <div class="input-group">
                      <input
                        :type="showPassword ? 'text' : 'password'"
                        id="password"
                        v-model="formData.password"
                        placeholder="********"
                        class="form-control border-end-0"
                        required
                      />
                      <button
                        class="btn border border-start-0 text-muted"
                        type="button"
                        @click="togglePasswordVisibility"
                        :title="
                          showPassword ? 'Hide password' : 'Show password'
                        "
                      >
                        <i
                          :class="
                            showPassword ? 'bi bi-eye' : 'bi bi-eye-slash'
                          "
                        ></i>
                      </button>
                    </div>
                  </div>

                  <div class="col-sm-6">
                    <label for="confirmPassword">
                      Confirm Password <span class="text-danger">*</span></label
                    >
                    <div class="input-group">
                      <input
                        :type="showConfirmPassword ? 'text' : 'password'"
                        id="confirmPassword"
                        v-model="formData.confirmPassword"
                        placeholder="********"
                        class="form-control border-end-0"
                        required
                      />
                      <button
                        class="btn border border-start-0 text-muted"
                        type="button"
                        @click="toggleConfirmPasswordVisibility"
                        :title="
                          showConfirmPassword
                            ? 'Hide password'
                            : 'Show password'
                        "
                      >
                        <i
                          :class="
                            showConfirmPassword
                              ? 'bi bi-eye'
                              : 'bi bi-eye-slash'
                          "
                        ></i>
                      </button>
                    </div>
                  </div>

                  <div class="col-12 mt-5">
                    <button
                      type="submit"
                      class="btn btn-acon-primary py-2 w-100"
                      :disabled="isLoading || !registrationAllowed"
                    >
                      <span v-if="!registrationAllowed"
                        >Registration Not Available</span
                      >
                      <span v-else>{{
                        isLoading ? "Creating Account..." : "Create Account"
                      }}</span>
                    </button>
                  </div>
                </div>
              </form>

              <p class="mt-3">
                Already have an account?
                <router-link to="/" class="acon-text-secondary"
                  >Sign in</router-link
                >
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Mobile keeps the existing page scroll behaviour */
.registration-container {
  min-height: 100vh;
}

.content-wrapper {
  width: 100%;
}

@media (min-width: 768px) {
  .registration-container {
    height: 100vh;
    overflow: hidden;
  }

  .registration-container > .row {
    height: 100vh;
    flex-wrap: nowrap;
  }

  .left-panel {
    position: sticky;
    top: 0;
    height: 100vh;
    overflow: hidden;
    flex: 0 0 auto;
  }

  .form-container {
    height: 100vh;
    overflow: hidden;
  }

  .scrollable-content {
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
    scroll-behavior: smooth;
  }
}

/* Image as background for mobile view */
@media (max-width: 767.98px) {
  .page-title {
    color: white !important;
  }

  .form-container {
    background: url("@shared/assets/schoolImg3.jpg") no-repeat center center;
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
  .form-container > div {
    position: relative;
    z-index: 1;
  }

  .text-md-dark {
    color: white !important;
  }

  .registration-container {
    overflow-y: auto;
  }
}

/* For desktop text colors */
@media (min-width: 768px) {
  .text-md-dark {
    color: #000 !important;
  }
}

/* Transparent navbar text color for dark background */
.navbar.bg-transparent .navbar-brand,
.navbar.bg-transparent .nav-link {
  color: #fff;
}

/* Dark navbar text color when scrolled on mobile */
.navbar.acon-bg-dark .navbar-brand,
.navbar.acon-bg-dark .nav-link {
  color: #fff;
}

@media (max-width: 767.98px) {
  .navbar.acon-bg-dark {
    background-color: rgba(224, 122, 95, 0.88) !important;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }
}

/* Smooth transition for navbar background */
.navbar {
  transition:
    background-color 0.3s ease,
    box-shadow 0.3s ease,
    backdrop-filter 0.3s ease;
}

input[type="date"]::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 1;
  display: block;
  color: transparent;
  background: url("https://cdn.jsdelivr.net/npm/bootstrap-icons/icons/calendar-date.svg")
    no-repeat center;
  background-size: 1rem 1rem;
}
</style>

<script>
import { useAuthStore } from "../stores/auth.js";
import { tenancyAgreementService } from "../services/tenancyAgreement.js";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";

export default {
  name: "TenancyAgreement",
  data() {
    return {
      // Form data
      formData: {
        tenantName: "",
        courseOfStudy: "",
        residentialAddress: "",
        phoneNumber: "",
        parentName: "",
        parentPhone: "",
        guarantorName: "",
        guarantorPhone: "",
        guarantorAddress: "",
        guarantorOccupation: "",
        guarantorRelationship: "",
        hostelAddress: "",
        tenancyStartDate: "",
        tenancyEndDate: "",
        agreeToTerms: false,
      },

      // UI state
      isLoading: true,
      isSubmitting: false,
      agreementStatus: null,
      agreementDocument: null,
      errors: {},

      // User data
      user: null,

      // Agreement text sections
      agreementDate: new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    };
  },

  async mounted() {
    const authStore = useAuthStore();
    this.user = authStore.user;

    // Pre-fill user data
    if (this.user) {
      this.formData.tenantName = `${this.user.firstName} ${this.user.otherName} ${this.user.lastName}`;
      this.formData.phoneNumber = authStore.user?.phone || "";
      this.formData.courseOfStudy = authStore.fullProgramWithMode || "";
      this.formData.residentialAddress = authStore.application.address || "";
    }

    await this.checkAgreementStatus();
    this.isLoading = false;
  },

  computed: {
    isFormValid() {
      return (
        this.formData.tenantName &&
        this.formData.courseOfStudy &&
        this.formData.residentialAddress &&
        this.formData.phoneNumber &&
        this.formData.parentName &&
        this.formData.parentPhone &&
        this.formData.guarantorName &&
        this.formData.guarantorPhone &&
        this.formData.guarantorAddress &&
        this.formData.guarantorOccupation &&
        this.formData.guarantorRelationship &&
        this.formData.hostelAddress &&
        this.formData.tenancyStartDate &&
        this.formData.tenancyEndDate &&
        this.formData.agreeToTerms
      );
    },

    hasSignedAgreement() {
      return this.agreementStatus === "signed";
    },

    agreementDocumentUrl() {
      return this.agreementDocument || null;
    },
  },

  methods: {
    async checkAgreementStatus() {
      try {
        const response = await tenancyAgreementService.getAgreementStatus();
        if (response.success) {
          this.agreementStatus = response.data.status;
          this.agreementDocument = response.data.documentUrl;

          // If agreement is signed, we have the document URL
          if (response.data.hasSigned && response.data.documentUrl) {
            logger.info(
              "Student has signed agreement. Document available at:",
              response.data.documentUrl
            );
          }
        }
      } catch (error) {
        logger.error("Error checking agreement status:", error);
      }
    },

    validateForm() {
      this.errors = {};

      // Required field validation
      const requiredFields = {
        tenantName: "Full name is required",
        courseOfStudy: "Course of study is required",
        residentialAddress: "Residential address is required",
        phoneNumber: "Phone number is required",
        parentName: "Parent/Guardian name is required",
        parentPhone: "Parent/Guardian phone is required",
        guarantorName: "Guarantor name is required",
        guarantorPhone: "Guarantor phone is required",
        guarantorAddress: "Guarantor address is required",
        guarantorOccupation: "Guarantor occupation is required",
        guarantorRelationship: "Relationship to guarantor is required",
        hostelAddress: "Hostel address is required",
        tenancyStartDate: "Tenancy start date is required",
        tenancyEndDate: "Tenancy end date is required",
      };

      for (const [field, message] of Object.entries(requiredFields)) {
        if (!this.formData[field]) {
          this.errors[field] = message;
        }
      }

      // Phone number validation
      const phoneRegex = /^[\d\s\-\+\(\)]+$/;
      if (
        this.formData.phoneNumber &&
        !phoneRegex.test(this.formData.phoneNumber)
      ) {
        this.errors.phoneNumber = "Please enter a valid phone number";
      }

      if (
        this.formData.parentPhone &&
        !phoneRegex.test(this.formData.parentPhone)
      ) {
        this.errors.parentPhone = "Please enter a valid phone number";
      }

      if (
        this.formData.guarantorPhone &&
        !phoneRegex.test(this.formData.guarantorPhone)
      ) {
        this.errors.guarantorPhone = "Please enter a valid phone number";
      }

      // Date validation
      if (this.formData.tenancyStartDate && this.formData.tenancyEndDate) {
        const startDate = new Date(this.formData.tenancyStartDate);
        const endDate = new Date(this.formData.tenancyEndDate);

        if (endDate <= startDate) {
          this.errors.tenancyEndDate = "End date must be after start date";
        }
      }

      // Agreement checkbox validation
      if (!this.formData.agreeToTerms) {
        this.errors.agreeToTerms = "You must agree to the terms and conditions";
      }

      return Object.keys(this.errors).length === 0;
    },

    async submitAgreement() {
      if (!this.validateForm()) {
        Swal.fire({
          icon: "error",
          title: "Form Validation Failed",
          text: "Please fill in all required fields correctly.",
          confirmButtonText: "OK",
        });
        return;
      }

      try {
        this.isSubmitting = true;

        const response = await tenancyAgreementService.submitAgreement(
          this.formData
        );

        if (response.success) {
          this.agreementStatus = "signed";
          this.agreementDocument = response.data.documentUrl;

          // Log the successful process
          logger.info("Agreement signed successfully");
          logger.info("PDF document generated:", response.data.documentUrl);
          logger.info("Student hasSignedTenancyAgreement updated to true");

          Swal.fire({
            icon: "success",
            title: "Agreement Signed Successfully!",
            html: `
              <p>Your tenancy agreement has been successfully processed:</p>
              <ul class="text-start">
                <li>Agreement signed and saved</li>
                <li>PDF document generated and stored</li>
                <li>You can now make accommodation fee payments</li>
              </ul>
            `,
            confirmButtonText: "Go to Finance",
            showCancelButton: true,
            cancelButtonText: "Stay Here",
          }).then((result) => {
            if (result.isConfirmed) {
              // Redirect to finance page
              this.$router.push("/finance");
            }
          });
        } else {
          throw new Error(response.message);
        }
      } catch (error) {
        logger.error("Error submitting agreement:", error);

        Swal.fire({
          icon: "error",
          title: "Submission Failed",
          text:
            error.message || "Failed to submit agreement. Please try again.",
          confirmButtonText: "OK",
        });
      } finally {
        this.isSubmitting = false;
      }
    },

    goToFinance() {
      this.$router.push("/finance");
    },

    viewAgreement() {
      if (this.agreementDocumentUrl) {
        window.open(this.agreementDocumentUrl, '_blank');
      }
    },
  },
};
</script>

<template>
  <div class="tenancy-agreement p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div
          class="d-flex justify-content-between align-items-center flex-wrap"
        >
          <div class="mb-2 mb-md-0">
            <h2 class="h3 fw-bold text-dark mb-1">
              <i class="bi bi-file-text me-2 text-primary"></i>
              Tenancy Agreement
            </h2>
            <p class="text-muted mb-0">
              Complete and sign your hostel tenancy agreement.
            </p>
          </div>
          <div v-if="hasSignedAgreement">
            <span class="badge bg-success fs-6 px-3 py-2">
              <i class="bi bi-check-circle me-1"></i>
              Agreement Signed
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="text-muted mt-3">Loading agreement details...</p>
    </div>

    <!-- Agreement Already Signed -->
    <div v-else-if="hasSignedAgreement" class="card border-success">
      <div class="card-body text-center py-5">
        <i
          class="bi bi-check-circle-fill text-success mb-3"
          style="font-size: 4rem"
        ></i>
        <h4 class="text-success mb-3">Agreement Already Signed</h4>
        <p class="text-muted mb-4">
          You have already completed and signed your tenancy agreement. You can
          now proceed to make accommodation fee payments.
        </p>

        <!-- Document Download Section -->
        <div v-if="agreementDocumentUrl" class="mb-4">
          <div class="alert alert-info d-inline-block">
            <i class="bi bi-file-pdf me-2"></i>
            <strong>Your signed agreement document is ready</strong>
            <br />
            <button
            v-if="agreementDocumentUrl"
              @click="viewAgreement"
              class="btn btn-outline-primary btn-sm mt-2"
            >
              <i class="bi bi-file-pdf me-1"></i>
               View Agreement
            </button>
          </div>
        </div>

        <div class="d-flex gap-2 justify-content-center flex-wrap">
          <button class="btn btn-success btn-lg" @click="goToFinance">
            <i class="bi bi-credit-card me-2"></i>
            Go to Finance
          </button>
        </div>
      </div>
    </div>

    <!-- Agreement Form -->
    <div v-else>
      <!-- Agreement Header -->
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-body text-center py-4">
          <h3 class="fw-bold mb-3">TENANCY AGREEMENT</h3>
          <h5 class="mb-2">BETWEEN:</h5>
          <p class="mb-2">
            <strong>MR OLUSEGUN</strong> (Trading under the name of<br />
            <strong>ALEBIOSU COLLEGE OF NURSING SCIENCES LTD</strong>)
          </p>
          <p class="text-muted">(LANDLORD)</p>
          <p class="mb-2">AND</p>
          <p class="mb-0 fw-bold text-uppercase">{{ formData.tenantName }}</p>
          <p class="text-muted">(TENANT)</p>
          <p class="small text-muted">
            IN RESPECT OF ONE (1) BED SPACE LYING, SITUATE AND BEING<br />
            AT ACAS HOSTEL
          </p>
          <p class="small text-muted mb-0">
            <strong>DATED THIS {{ agreementDate }}</strong>
          </p>
        </div>
      </div>

      <!-- Personal Information Form -->
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-primary text-white">
          <h5 class="mb-0">
            <i class="bi bi-person me-2"></i>
            Personal Information
          </h5>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-6 mb-3">
              <label for="tenantName" class="form-label fw-bold">
                Full Name <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                :class="{ 'is-invalid': errors.tenantName }"
                id="tenantName"
                v-model="formData.tenantName"
                placeholder="Enter your full name"
                readonly
              />
              <div v-if="errors.tenantName" class="invalid-feedback">
                {{ errors.tenantName }}
              </div>
            </div>

            <div class="col-md-6 mb-3">
              <label for="courseOfStudy" class="form-label fw-bold">
                Course of Study <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                :class="{ 'is-invalid': errors.courseOfStudy }"
                id="courseOfStudy"
                v-model="formData.courseOfStudy"
                readonly
              />
              <div v-if="errors.courseOfStudy" class="invalid-feedback">
                {{ errors.courseOfStudy }}
              </div>
            </div>

            <div class="col-md-6 mb-3">
              <label for="phoneNumber" class="form-label fw-bold">
                Phone Number <span class="text-danger">*</span>
              </label>
              <input
                type="tel"
                class="form-control"
                :class="{ 'is-invalid': errors.phoneNumber }"
                id="phoneNumber"
                v-model="formData.phoneNumber"
                placeholder="Enter your phone number"
                readonly
              />
              <div v-if="errors.phoneNumber" class="invalid-feedback">
                {{ errors.phoneNumber }}
              </div>
            </div>

            <div class="col-md-6 mb-3">
              <label for="residentialAddress" class="form-label fw-bold">
                Residential Address <span class="text-danger">*</span>
              </label>
              <textarea
                class="form-control"
                :class="{ 'is-invalid': errors.residentialAddress }"
                id="residentialAddress"
                v-model="formData.residentialAddress"
                rows="2"
                placeholder="Enter your residential address"
                readonly
              ></textarea>
              <div v-if="errors.residentialAddress" class="invalid-feedback">
                {{ errors.residentialAddress }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Parent/Guardian Information -->
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-info text-white">
          <h5 class="mb-0">
            <i class="bi bi-people me-2"></i>
            Parent/Guardian Information
          </h5>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-md-6 mb-3">
              <label for="parentName" class="form-label fw-bold">
                Parent/Guardian Name <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                :class="{ 'is-invalid': errors.parentName }"
                id="parentName"
                v-model="formData.parentName"
                placeholder="Enter parent/guardian name"
              />
              <div v-if="errors.parentName" class="invalid-feedback">
                {{ errors.parentName }}
              </div>
            </div>

            <div class="col-md-6 mb-3">
              <label for="parentPhone" class="form-label fw-bold">
                Parent/Guardian Phone <span class="text-danger">*</span>
              </label>
              <input
                type="tel"
                class="form-control"
                :class="{ 'is-invalid': errors.parentPhone }"
                id="parentPhone"
                v-model="formData.parentPhone"
                placeholder="Enter parent/guardian phone"
              />
              <div v-if="errors.parentPhone" class="invalid-feedback">
                {{ errors.parentPhone }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Guarantor Information -->
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header text-white">
          <h5 class="mb-0">
            <i class="bi bi-shield-check me-2"></i>
            Guarantor Information
          </h5>
        </div>
        <div class="card-body">
          <div class="alert alert-info" role="alert">
            <i class="bi bi-info-circle me-2"></i>
            <strong>Note:</strong> The guarantor must be a person of means who
            is blood related to you.
          </div>
          <div class="row">
            <div class="col-md-6 mb-3">
              <label for="guarantorName" class="form-label fw-bold">
                Guarantor Name <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                :class="{ 'is-invalid': errors.guarantorName }"
                id="guarantorName"
                v-model="formData.guarantorName"
                placeholder="Enter guarantor name"
              />
              <div v-if="errors.guarantorName" class="invalid-feedback">
                {{ errors.guarantorName }}
              </div>
            </div>

            <div class="col-md-6 mb-3">
              <label for="guarantorPhone" class="form-label fw-bold">
                Guarantor Phone <span class="text-danger">*</span>
              </label>
              <input
                type="tel"
                class="form-control"
                :class="{ 'is-invalid': errors.guarantorPhone }"
                id="guarantorPhone"
                v-model="formData.guarantorPhone"
                placeholder="Enter guarantor phone"
              />
              <div v-if="errors.guarantorPhone" class="invalid-feedback">
                {{ errors.guarantorPhone }}
              </div>
            </div>

            <div class="col-md-6 mb-3">
              <label for="guarantorOccupation" class="form-label fw-bold">
                Guarantor Occupation <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                :class="{ 'is-invalid': errors.guarantorOccupation }"
                id="guarantorOccupation"
                v-model="formData.guarantorOccupation"
                placeholder="Enter guarantor occupation"
              />
              <div v-if="errors.guarantorOccupation" class="invalid-feedback">
                {{ errors.guarantorOccupation }}
              </div>
            </div>

            <div class="col-md-6 mb-3">
              <label for="guarantorRelationship" class="form-label fw-bold">
                Relationship to You <span class="text-danger">*</span>
              </label>
              <select
                class="form-select"
                :class="{ 'is-invalid': errors.guarantorRelationship }"
                id="guarantorRelationship"
                v-model="formData.guarantorRelationship"
              >
                <option value="">Select relationship</option>
                <option value="Father">Father</option>
                <option value="Mother">Mother</option>
                <option value="Uncle">Uncle</option>
                <option value="Aunt">Aunt</option>
                <option value="Brother">Brother</option>
                <option value="Sister">Sister</option>
                <option value="Grandfather">Grandfather</option>
                <option value="Grandmother">Grandmother</option>
                <option value="Other Blood Relative">
                  Other Blood Relative
                </option>
              </select>
              <div v-if="errors.guarantorRelationship" class="invalid-feedback">
                {{ errors.guarantorRelationship }}
              </div>
            </div>

            <div class="col-12 mb-3">
              <label for="guarantorAddress" class="form-label fw-bold">
                Guarantor Address <span class="text-danger">*</span>
              </label>
              <textarea
                class="form-control"
                :class="{ 'is-invalid': errors.guarantorAddress }"
                id="guarantorAddress"
                v-model="formData.guarantorAddress"
                rows="3"
                placeholder="Enter guarantor address"
              ></textarea>
              <div v-if="errors.guarantorAddress" class="invalid-feedback">
                {{ errors.guarantorAddress }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Hostel Information -->
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-success text-white">
          <h5 class="mb-0">
            <i class="bi bi-building me-2"></i>
            Hostel Information
          </h5>
        </div>
        <div class="card-body">
          <div class="row">
            <div class="col-12 mb-3">
              <label for="hostelAddress" class="form-label fw-bold">
                Hostel Address <span class="text-danger">*</span>
              </label>
              <textarea
                class="form-control"
                :class="{ 'is-invalid': errors.hostelAddress }"
                id="hostelAddress"
                v-model="formData.hostelAddress"
                rows="2"
                placeholder="Enter the hostel address"
              ></textarea>
              <div v-if="errors.hostelAddress" class="invalid-feedback">
                {{ errors.hostelAddress }}
              </div>
            </div>

            <div class="col-md-6 mb-3">
              <label for="tenancyStartDate" class="form-label fw-bold">
                Tenancy Start Date <span class="text-danger">*</span>
              </label>
              <input
                type="date"
                class="form-control"
                :class="{ 'is-invalid': errors.tenancyStartDate }"
                id="tenancyStartDate"
                v-model="formData.tenancyStartDate"
              />
              <div v-if="errors.tenancyStartDate" class="invalid-feedback">
                {{ errors.tenancyStartDate }}
              </div>
            </div>

            <div class="col-md-6 mb-3">
              <label for="tenancyEndDate" class="form-label fw-bold">
                Tenancy End Date <span class="text-danger">*</span>
              </label>
              <input
                type="date"
                class="form-control"
                :class="{ 'is-invalid': errors.tenancyEndDate }"
                id="tenancyEndDate"
                v-model="formData.tenancyEndDate"
              />
              <div v-if="errors.tenancyEndDate" class="invalid-feedback">
                {{ errors.tenancyEndDate }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Terms and Conditions -->
      <div class="card border-0 shadow-sm mb-4">
        <div class="card-header bg-dark text-white">
          <h5 class="mb-0">
            <i class="bi bi-list-check me-2"></i>
            Terms and Conditions
          </h5>
        </div>
        <div class="card-body">
          <div
            class="terms-content"
            style="max-height: 400px; overflow-y: auto"
          >
            <div class="alert alert-info mb-4">
              <h6 class="fw-bold">Rental Information:</h6>
              <p class="mb-0">
                The rent for a bed space per year is
                <strong>₦100,000.00</strong> including utilities and
                <strong>₦5,000</strong> for general fixes around space (Total =
                <strong>₦105,000</strong>).
              </p>
            </div>

            <h6 class="fw-bold mb-3">
              THE LANDLORD HEREBY GIVES CONDITIONS TO THE TENANT WHICH THE
              TENANT AGREES AS FOLLOWS:
            </h6>

            <div class="terms-list">
              <ol class="list-group list-group-numbered list-group-flush">
                <li class="list-group-item border-0 px-0">
                  The rent is payable yearly and in advance on or before the
                  date the tenancy expires.
                </li>

                <li class="list-group-item border-0 px-0">
                  The Tenant shall provide complete personal and contact
                  information including parents' and guarantor's details on the
                  ACAS Resident form with recent passport photograph and
                  evidence of payment.
                </li>

                <li class="list-group-item border-0 px-0">
                  The above is a condition precedent to the allocation of bed
                  space in a room.
                </li>

                <li class="list-group-item border-0 px-0">
                  The Tenant shall provide a person of means who is blood
                  related to him or her as guarantor.
                </li>

                <li class="list-group-item border-0 px-0">
                  No partying of any form is allowed in the hostel without
                  express permission from Management.
                </li>

                <li class="list-group-item border-0 px-0">
                  Any form of illicit or hard drugs is strictly prohibited.
                  Violation results in automatic tenancy termination without
                  refund.
                </li>

                <li class="list-group-item border-0 px-0">
                  The Tenant shall be responsible for maintenance of electrical
                  appliances in the apartment.
                </li>

                <li class="list-group-item border-0 px-0">
                  Drinking and selling alcoholic drinks/substances is not
                  permitted in the hostel or its surroundings.
                </li>

                <li class="list-group-item border-0 px-0">
                  Fighting is prohibited. All disagreements must be reported to
                  management for resolution.
                </li>

                <li class="list-group-item border-0 px-0">
                  The Tenant shall not belong to any occultic group/association
                  or secret society. Only Christianity and Islam are permitted
                  to be practiced.
                </li>

                <li class="list-group-item border-0 px-0">
                  Quarterly inspections will be conducted at reasonable hours.
                  Any damage must be fixed within 2-4 weeks.
                </li>

                <li class="list-group-item border-0 px-0">
                  Failure to repair damage will result in cost deduction from
                  rent and reduced rent tenure.
                </li>

                <li class="list-group-item border-0 px-0">
                  Unreported or unrepaired damage leads to tenancy termination
                  and eviction without refund.
                </li>

                <li class="list-group-item border-0 px-0">
                  Only authorized personnel may operate the generating set.
                  Generator runs 7:30pm to 9:30pm daily.
                </li>

                <li class="list-group-item border-0 px-0">
                  Tenants shall share generator running and maintenance costs
                  equally, paid monthly.
                </li>

                <li class="list-group-item border-0 px-0">
                  Only provided facilities may be connected to the generator. No
                  ironing with the inverter.
                </li>

                <li class="list-group-item border-0 px-0">
                  The tenant shall not make noise or constitute nuisance in the
                  hostel environment.
                </li>

                <li class="list-group-item border-0 px-0">
                  Clothes and personal items shall only be spread in designated
                  areas.
                </li>

                <li class="list-group-item border-0 px-0">
                  The apartment interior must be kept in good and tenantable
                  condition.
                </li>

                <li class="list-group-item border-0 px-0">
                  The apartment is strictly for residential purposes only - no
                  illegal, immoral or improper use.
                </li>

                <li class="list-group-item border-0 px-0">
                  Maximum occupancy is eight (8) persons per apartment. No
                  overcrowding allowed.
                </li>

                <li class="list-group-item border-0 px-0">
                  No subleasing, assignment, transfer or use as collateral is
                  permitted.
                </li>

                <li class="list-group-item border-0 px-0">
                  Tenant shall maintain proper cleanliness and bear entire
                  maintenance costs.
                </li>

                <li class="list-group-item border-0 px-0">
                  No alterations without prior written approval from the
                  Landlord.
                </li>

                <li class="list-group-item border-0 px-0">
                  Cooking gas (if any) must be kept in the kitchen only for
                  safety purposes.
                </li>

                <li class="list-group-item border-0 px-0">
                  Heaters, boiling rings, hot plates and high-consumption
                  electrical appliances are prohibited.
                </li>

                <li class="list-group-item border-0 px-0">
                  Landlord consent must be sought before any structural
                  amendments or alterations.
                </li>

                <li class="list-group-item border-0 px-0">
                  Tenant acknowledges the hostel is in good condition suitable
                  for residence before taking possession.
                </li>

                <li class="list-group-item border-0 px-0">
                  Rent may be increased at Management's discretion.
                </li>

                <li class="list-group-item border-0 px-0">
                  Landlord's withheld consent/authority on any issue is final.
                  Violation automatically terminates tenancy.
                </li>

                <li class="list-group-item border-0 px-0">
                  Tenant is responsible for any damaged or lost apartment parts.
                  Landlord may take legal action for recovery.
                </li>

                <li class="list-group-item border-0 px-0">
                  Any breach of covenants/conditions/terms will be treated as
                  notice to quit with eviction within two weeks without refund.
                </li>
              </ol>
            </div>
          </div>

          <!-- Agreement Checkbox -->
          <div class="mt-4 p-3 bg-light rounded">
            <div class="form-check">
              <input
                class="form-check-input"
                :class="{ 'is-invalid': errors.agreeToTerms }"
                type="checkbox"
                id="agreeToTerms"
                v-model="formData.agreeToTerms"
              />
              <label class="form-check-label fw-bold" for="agreeToTerms">
                I have read, understood, and agree to all the terms and
                conditions of this tenancy agreement. This serves as my
                electronic signature and consent to the agreement.
                <span class="text-danger">*</span>
              </label>
              <div v-if="errors.agreeToTerms" class="invalid-feedback d-block">
                {{ errors.agreeToTerms }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Submit Button -->
      <div class="card border-0 shadow-sm">
        <div class="card-body text-center py-4">
          <button
            type="button"
            class="btn btn-primary btn-lg px-5"
            :disabled="!isFormValid || isSubmitting"
            @click="submitAgreement"
          >
            <span
              v-if="isSubmitting"
              class="spinner-border spinner-border-sm me-2"
            ></span>
            <i v-else class="bi bi-pen me-2"></i>
            {{ isSubmitting ? "Submitting Agreement..." : "Sign Agreement" }}
          </button>
          <p class="text-muted mt-3 mb-0">
            By clicking "Sign Agreement", you confirm that all information
            provided is accurate and you agree to be bound by the terms of this
            tenancy agreement.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tenancy-agreement {
  max-width: 1200px;
  margin: 0 auto;
}

.terms-content {
  font-size: 0.95rem;
  line-height: 1.6;
}

.list-group-item {
  padding: 0.75rem 0;
  border-bottom: 1px solid #dee2e6 !important;
}

.list-group-item:last-child {
  border-bottom: none !important;
}

.form-check-label {
  font-size: 0.95rem;
  line-height: 1.5;
}

.card-header h5 {
  font-weight: 600;
}

.badge {
  font-size: 0.875rem;
}

@media (max-width: 768px) {
  .tenancy-agreement {
    padding: 1rem !important;
  }

  .terms-content {
    max-height: 300px;
  }

  .list-group-item {
    font-size: 0.875rem;
  }
}
</style>

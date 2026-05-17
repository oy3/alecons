<script>
import { apiService } from "../../../services/api.js";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";

export default {
  name: "Payments",
  data() {
    return {
      allPayments: [], // Store all payments from server
      payments: [], // Displayed payments after filtering
      destinationAccounts: [],
      isLoading: true,
      searchQuery: "",
      currentPage: 1,
      perPage: 10,
      showDestinationAccountsModal: false,
    };
  },
  computed: {
    filteredPayments() {
      if (!this.searchQuery) return this.allPayments;

      return this.allPayments.filter(
        (payment) =>
          payment.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
          (payment.description &&
            payment.description
              .toLowerCase()
              .includes(this.searchQuery.toLowerCase())) ||
          (payment.paymentCode &&
            payment.paymentCode
              .toLowerCase()
              .includes(this.searchQuery.toLowerCase())) ||
          payment.amount.toString().includes(this.searchQuery),
      );
    },

    paginatedPayments() {
      const start = (this.currentPage - 1) * this.perPage;
      const end = start + this.perPage;
      return this.filteredPayments.slice(start, end);
    },

    totalPages() {
      return Math.ceil(this.filteredPayments.length / this.perPage);
    },

    visiblePages() {
      const pages = [];
      const start = Math.max(1, this.currentPage - 2);
      const end = Math.min(this.totalPages, this.currentPage + 2);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      return pages;
    },
  },
  watch: {
    searchQuery() {
      this.currentPage = 1;
    },
  },
  async mounted() {
    await Promise.all([this.loadPayments(), this.loadDestinationAccounts()]);
  },
  methods: {
    async loadPayments() {
      try {
        this.isLoading = true;
        logger.info("Loading payments...");

        // Load all payments at once (no pagination for simplicity)
        const response = await apiService.getPayments({
          limit: 1000, // Load all payments
        });

        logger.info("API Response:", response);

        if (response.success) {
          this.allPayments = response.data.payments.map((payment) => ({
            id: payment.id,
            name: payment.name,
            description: payment.description,
            amount: payment.amount,
            isActive: payment.isActive,
            paymentCode: payment.paymentCode,
            targetAudience: payment.targetAudience,
            paystackDestinationAccount:
              payment.paystackDestinationAccount || null,
            manualTransferDestinationAccount:
              payment.manualTransferDestinationAccount || null,
            paystackDestinationAccountId:
              payment.paystackDestinationAccountId || null,
            manualTransferDestinationAccountId:
              payment.manualTransferDestinationAccountId || null,
            createdAt: new Date(payment.createdAt),
            updatedAt: new Date(payment.updatedAt),
          }));

          logger.info(`Loaded ${this.allPayments.length} payments`);
          logger.info("All payments loaded:", this.allPayments);
        } else {
          throw new Error(response.message || "Failed to load payments");
        }
      } catch (error) {
        logger.error("Error loading payments:", error);
        logger.error("Full error details:", error);

        // Show more detailed error information
        let errorMessage = "Failed to load payments. Please try again.";
        if (error.message.includes("Unauthorized")) {
          errorMessage =
            "You are not authorized to view payments. Please check your permissions.";
        } else if (error.message.includes("Network")) {
          errorMessage = "Network error. Please check your connection.";
        }

        // For now, add some fallback data so we can test the UI
        logger.warn("Using fallback payment data for testing");
        this.allPayments = [
          {
            id: 1,
            name: "Application Fee",
            description: "Fee for submitting university application",
            amount: 25000,
            isActive: true,
            paymentCode: "APP_FEE",
            paystackDestinationAccount: null,
            manualTransferDestinationAccount: null,
            createdAt: new Date("2024-01-15"),
          },
          {
            id: 2,
            name: "Tuition Fee - Semester 1",
            description: "First semester tuition payment",
            amount: 350000,
            isActive: true,
            paymentCode: "TUITION_S1",
            paystackDestinationAccount: null,
            manualTransferDestinationAccount: null,
            createdAt: new Date("2024-01-20"),
          },
          {
            id: 3,
            name: "Library Fee",
            description: "Annual library access and maintenance fee",
            amount: 15000,
            isActive: true,
            paymentCode: "LIBRARY_FEE",
            paystackDestinationAccount: null,
            manualTransferDestinationAccount: null,
            createdAt: new Date("2024-01-25"),
          },
        ];

        Swal.fire({
          title: "Warning!",
          text: errorMessage + " (Using sample data for now)",
          icon: "warning",
          confirmButtonText: "OK",
          confirmButtonColor: "#ffc107",
        });
      } finally {
        this.isLoading = false;
      }
    },

    async loadDestinationAccounts() {
      try {
        const response = await apiService.getPaymentDestinationAccounts();

        if (response.success) {
          this.destinationAccounts = response.data || [];
        } else {
          throw new Error(
            response.message || "Failed to load destination accounts",
          );
        }
      } catch (error) {
        logger.error("Error loading destination accounts:", error);
        this.destinationAccounts = [];
      }
    },

    getDestinationAccountsByChannel(channelType) {
      return this.destinationAccounts.filter(
        (account) => account.channelType === channelType,
      );
    },

    buildDestinationOptions(channelType, selectedId = "") {
      const accounts = this.getDestinationAccountsByChannel(channelType);
      const emptyLabel =
        channelType === "paystack"
          ? "Default main Paystack account"
          : "Default manual transfer account / env fallback";

      const options = [`<option value="">${emptyLabel}</option>`];

      accounts.forEach((account) => {
        const selected =
          selectedId && selectedId === account.id ? "selected" : "";
        const badge = account.isDefault ? " (Default)" : "";
        options.push(
          `<option value="${account.id}" ${selected}>${account.title} - ${account.code}${badge}</option>`,
        );
      });

      return options.join("");
    },

    formatDestinationAccount(account, emptyLabel) {
      if (!account) {
        return emptyLabel;
      }

      // return `${account.title} (${account.code})`;
      return `${account.title}`;
    },

    async showAddPaymentModal() {
      const { value: formValues } = await Swal.fire({
        title: "Add New Payment",
        html: `
          <div class="row g-3 text-start">
            <div class="col-12">
              <label for="swal-payment-name" class="form-label">Payment Name</label>
              <input id="swal-payment-name" class="form-control" placeholder="e.g., Application Fee" required>
            </div>
            <div class="col-12">
              <label for="swal-payment-code" class="form-label">Payment Code</label>
              <input id="swal-payment-code" class="form-control" placeholder="e.g., formFee" required>
              <div class="form-text">Unique code to identify this payment type</div>
            </div>
            <div class="col-12">
              <label for="swal-payment-description" class="form-label">Description</label>
              <textarea id="swal-payment-description" class="form-control" placeholder="Brief description of the payment" rows="3"></textarea>
            </div>
            <div class="col-12">
              <label for="swal-payment-amount" class="form-label">Amount (₦)</label>
              <input id="swal-payment-amount" class="form-control" type="number" placeholder="0.00" min="0" step="0.01" required>
            </div>
            <div class="col-12">
              <label for="swal-target-audience" class="form-label">Target Audience</label>
              <select id="swal-target-audience" class="form-select" multiple required>
                <option value="applicant">Applicant</option>
                <option value="student">Student</option>
                <option value="academic_staff">Academic Staff</option>
                <option value="admin_staff">Admin Staff</option>
              </select>
              <div class="form-text">Hold Ctrl/Cmd to select multiple audiences</div>
            </div>
            <div class="col-md-6">
              <label for="swal-paystack-destination" class="form-label">Paystack Destination</label>
              <select id="swal-paystack-destination" class="form-select">
                ${this.buildDestinationOptions("paystack")}
              </select>
            </div>
            <div class="col-md-6">
              <label for="swal-manual-destination" class="form-label">Manual Transfer Destination</label>
              <select id="swal-manual-destination" class="form-select">
                ${this.buildDestinationOptions("manual_transfer")}
              </select>
            </div>
            <div class="col-12">
              <div class="form-check text-start">
                <input id="swal-payment-active" class="form-check-input" type="checkbox" checked>
                <label for="swal-payment-active" class="form-check-label">
                  Set as active
                </label>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Create Payment",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#198754",
        cancelButtonColor: "#6c757d",
        preConfirm: () => {
          const name = document.getElementById("swal-payment-name").value;
          const paymentCode =
            document.getElementById("swal-payment-code").value;
          const description = document.getElementById(
            "swal-payment-description",
          ).value;
          const amount = document.getElementById("swal-payment-amount").value;
          const isActive = document.getElementById(
            "swal-payment-active",
          ).checked;
          const audienceSelect = document.getElementById(
            "swal-target-audience",
          );
          const targetAudience = Array.from(audienceSelect.selectedOptions).map(
            (option) => option.value,
          );
          const paystackDestinationAccountId =
            document.getElementById("swal-paystack-destination").value || null;
          const manualTransferDestinationAccountId =
            document.getElementById("swal-manual-destination").value || null;

          if (!name || !paymentCode || !amount) {
            Swal.showValidationMessage("Please fill in all required fields");
            return false;
          }

          if (targetAudience.length === 0) {
            Swal.showValidationMessage(
              "Please select at least one target audience",
            );
            return false;
          }

          // Validate payment code format (alphanumeric only)
          const codePattern = /^[A-Za-z0-9]+$/;
          if (!codePattern.test(paymentCode)) {
            Swal.showValidationMessage(
              "Payment code should contain only letters and numbers (no spaces or special characters)",
            );
            return false;
          }

          if (parseFloat(amount) < 0) {
            Swal.showValidationMessage("Amount cannot be negative");
            return false;
          }

          return {
            name,
            paymentCode,
            description,
            amount: parseFloat(amount),
            isActive,
            targetAudience,
            paystackDestinationAccountId,
            manualTransferDestinationAccountId,
          };
        },
      });

      if (formValues) {
        await this.createPayment(formValues);
      }
    },

    async createPayment(paymentData) {
      try {
        logger.info("Creating payment:", paymentData);

        const response = await apiService.createPayment(paymentData);

        if (response.success) {
          // Reload payments to get updated list
          await this.loadPayments();

          Swal.fire({
            title: "Success!",
            text: "Payment created successfully.",
            icon: "success",
            confirmButtonText: "OK",
            confirmButtonColor: "#198754",
          });

          logger.info("Payment created successfully");
        } else {
          throw new Error(response.message || "Failed to create payment");
        }
      } catch (error) {
        logger.error("Error creating payment:", error);

        let errorMessage = "Failed to create payment. Please try again.";
        if (error.message.includes("already exists")) {
          errorMessage = "A payment with this name already exists.";
        }

        Swal.fire({
          title: "Error!",
          text: errorMessage,
          icon: "error",
          confirmButtonText: "OK",
          confirmButtonColor: "#dc3545",
        });
      }
    },

    async editPayment(payment) {
      const { value: formValues } = await Swal.fire({
        title: "Edit Payment",
        html: `
          <div class="row g-3 text-start">
            <div class="col-12">
              <label for="swal-edit-name" class="form-label">Payment Name</label>
              <input id="swal-edit-name" class="form-control" value="${payment.name}" required>
            </div>
            <div class="col-12">
              <label for="swal-edit-code" class="form-label">Payment Code</label>
              <input id="swal-edit-code" class="form-control" value="${payment.paymentCode || ""}" required>
              <div class="form-text">Unique code to identify this payment type</div>
            </div>
            <div class="col-12">
              <label for="swal-edit-description" class="form-label">Description</label>
              <textarea id="swal-edit-description" class="form-control" rows="3">${payment.description || ""}</textarea>
            </div>
            <div class="col-12">
              <label for="swal-edit-amount" class="form-label">Amount (₦)</label>
              <input id="swal-edit-amount" class="form-control" type="number" value="${payment.amount}" min="0" step="0.01" required>
            </div>
            <div class="col-12">
              <label for="swal-edit-target-audience" class="form-label">Target Audience</label>
              <select id="swal-edit-target-audience" class="form-select" multiple required>
                <option value="applicant" ${payment.targetAudience?.includes("applicant") ? "selected" : ""}>Applicant</option>
                <option value="student" ${payment.targetAudience?.includes("student") ? "selected" : ""}>Student</option>
                <option value="academic_staff" ${payment.targetAudience?.includes("academic_staff") ? "selected" : ""}>Academic Staff</option>
                <option value="admin_staff" ${payment.targetAudience?.includes("admin_staff") ? "selected" : ""}>Admin Staff</option>
              </select>
              <div class="form-text">Hold Ctrl/Cmd to select multiple audiences</div>
            </div>
            <div class="col-md-6">
              <label for="swal-edit-paystack-destination" class="form-label">Paystack Destination</label>
              <select id="swal-edit-paystack-destination" class="form-select">
                ${this.buildDestinationOptions("paystack", payment.paystackDestinationAccountId || "")}
              </select>
            </div>
            <div class="col-md-6">
              <label for="swal-edit-manual-destination" class="form-label">Manual Transfer Destination</label>
              <select id="swal-edit-manual-destination" class="form-select">
                ${this.buildDestinationOptions("manual_transfer", payment.manualTransferDestinationAccountId || "")}
              </select>
            </div>
            <div class="col-12">
              <div class="form-check text-start">
                <input id="swal-edit-active" class="form-check-input" type="checkbox" ${payment.isActive ? "checked" : ""}>
                <label for="swal-edit-active" class="form-check-label">
                  Set as active
                </label>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Update Payment",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#198754",
        cancelButtonColor: "#6c757d",
        didOpen: () => {
          // Manually set the selected options after the modal opens
          const targetAudienceSelect = document.getElementById(
            "swal-edit-target-audience",
          );
          if (targetAudienceSelect && payment.targetAudience) {
            Array.from(targetAudienceSelect.options).forEach((option) => {
              option.selected = payment.targetAudience.includes(option.value);
            });
          }
        },
        preConfirm: () => {
          const name = document.getElementById("swal-edit-name").value;
          const paymentCode = document.getElementById("swal-edit-code").value;
          const description = document.getElementById(
            "swal-edit-description",
          ).value;
          const amount = document.getElementById("swal-edit-amount").value;
          const isActive = document.getElementById("swal-edit-active").checked;
          const audienceSelect = document.getElementById(
            "swal-edit-target-audience",
          );
          const targetAudience = Array.from(audienceSelect.selectedOptions).map(
            (option) => option.value,
          );
          const paystackDestinationAccountId =
            document.getElementById("swal-edit-paystack-destination").value ||
            null;
          const manualTransferDestinationAccountId =
            document.getElementById("swal-edit-manual-destination").value ||
            null;

          if (!name || !paymentCode || !amount) {
            Swal.showValidationMessage("Please fill in all required fields");
            return false;
          }

          if (targetAudience.length === 0) {
            Swal.showValidationMessage(
              "Please select at least one target audience",
            );
            return false;
          }

          // Validate payment code format (alphanumeric only)
          const codePattern = /^[A-Za-z0-9]+$/;
          if (!codePattern.test(paymentCode)) {
            Swal.showValidationMessage(
              "Payment code should contain only letters and numbers (no spaces or special characters)",
            );
            return false;
          }

          if (parseFloat(amount) < 0) {
            Swal.showValidationMessage("Amount cannot be negative");
            return false;
          }

          return {
            name,
            paymentCode,
            description,
            amount: parseFloat(amount),
            isActive,
            targetAudience,
            paystackDestinationAccountId,
            manualTransferDestinationAccountId,
          };
        },
      });

      if (formValues) {
        await this.updatePayment(payment.id, formValues);
      }
    },

    async updatePayment(paymentId, updateData) {
      try {
        logger.info("Updating payment:", paymentId, updateData);

        const response = await apiService.updatePayment(paymentId, updateData);

        if (response.success) {
          // Reload payments to get updated list
          await this.loadPayments();

          Swal.fire({
            title: "Success!",
            text: "Payment updated successfully.",
            icon: "success",
            confirmButtonText: "OK",
            confirmButtonColor: "#198754",
          });

          logger.info("Payment updated successfully");
        } else {
          throw new Error(response.message || "Failed to update payment");
        }
      } catch (error) {
        logger.error("Error updating payment:", error);

        let errorMessage = "Failed to update payment. Please try again.";
        if (error.message.includes("already exists")) {
          errorMessage = "A payment with this name already exists.";
        }

        Swal.fire({
          title: "Error!",
          text: errorMessage,
          icon: "error",
          confirmButtonText: "OK",
          confirmButtonColor: "#dc3545",
        });
      }
    },

    async togglePaymentStatus(payment) {
      const action = payment.isActive ? "deactivate" : "activate";

      const result = await Swal.fire({
        title: `${action.charAt(0).toUpperCase() + action.slice(1)} Payment?`,
        text: `Are you sure you want to ${action} "${payment.name}"?`,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: `Yes, ${action}`,
        cancelButtonText: "Cancel",
        confirmButtonColor: payment.isActive ? "#ffc107" : "#198754",
        cancelButtonColor: "#6c757d",
      });

      if (result.isConfirmed) {
        try {
          logger.info(`${action}ing payment:`, payment.id);

          const response = await apiService.togglePaymentStatus(payment.id);

          if (response.success) {
            // Reload payments to get updated list
            await this.loadPayments();

            Swal.fire({
              title: "Success!",
              text: `Payment ${action}d successfully.`,
              icon: "success",
              confirmButtonText: "OK",
              confirmButtonColor: "#198754",
            });

            logger.info(`Payment ${action}d successfully`);
          } else {
            throw new Error(response.message || `Failed to ${action} payment`);
          }
        } catch (error) {
          logger.error(`Error ${action}ing payment:`, error);
          Swal.fire({
            title: "Error!",
            text: `Failed to ${action} payment. Please try again.`,
            icon: "error",
            confirmButtonText: "OK",
            confirmButtonColor: "#dc3545",
          });
        }
      }
    },

    async deletePayment(payment) {
      const result = await Swal.fire({
        title: "Delete Payment?",
        text: `Are you sure you want to delete "${payment.name}"? This action cannot be undone.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, delete",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#dc3545",
        cancelButtonColor: "#6c757d",
      });

      if (result.isConfirmed) {
        try {
          logger.info("Deleting payment:", payment.id);

          const response = await apiService.deletePayment(payment.id);

          if (response.success) {
            // Reload payments to get updated list
            await this.loadPayments();

            Swal.fire({
              title: "Deleted!",
              text: "Payment deleted successfully.",
              icon: "success",
              confirmButtonText: "OK",
              confirmButtonColor: "#198754",
            });

            logger.info("Payment deleted successfully");
          } else {
            throw new Error(response.message || "Failed to delete payment");
          }
        } catch (error) {
          logger.error("Error deleting payment:", error);

          let errorMessage = "Failed to delete payment. Please try again.";
          if (error.message.includes("been used by students")) {
            errorMessage =
              "Cannot delete payment that has been used by students.";
          }

          Swal.fire({
            title: "Error!",
            text: errorMessage,
            icon: "error",
            confirmButtonText: "OK",
            confirmButtonColor: "#dc3545",
          });
        }
      }
    },

    openDestinationAccountsModal() {
      this.showDestinationAccountsModal = true;
    },

    closeDestinationAccountsModal() {
      this.showDestinationAccountsModal = false;
    },

    async showDestinationAccountForm(account = null) {
      const isEdit = !!account;
      const { value: formValues } = await Swal.fire({
        title: isEdit ? "Edit Destination Account" : "Add Destination Account",
        width: "780px",
        customClass: {
          popup: "destination-account-swal-popup",
          htmlContainer: "destination-account-swal-html",
        },
        html: `
          <div class="text-start">
            <div class="alert alert-light border small mb-3">
              <div class="fw-semibold mb-2">Example values</div>
              <div><strong>Main Paystack account:</strong> Title = Main Revenue Account, Code = MAIN_PAYSTACK, Channel = Paystack, Provider = Main</div>
              <div><strong>Accommodation Paystack subaccount:</strong> Title = Accommodation Account, Code = ACCOMMODATION_PAYSTACK, Channel = Paystack, Provider = Subaccount, Paystack Subaccount Code = ACCT_8f3sdfk0kdl</div>
              <div><strong>Manual transfer account:</strong> Title = Accommodation Manual Account, Code = ACCOMMODATION_MANUAL, Channel = Manual Transfer, Provider = Bank Account, Account Name = Alecons Accommodation, Bank Name = Wema Bank, Account Number = 0123456789</div>
            </div>
            <div class="row g-3 text-start">
            <div class="col-md-6">
              <label for="swal-destination-title" class="form-label">Title</label>
              <input id="swal-destination-title" class="form-control" value="${account?.title || ""}" placeholder="e.g. Accommodation Account" required>
              <div class="form-text">Friendly name staff will see when assigning payment routes.</div>
            </div>
            <div class="col-md-6">
              <label for="swal-destination-code" class="form-label">Code</label>
              <input id="swal-destination-code" class="form-control" value="${account?.code || ""}" placeholder="e.g. ACCOMMODATION_PAYSTACK" required>
              <div class="form-text">Internal unique code used to identify this destination account.</div>
            </div>
            <div class="col-md-6">
              <label for="swal-destination-channel" class="form-label">Channel</label>
              <select id="swal-destination-channel" class="form-select">
                <option value="paystack" ${account?.channelType === "paystack" ? "selected" : ""}>Paystack</option>
                <option value="manual_transfer" ${account?.channelType === "manual_transfer" ? "selected" : ""}>Manual Transfer</option>
              </select>
              <div class="form-text">Choose how this destination account will be used.</div>
            </div>
            <div class="col-md-6">
              <label for="swal-destination-provider" class="form-label">Provider Type</label>
              <select id="swal-destination-provider" class="form-select">
                <option value="main" ${account?.providerType === "main" ? "selected" : ""}>Main</option>
                <option value="subaccount" ${account?.providerType === "subaccount" ? "selected" : ""}>Subaccount</option>
                <option value="bank_account" ${account?.providerType === "bank_account" ? "selected" : ""}>Bank Account</option>
              </select>
              <div class="form-text">Use <strong>Main</strong> for default Paystack settlement, <strong>Subaccount</strong> for Paystack subaccounts, and <strong>Bank Account</strong> for manual transfers.</div>
            </div>
            <div class="col-md-6">
              <label for="swal-destination-account-name" class="form-label">Account Name</label>
              <input id="swal-destination-account-name" class="form-control" value="${account?.accountName || ""}" placeholder="e.g. Alecons Accommodation Account">
            </div>
            <div class="col-md-6">
              <label for="swal-destination-bank-name" class="form-label">Bank Name</label>
              <input id="swal-destination-bank-name" class="form-control" value="${account?.bankName || ""}" placeholder="e.g. Wema Bank">
            </div>
            <div class="col-md-6">
              <label for="swal-destination-account-number" class="form-label">Account Number</label>
              <input id="swal-destination-account-number" class="form-control" value="${account?.accountNumber || ""}" placeholder="e.g. 0123456789">
            </div>
            <div class="col-md-6">
              <label for="swal-destination-subaccount" class="form-label">Paystack Subaccount Code</label>
              <input id="swal-destination-subaccount" class="form-control" value="${account?.paystackSubaccountCode || ""}" placeholder="e.g. ACCT_8f3sdfk0kdl">
              <div class="form-text">Required only when Channel = Paystack and Provider Type = Subaccount.</div>
            </div>
            <div class="col-12">
              <label for="swal-destination-note" class="form-label">Note</label>
              <textarea id="swal-destination-note" class="form-control" rows="3" placeholder="e.g. Use this account for accommodation-related payments only">${account?.note || ""}</textarea>
            </div>
            <div class="col-md-6">
              <div class="form-check mt-2">
                <input id="swal-destination-default" class="form-check-input" type="checkbox" ${account?.isDefault ? "checked" : ""}>
                <label for="swal-destination-default" class="form-check-label">Set as default for this channel</label>
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-check mt-2">
                <input id="swal-destination-active" class="form-check-input" type="checkbox" ${account?.active !== false ? "checked" : ""}>
                <label for="swal-destination-active" class="form-check-label">Active</label>
              </div>
            </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: isEdit ? "Update Account" : "Create Account",
        confirmButtonColor: "#198754",
        cancelButtonColor: "#6c757d",
        preConfirm: () => {
          const title = document
            .getElementById("swal-destination-title")
            .value.trim();
          const code = document
            .getElementById("swal-destination-code")
            .value.trim()
            .toUpperCase();
          const channelType = document.getElementById(
            "swal-destination-channel",
          ).value;
          const providerType = document.getElementById(
            "swal-destination-provider",
          ).value;
          const accountName = document
            .getElementById("swal-destination-account-name")
            .value.trim();
          const bankName = document
            .getElementById("swal-destination-bank-name")
            .value.trim();
          const accountNumber = document
            .getElementById("swal-destination-account-number")
            .value.trim();
          const paystackSubaccountCode = document
            .getElementById("swal-destination-subaccount")
            .value.trim();
          const note = document
            .getElementById("swal-destination-note")
            .value.trim();
          const isDefault = document.getElementById(
            "swal-destination-default",
          ).checked;
          const active = document.getElementById(
            "swal-destination-active",
          ).checked;

          if (!title || !code) {
            Swal.showValidationMessage("Title and code are required");
            return false;
          }

          if (
            channelType === "manual_transfer" &&
            (!accountName || !bankName || !accountNumber)
          ) {
            Swal.showValidationMessage(
              "Manual transfer accounts require account name, bank name, and account number",
            );
            return false;
          }

          if (
            channelType === "paystack" &&
            providerType === "subaccount" &&
            !paystackSubaccountCode
          ) {
            Swal.showValidationMessage(
              "Paystack subaccount code is required for paystack subaccounts",
            );
            return false;
          }

          return {
            title,
            code,
            channelType,
            providerType,
            accountName,
            bankName,
            accountNumber,
            paystackSubaccountCode,
            note,
            isDefault,
            active,
          };
        },
      });

      if (!formValues) return;

      try {
        const response = isEdit
          ? await apiService.updatePaymentDestinationAccount(
              account.id,
              formValues,
            )
          : await apiService.createPaymentDestinationAccount(formValues);

        if (!response.success) {
          throw new Error(
            response.message ||
              `Failed to ${isEdit ? "update" : "create"} destination account`,
          );
        }

        await Promise.all([
          this.loadDestinationAccounts(),
          this.loadPayments(),
        ]);

        Swal.fire({
          title: "Success!",
          text: `Destination account ${isEdit ? "updated" : "created"} successfully.`,
          icon: "success",
          confirmButtonColor: "#198754",
        });
      } catch (error) {
        logger.error("Error saving destination account:", error);
        Swal.fire({
          title: "Error!",
          text: error.message || "Failed to save destination account.",
          icon: "error",
          confirmButtonColor: "#dc3545",
        });
      }
    },

    async deleteDestinationAccount(account) {
      const result = await Swal.fire({
        title: "Delete Destination Account?",
        text: `Are you sure you want to delete "${account.title}"?`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Yes, delete",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#dc3545",
        cancelButtonColor: "#6c757d",
      });

      if (!result.isConfirmed) return;

      try {
        const response = await apiService.deletePaymentDestinationAccount(
          account.id,
        );
        if (!response.success) {
          throw new Error(
            response.message || "Failed to delete destination account",
          );
        }

        await Promise.all([
          this.loadDestinationAccounts(),
          this.loadPayments(),
        ]);
        Swal.fire({
          title: "Deleted!",
          text: "Destination account deleted successfully.",
          icon: "success",
          confirmButtonColor: "#198754",
        });
      } catch (error) {
        logger.error("Error deleting destination account:", error);
        Swal.fire({
          title: "Error!",
          text: error.message || "Failed to delete destination account.",
          icon: "error",
          confirmButtonColor: "#dc3545",
        });
      }
    },

    formatAmount(amount) {
      return new Intl.NumberFormat("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amount);
    },

    formatAudienceLabel(audience) {
      const labels = {
        applicant: "Applicant",
        student: "Student",
        academic_staff: "Academic Staff",
        admin_staff: "Admin Staff",
      };
      return labels[audience] || audience;
    },

    getAudienceBadgeClass(audience) {
      const classes = {
        applicant: "bg-primary",
        student: "bg-success",
        academic_staff: "bg-info",
        admin_staff: "bg-warning text-dark",
      };
      return classes[audience] || "bg-secondary";
    },
  },
};
</script>

<template>
  <div>
    <!-- Search and Add Button -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body">
            <div class="row g-3 align-items-end">
              <div class="col-md-6">
                <label class="form-label">Search Payments</label>
                <input
                  v-model="searchQuery"
                  type="text"
                  class="form-control"
                  placeholder="Search by payment name, code, description, or amount..."
                />
              </div>
              <div class="col-md-4">
                <button
                  class="btn btn-staff-primary w-100"
                  @click="showAddPaymentModal"
                >
                  <i class="bi bi-plus-circle me-2"></i>Add New Payment
                </button>
              </div>
              <div class="col-md-2">
                <button
                  class="btn btn-outline-staff-primary w-100"
                  @click="openDestinationAccountsModal"
                >
                  <i class="bi bi-diagram-3 me-2"></i>Accounts
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="text-center py-5">
      <div class="spinner-border text-staff-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-3 text-muted">Loading payments...</p>
    </div>

    <!-- Payments Table -->
    <div v-else class="row">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <th>Payment Name</th>
                    <!-- <th>Payment Code</th> -->
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Paystack Route</th>
                    <th>Manual Route</th>
                    <th>Target</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="payment in paginatedPayments" :key="payment.id">
                    <td>
                      <div class="fw-semibold">{{ payment.name }}</div>
                    </td>
                    <!-- <td>
                      <code class="text-primary">{{ payment.paymentCode || 'N/A' }}</code>
                    </td> -->
                    <td>
                      <div class="text-muted">
                        {{ payment.description || "No description" }}
                      </div>
                    </td>
                    <td>
                      <div class="fw-semibold text-success">
                        ₦{{ formatAmount(payment.amount) }}
                      </div>
                    </td>
                    <td>
                      <small class="text-muted d-block">
                        {{
                          formatDestinationAccount(
                            payment.paystackDestinationAccount,
                            "Main / Default account",
                          )
                        }}
                      </small>
                    </td>
                    <td>
                      <small class="text-muted d-block">
                        {{
                          formatDestinationAccount(
                            payment.manualTransferDestinationAccount,
                            "Default / Env fallback",
                          )
                        }}
                      </small>
                    </td>
                    <td>
                      <div class="d-flex flex-wrap gap-1">
                        <span
                          v-for="audience in payment.targetAudience || [
                            'applicant',
                          ]"
                          :key="audience"
                          class="badge"
                          :class="getAudienceBadgeClass(audience)"
                        >
                          {{ formatAudienceLabel(audience) }}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span
                        :class="
                          payment.isActive
                            ? 'badge bg-success'
                            : 'badge bg-danger'
                        "
                      >
                        {{ payment.isActive ? "Active" : "Inactive" }}
                      </span>
                    </td>
                    <td>
                      <div class="dropdown">
                        <a
                          class="btn btn-link text-dark dropdown-toggle no-caret"
                          href="#"
                          role="button"
                          data-bs-toggle="dropdown"
                          aria-expanded="false"
                        >
                          <i class="bi bi-three-dots-vertical"></i>
                        </a>

                        <ul class="dropdown-menu">
                          <li>
                            <a
                              class="dropdown-item"
                              :class="
                                payment.isActive
                                  ? 'text-success'
                                  : 'text-warning'
                              "
                              href="#"
                              @click.prevent="togglePaymentStatus(payment)"
                            >
                              <i
                                :class="
                                  payment.isActive
                                    ? 'bi bi-toggle-on'
                                    : 'bi bi-toggle-off'
                                "
                              ></i>
                              {{ payment.isActive ? "Deactivate" : "Activate" }}
                            </a>
                          </li>
                          <li>
                            <a
                              class="dropdown-item"
                              href="#"
                              @click.prevent="editPayment(payment)"
                            >
                              <i class="bi bi-pencil"></i> Edit
                            </a>
                          </li>
                          <li>
                            <a
                              class="dropdown-item text-danger"
                              href="#"
                              @click.prevent="deletePayment(payment)"
                            >
                              <i class="bi bi-trash"></i> Delete
                            </a>
                          </li>
                        </ul>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="paginatedPayments.length === 0">
                    <td colspan="9" class="text-center py-4 text-muted">
                      <i class="bi bi-credit-card display-6 d-block mb-2"></i>
                      {{
                        searchQuery
                          ? "No payments found matching your search."
                          : "No payments available. Create one to get started."
                      }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Pagination -->
    <div v-if="totalPages > 0" class="row mt-4">
      <div class="col-12">
        <nav aria-label="Payments pagination">
          <ul class="pagination pagination-sm justify-content-center mb-0">
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <button
                class="page-link"
                @click="currentPage = 1"
                :disabled="currentPage === 1"
              >
                <<
              </button>
            </li>
            <li class="page-item" :class="{ disabled: currentPage === 1 }">
              <button
                class="page-link"
                @click="currentPage--"
                :disabled="currentPage === 1"
              >
                <
              </button>
            </li>
            <li
              v-for="page in visiblePages"
              :key="page"
              class="page-item"
              :class="{ active: page === currentPage }"
            >
              <button class="page-link text-white" @click="currentPage = page">
                {{ page }}
              </button>
            </li>
            <li
              class="page-item"
              :class="{ disabled: currentPage === totalPages }"
            >
              <button
                class="page-link"
                @click="currentPage++"
                :disabled="currentPage === totalPages"
              >
                >
              </button>
            </li>
            <li
              class="page-item"
              :class="{ disabled: currentPage === totalPages }"
            >
              <button
                class="page-link"
                @click="currentPage = totalPages"
                :disabled="currentPage === totalPages"
              >
                >>
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>

    <div
      class="modal fade"
      :class="{ show: showDestinationAccountsModal }"
      :style="{ display: showDestinationAccountsModal ? 'block' : 'none' }"
      tabindex="-1"
      aria-hidden="true"
    >
      <div
        class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable"
      >
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-diagram-3 me-2 text-staff-primary"></i>
              Payment Destination Accounts
            </h5>
            <button
              type="button"
              class="btn-close"
              @click="closeDestinationAccountsModal"
            ></button>
          </div>
          <div class="modal-body">
            <div
              class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"
            >
              <p class="text-muted mb-0">
                Manage Paystack and manual transfer destination accounts used by
                each payment.
              </p>
              <button
                class="btn btn-staff-primary"
                @click="showDestinationAccountForm()"
              >
                <i class="bi bi-plus-circle me-2"></i>Add Destination Account
              </button>
            </div>

            <div class="table-responsive">
              <table class="table table-hover align-middle">
                <thead class="table-light">
                  <tr>
                    <th>Title</th>
                    <th>Code</th>
                    <th>Channel</th>
                    <th>Provider</th>
                    <th>Account Details</th>
                    <th>Status</th>
                    <th width="140">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="account in destinationAccounts" :key="account.id">
                    <td>
                      <div class="fw-semibold">{{ account.title }}</div>
                      <small v-if="account.note" class="text-muted">{{
                        account.note
                      }}</small>
                    </td>
                    <td>
                      <code class="text-primary">{{ account.code }}</code>
                    </td>
                    <td>
                      <span
                        class="badge"
                        :class="
                          account.channelType === 'paystack'
                            ? 'bg-primary'
                            : 'bg-success'
                        "
                      >
                        {{
                          account.channelType === "paystack"
                            ? "Paystack"
                            : "Manual Transfer"
                        }}
                      </span>
                    </td>
                    <td>
                      <span class="text-capitalize">{{
                        account.providerType.replace("_", " ")
                      }}</span>
                      <span
                        v-if="account.isDefault"
                        class="badge bg-warning text-dark ms-2"
                        >Default</span
                      >
                    </td>
                    <td>
                      <div v-if="account.accountName" class="small fw-semibold">
                        {{ account.accountName }}
                      </div>
                      <div
                        v-if="account.bankName || account.accountNumber"
                        class="small text-muted"
                      >
                        {{ account.bankName || "—" }} •
                        {{ account.accountNumber || "—" }}
                      </div>
                      <div
                        v-if="account.paystackSubaccountCode"
                        class="small text-muted"
                      >
                        {{ account.paystackSubaccountCode }}
                      </div>
                    </td>
                    <td>
                      <span
                        class="badge"
                        :class="account.active ? 'bg-success' : 'bg-danger'"
                      >
                        {{ account.active ? "Active" : "Inactive" }}
                      </span>
                    </td>
                    <td>
                      <div class="btn-group" role="group">
                        <button
                          class="btn btn-sm btn-outline-staff-primary"
                          @click="showDestinationAccountForm(account)"
                          title="Edit Account"
                        >
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button
                          class="btn btn-sm btn-outline-danger"
                          @click="deleteDestinationAccount(account)"
                          title="Delete Account"
                        >
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                  <tr v-if="destinationAccounts.length === 0">
                    <td colspan="7" class="text-center py-4 text-muted">
                      <i class="bi bi-bank display-6 d-block mb-2"></i>
                      No destination accounts have been created yet.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button
              type="button"
              class="btn btn-outline-secondary"
              @click="closeDestinationAccountsModal"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="showDestinationAccountsModal"
      class="modal-backdrop fade show"
      @click="closeDestinationAccountsModal"
    ></div>
  </div>
</template>

<style scoped>
.btn-staff-primary {
  background-color: #198754;
  border-color: #198754;
  color: white;
}

.btn-staff-primary:hover {
  background-color: #157347;
  border-color: #146c43;
}

.btn-outline-staff-primary {
  color: #198754;
  border-color: #198754;
}

.btn-outline-staff-primary:hover {
  background-color: #198754;
  border-color: #198754;
  color: white;
}

.text-staff-primary {
  color: #198754 !important;
}

.page-link {
  color: #198754;
}

.page-item.active .page-link {
  background-color: #198754;
  border-color: #198754;
}

.table th {
  background-color: #f8f9fa;
  border-bottom: 2px solid #dee2e6;
  font-weight: 600;
}

.card {
  border-radius: 0.5rem;
}

.btn-group .btn {
  border-radius: 0.25rem;
  margin-right: 0.25rem;
}

.btn-group .btn:last-child {
  margin-right: 0;
}

.modal {
  z-index: 1050;
}

.modal-backdrop {
  z-index: 1040;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal.show {
  display: block !important;
}

:deep(.destination-account-swal-popup) {
  width: min(980px, 92vw) !important;
  max-width: 980px !important;
  height: 82vh;
}

:deep(.destination-account-swal-html) {
  max-height: calc(82vh - 180px);
  overflow-y: auto;
}
</style>

<script lang="js">
import { useAuthStore } from "../../stores/auth.js";
import { apiService } from "../../services/api.js";
import { logger } from "@shared/utils/logger";
import Swal from "sweetalert2";
import { MODULE_DEFINITIONS, MODULE_LIST } from "../../services/roleDefinitions.js";

export default {
  name: "UsersManagement",
  setup() {
    const authStore = useAuthStore();
    return {
      authStore,
    };
  },
  data() {
    return {
      users: [],
      roles: [],
      isLoading: true,
      isSavingUser: false, // Loading state for user creation/update
      searchQuery: "",
      roleFilter: "all",
      statusFilter: "all",
      currentPage: 1,
      perPage: 10,
      totalUsers: 0,
      totalPages: 0,
      showUserModal: false,
      selectedUser: null,
      isEditMode: false,

      userForm: {
        firstName: "",
        lastName: "",
        otherName: "",
        email: "",
        phone: "",
        type: "admin", // admin, staff, student, applicant
        department: "", // only for admin/staff
        position: "",
        roleId: "",
        isActive: true,
      },

      userTypes: [
        { value: "admin", label: "Administrator", enabled: true },
        { value: "staff", label: "Staff Member", enabled: true },
        { value: "student", label: "Student", enabled: false },
        { value: "applicant", label: "Applicant", enabled: false },
      ],

      departments: [
        { value: "Academics", label: "Academics" },
        { value: "Administration", label: "Administration" },
      ],

      positions: [
        "System Administrator",
        "Director",
        "Provost",
        "Deputy Provost",
        "Bursar",
        "Finance Officer",
        "Registrar",
        "Deputy Registrar",
        "Admissions Officer",
        "Academic Affairs Officer",
        "Exams Officer",
        "Clerical Officer",
        "Hostel Matron",
        "Dean",
        "Head of Department",
        "Senior Lecturer",
        "Lecturer I",
        "Lecturer II",
        "Assistant Lecturer",
        "Instructor/Technologist",
        "Security Officer",
        "Cleaner"
      ],

      // Role Management Configuration
      availableModules: [
        ...MODULE_LIST,
      ],
    };
  },
  async mounted() {
    await this.loadUsers();
    await this.loadRoles();
  },
  computed: {
    roleOptions() {
      return [
        { value: "all", label: "All Roles" },
        { value: "admin", label: "Administrator" },
        { value: "staff", label: "Staff" },
        { value: "student", label: "Student" },
        { value: "applicant", label: "Applicant" },
      ];
    },

    statusOptions() {
      return [
        { value: "all", label: "All Statuses" },
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
      ];
    },

    // Show department and role fields for admin/staff (both are staff members)
    showStaffFields() {
      return ["admin", "staff"].includes(this.userForm.type);
    },

    // Generate staff ID based on department
    staffIdPrefix() {
      if (this.userForm.department === "Academics") {
        return "ALCN/ACD/";
      } else if (this.userForm.department === "Administration") {
        return "ALCN/ADM/";
      }
      return "ALCN/XXX/";
    },
  },
  methods: {
    async loadUsers() {
      try {
        this.isLoading = true;
        logger.info("Loading users...");

        const params = {
          page: this.currentPage,
          limit: this.perPage,
          role: this.roleFilter !== "all" ? this.roleFilter : undefined,
          status: this.statusFilter !== "all" ? this.statusFilter : undefined,
          search: this.searchQuery || undefined,
        };

        const response = await apiService.getUsers(params);

        if (response.success) {
          this.users = response.data.users;
          this.totalUsers = response.data.pagination.total;
          this.totalPages = response.data.pagination.pages;
          logger.info("Users loaded successfully");
        }
      } catch (error) {
        logger.error("Failed to load users:", error);
        this.$swal.fire({
          icon: "error",
          title: "Load Failed",
          text: "Failed to load users",
        });
      } finally {
        this.isLoading = false;
      }
    },

    async loadRoles() {
      try {
        const response = await apiService.getRoles();
        if (response.success) {
          this.roles = response.data;
        }
      } catch (error) {
        logger.error("Failed to load roles:", error);
      }
    },

    async onSearch() {
      this.currentPage = 1;
      await this.loadUsers();
    },

    async onFilterChange() {
      this.currentPage = 1;
      await this.loadUsers();
    },

    async onPageChange(page) {
      this.currentPage = page;
      await this.loadUsers();
    },

    getRoleBadgeClass(role) {
      const roleClasses = {
        admin: "bg-danger text-white",
        staff: "bg-info text-white",
        student: "bg-secondary text-white",
        applicant: "bg-warning text-dark",
      };
      return roleClasses[role] || "bg-secondary text-white";
    },

    getStatusBadgeClass(isActive) {
      return isActive ? "bg-success text-white" : "bg-warning text-dark";
    },

    formatDate(dateString) {
      return new Date(dateString).toLocaleDateString();
    },

    formatDateTime(dateString) {
      return new Date(dateString).toLocaleString();
    },

    getVerificationMeta(isVerified, type = "email") {
      if (type === "email") {
        return isVerified
          ? {
            badgeClass: "badge text-bg-success rounded-pill",
            iconClass: "bi bi-patch-check-fill",
            label: "Verified",
            srLabel: "Email verified",
          }
          : {
            badgeClass: "badge text-bg-warning rounded-pill",
            iconClass: "bi bi-hourglass-split",
            label: "Pending",
            srLabel: "Email pending verification",
          };
      }

      return {
        badgeClass: "badge text-bg-secondary rounded-pill",
        iconClass: "bi bi-dash-circle",
        label: "Unavailable",
        srLabel: "Verification unavailable",
      };
    },

    getVerificationBadgeHtml(isVerified, type = "email") {
      const verificationMeta = this.getVerificationMeta(isVerified, type);
      return `<span class="${verificationMeta.badgeClass}" title="${verificationMeta.srLabel}" aria-label="${verificationMeta.srLabel}"><i class="${verificationMeta.iconClass} me-1"></i>${verificationMeta.label}</span>`;
    },

    hasStudentProfileImage(user) {
      return user?.role === "student" && !!user?.profileImageUrl;
    },

    viewUser(user) {
      // Get role name for display
      const role = this.roles.find((r) => r._id === user.roleId);
      const roleName = role ? role.name : user.role || "N/A";
      const profileImageHtml = this.hasStudentProfileImage(user)
        ? `
          <div class="text-center mb-3">
            <img
              src="${user.profileImageUrl}"
              alt="${user.firstName} ${user.lastName}"
              class="img-thumbnail border"
              style="width: 88px; height: 88px; object-fit: cover"
            />
          </div>
        `
        : "";

      // Format user details for display
      const userDetailsHtml = `
        <div class="text-start">
          ${profileImageHtml}
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Name:</strong></div>
            <div class="col-sm-8">${user.firstName} ${user.lastName} ${user.otherName || ""}</div>
          </div>
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Email:</strong></div>
            <div class="col-sm-8 d-flex align-items-center gap-2 flex-wrap">${user.email}${this.getVerificationBadgeHtml(user.isEmailVerified, "email")}</div>
          </div>
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Phone:</strong></div>
            <div class="col-sm-8">${user.phone || "-"}</div>
          </div>
          <div class="row mb-3">
            <div class="col-sm-4"><strong>User Type:</strong></div>
            <div class="col-sm-8">${user.role || "N/A"}</div>
          </div>
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Role:</strong></div>
            <div class="col-sm-8">${roleName}</div>
          </div>
          ${user.staffId
          ? `
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Staff ID:</strong></div>
            <div class="col-sm-8">${user.staffId}</div>
          </div>
          `
          : user.matriculationNumber
            ? `
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Matric No:</strong></div>
            <div class="col-sm-8">${user.matriculationNumber}</div>
          </div>
          `
            : user.applicationNumber
              ? `
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Application No:</strong></div>
            <div class="col-sm-8">${user.applicationNumber}</div>
          </div>
          `
              : ""
        }
          ${user.department
          ? `
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Department:</strong></div>
            <div class="col-sm-8">${user.department}</div>
          </div>
          `
          : user.studentDepartment
            ? `
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Department:</strong></div>
            <div class="col-sm-8">${user.studentDepartment}</div>
          </div>
          `
            : ""
        }
          ${user.position
          ? `
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Position:</strong></div>
            <div class="col-sm-8">${user.position}</div>
          </div>
          `
          : user.studentProgram
            ? `
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Program:</strong></div>
            <div class="col-sm-8">${user.studentProgram}</div>
          </div>
          `
            : ""
        }
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Status:</strong></div>
            <div class="col-sm-8">
              <span class="badge ${user.isActive ? "bg-success" : "bg-danger"}">
                ${user.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          </div>
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Created:</strong></div>
            <div class="col-sm-8">${this.formatDateTime(user.createdAt)}</div>
          </div>
          ${user.updatedAt
          ? `
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Last Updated:</strong></div>
            <div class="col-sm-8">${this.formatDateTime(user.updatedAt)}</div>
          </div>
          `
          : ""
        }
          ${user.lastLogin
          ? `
          <div class="row mb-3">
            <div class="col-sm-4"><strong>Last Login:</strong></div>
            <div class="col-sm-8">${this.formatDateTime(user.lastLogin)}</div>
          </div>
          `
          : ""
        }
        </div>
      `;

      Swal.fire({
        title: "User Details",
        html: userDetailsHtml,
        width: "600px",
        heightAuto: false,
        showConfirmButton: false,
        showCloseButton: true,
        customClass: {
          container: "user-details-modal",
          popup: "user-details-popup",
          htmlContainer: "user-details-content",
        },
      });
    },

    editUser(user) {
      this.selectedUser = { ...user };
      this.isEditMode = true;

      this.userForm = {
        firstName: user.firstName,
        lastName: user.lastName,
        otherName: user.otherName || "",
        email: user.email,
        phone: user.phone || "",
        type: user.role,
        department: user.department || "",
        position: user.position || "",
        roleId: user.roleId || "",
        isActive: user.isActive,
      };
      this.showUserModal = true;
    },

    async saveUser() {
      try {
        this.isSavingUser = true; // Start loading
        logger.info("Saving user...");

        // Validate form
        if (
          !this.userForm.firstName ||
          !this.userForm.lastName ||
          !this.userForm.email
        ) {
          this.isSavingUser = false; // Stop loading on validation error
          this.$swal.fire({
            icon: "warning",
            title: "Validation Error",
            text: "Please fill in all required fields",
          });
          return;
        }

        // Validate staff-specific fields if creating staff or admin (both need these fields)
        if (
          (this.userForm.type === "staff" || this.userForm.type === "admin") &&
          (!this.userForm.department ||
            !this.userForm.position ||
            !this.userForm.roleId)
        ) {
          this.isSavingUser = false; // Stop loading on validation error
          this.$swal.fire({
            icon: "warning",
            title: "Validation Error",
            text: "Please fill in department, position, and role - these are required for all staff members",
          });
          return;
        }

        let response;
        if (this.isEditMode && this.selectedUser) {
          const isStaffUser =
            this.userForm.type === "staff" || this.userForm.type === "admin";

          if (isStaffUser) {
            // Keep payload aligned with UpdateStaffDto to satisfy strict whitelist validation.
            const staffUpdatePayload = {
              type: this.userForm.type,
              firstName: this.userForm.firstName,
              lastName: this.userForm.lastName,
              otherName: this.userForm.otherName || undefined,
              phone: this.userForm.phone || undefined,
              department: this.userForm.department,
              position: this.userForm.position,
              roleId: this.userForm.roleId,
              isActive: this.userForm.isActive,
            };

            response = await apiService.updateStaff(
              this.selectedUser._id,
              staffUpdatePayload,
            );
          } else {
            // Keep payload aligned with UpdateUserDto to satisfy strict whitelist validation.
            const userUpdatePayload = {
              firstName: this.userForm.firstName,
              lastName: this.userForm.lastName,
              otherName: this.userForm.otherName || undefined,
              phone: this.userForm.phone || undefined,
              isActive: this.userForm.isActive,
            };

            response = await apiService.updateUser(
              this.selectedUser._id,
              userUpdatePayload,
            );
          }
        } else {
          // Use unified creation method for both admin and staff
          response = await apiService.createStaffUser(this.userForm);
        }

        if (response.success) {
          this.showUserModal = false;
          this.selectedUser = null;
          this.isEditMode = false;
          this.resetUserForm();
          await this.loadUsers();

          this.$swal.fire({
            icon: "success",
            title: this.isEditMode ? "User Updated" : "User Created",
            text: response.message,
            timer: 2000,
            showConfirmButton: false,
          });

          logger.info("User saved successfully");
        }
      } catch (error) {
        logger.error("Failed to save user:", error);
        let errorMessage = "Failed to save user";

        if (error.message.includes("Email already exists")) {
          errorMessage = "Email address is already in use";
        }

        this.$swal.fire({
          icon: "error",
          title: "Save Failed",
          text: errorMessage,
        });
      } finally {
        this.isSavingUser = false; // Stop loading in all cases
      }
    },

    async saveStaff() {
      try {
        logger.info("Saving staff...");

        // Validate form
        if (
          !this.staffForm.firstName ||
          !this.staffForm.lastName ||
          !this.staffForm.email ||
          !this.staffForm.department ||
          !this.staffForm.position ||
          !this.staffForm.roleId
        ) {
          this.$swal.fire({
            icon: "warning",
            title: "Validation Error",
            text: "Please fill in all required fields",
          });
          return;
        }

        let response;
        if (this.isEditMode && this.selectedUser) {
          const staffUpdatePayload = {
            firstName: this.staffForm.firstName,
            lastName: this.staffForm.lastName,
            otherName: this.staffForm.otherName || undefined,
            phone: this.staffForm.phone || undefined,
            department: this.staffForm.department,
            position: this.staffForm.position,
            roleId: this.staffForm.roleId,
            isActive: this.staffForm.isActive,
          };

          response = await apiService.updateStaff(
            this.selectedUser._id,
            staffUpdatePayload,
          );
        } else {
          response = await apiService.createStaffUser(this.staffForm);
        }

        if (response.success) {
          this.showStaffModal = false;
          this.selectedUser = null;
          this.isEditMode = false;
          this.resetStaffForm();
          await this.loadUsers();

          this.$swal.fire({
            icon: "success",
            title: this.isEditMode ? "Staff Updated" : "Staff Created",
            text: response.message,
            timer: 2000,
            showConfirmButton: false,
          });

          logger.info("Staff saved successfully");
        }
      } catch (error) {
        logger.error("Failed to save staff:", error);
        let errorMessage = "Failed to save staff";

        if (error.message.includes("Email already exists")) {
          errorMessage = "Email address is already in use";
        }

        this.$swal.fire({
          icon: "error",
          title: "Save Failed",
          text: errorMessage,
        });
      }
    },

    async updateUserStatus(user) {
      try {
        if (!user) {
          await this.$swal.fire({
            title: "Error!",
            text: "No user selected",
            icon: "error",
            confirmButtonColor: "#dc3545",
          });
          return;
        }

        const action = user.isActive ? "deactivate" : "activate";
        const newStatus = !user.isActive;

        // Show confirmation modal
        const result = await this.$swal.fire({
          title: `${action.charAt(0).toUpperCase() + action.slice(1)} User?`,
          text: `Are you sure you want to ${action} ${user.firstName} ${user.lastName}? ${user.isActive
              ? "They will no longer be able to access the system."
              : "They will regain access to the system."
            }`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: `Yes, ${action.charAt(0).toUpperCase() + action.slice(1)}`,
          cancelButtonText: "Cancel",
          confirmButtonColor: user.isActive ? "#dc3545" : "#198754",
          cancelButtonColor: "#6c757d",
        });

        if (!result.isConfirmed) {
          return;
        }

        logger.info(`Updating user ${user._id} status to ${newStatus}`);

        const response = await apiService.updateUserStatus(user._id, newStatus);

        if (response.success) {
          await this.loadUsers();

          // Show success modal
          await this.$swal.fire({
            title: "Success!",
            text: `User ${action}d successfully`,
            icon: "success",
            confirmButtonColor: "#198754",
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: true,
            allowOutsideClick: false,
          });

          logger.info("User status updated successfully");
        }
      } catch (error) {
        logger.error("Failed to update user status:", error);

        // Show error modal
        await this.$swal.fire({
          title: "Error!",
          text: error.response?.data?.message || "Failed to update user status",
          icon: "error",
          confirmButtonColor: "#dc3545",
        });
      }
    },

    async resetPassword(user) {
      try {
        const result = await this.$swal.fire({
          title: "Reset Password",
          text: `Reset password for ${user.firstName} ${user.lastName}? A new password will be sent to their email.`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#dc3545",
          cancelButtonColor: "#6c757d",
          confirmButtonText: "Yes, reset password",
          cancelButtonText: "Cancel",
        });

        if (result.isConfirmed) {
          logger.info(`Resetting password for user ${user._id}`);

          const response = await apiService.resetUserPassword(user._id);

          if (response.success) {
            this.$swal.fire({
              icon: "success",
              title: "Password Reset",
              text: "New password has been sent to the user's email",
              timer: 3000,
              showConfirmButton: false,
            });

            logger.info("Password reset successfully");
          }
        }
      } catch (error) {
        logger.error("Failed to reset password:", error);
        this.$swal.fire({
          icon: "error",
          title: "Reset Failed",
          text: "Failed to reset password",
        });
      }
    },

    async deleteUser(user) {
      try {
        const result = await this.$swal.fire({
          title: "Delete User",
          text: `Are you sure you want to delete ${user.firstName} ${user.lastName}? This action cannot be undone.`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonColor: "#dc3545",
          cancelButtonColor: "#6c757d",
          confirmButtonText: "Yes, delete",
          cancelButtonText: "Cancel",
        });

        if (result.isConfirmed) {
          logger.info(`Deleting user ${user._id}`);

          const response = await apiService.deleteUser(user._id);

          if (response.success) {
            await this.loadUsers();

            this.$swal.fire({
              icon: "success",
              title: "User Deleted",
              text: "User has been deleted successfully",
              timer: 2000,
              showConfirmButton: false,
            });

            logger.info("User deleted successfully");
          }
        }
      } catch (error) {
        logger.error("Failed to delete user:", error);
        this.$swal.fire({
          icon: "error",
          title: "Delete Failed",
          text: "Failed to delete user",
        });
      }
    },

    addNewUser() {
      this.selectedUser = null;
      this.isEditMode = false;
      this.resetUserForm();
      this.showUserModal = true;
    },

    resetUserForm() {
      this.userForm = {
        firstName: "",
        lastName: "",
        otherName: "",
        email: "",
        phone: "",
        type: "admin",
        department: "",
        position: "",
        roleId: "",
        isActive: true,
      };
    },

    closeUserModal() {
      this.showUserModal = false;
      this.selectedUser = null;
      this.isEditMode = false;
      this.isSavingUser = false; // Reset loading state
      this.resetUserForm();
    },

    exportUsers() {
      this.$swal.fire({
        title: "Export Users",
        text: "This feature will be implemented soon",
        icon: "info",
        confirmButtonColor: "#1a5f5f",
      });
    },

    getRoleName(roleId) {
      const role = this.roles.find((r) => r._id === roleId);
      return role ? role.name : "Unknown Role";
    },

    // Role Management Methods
    async showRolesManagement() {
      try {
        // Refresh roles data
        await this.loadRoles();

        const rolesTableRows = this.roles
          .map((role) => {
            // Convert module permissions back to frontend format for display
            const moduleNames = role.modules?.map((m) => m.module) || [];
            const totalModules = moduleNames.length;

            return `
            <tr>
              <td class="text-start">${role.name}</td>
              <td class="text-start">${role.description || "No description"}</td>
              <td class="text-start">${totalModules} modules</td>
              <td class="text-center">
                <button class="btn btn-sm btn-outline-primary me-2" onclick="window.editRole('${role._id}')">
                  <i class="bi bi-pencil"></i> Edit
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="window.deleteRole('${role._id}')">
                  <i class="bi bi-trash"></i> Delete
                </button>
              </td>
            </tr>
          `;
          })
          .join("");

        // Store reference to this component for global access
        window.editRole = (roleId) => this.editRole(roleId);
        window.deleteRole = (roleId) => this.deleteRole(roleId);
        window.addNewRole = () => this.showRoleModal();

        const result = await Swal.fire({
          title: "Roles Management",
          html: `
            <div class="text-start">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">System Roles</h5>
                <button class="btn btn-primary btn-sm" onclick="window.addNewRole()">
                  <i class="bi bi-plus"></i> Add New Role
                </button>
              </div>
              
              <div class="table-responsive">
                <table class="table table-hover">
                  <thead class="">
                    <tr>
                      <th class="text-start">Role Name</th>
                      <th class="text-start">Description</th>
                      <th class="text-start">Modules</th>
                      <th class="text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rolesTableRows || '<tr><td colspan="4" class="text-center text-muted">No roles found</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          `,
          width: "800px",
          showConfirmButton: false,
          showCloseButton: true,
          customClass: {
            container: "roles-management-modal",
          },
        });

        // Clean up global references
        delete window.editRole;
        delete window.deleteRole;
        delete window.addNewRole;
      } catch (error) {
        logger.error("Error showing roles management:", error);
        Swal.fire({
          title: "Error!",
          text: "Failed to load roles management. Please try again.",
          icon: "error",
          confirmButtonColor: "#dc3545",
        });
      }
    },

    async showRoleModal(existingRole = null) {
      const isEdit = !!existingRole;

      // Convert backend format to frontend format
      let selectedModules = [];
      let rolePermissions = {};

      if (existingRole && existingRole.modules) {
        selectedModules = existingRole.modules.map((m) => m.module);
        rolePermissions = {};
        existingRole.modules.forEach((m) => {
          rolePermissions[m.module] = m.permissions || [];
        });
      }

      const moduleCheckboxes = this.availableModules
        .map(
          (module) => `
        <div class="col-6 col-md-4 mb-2">
          <div class="form-check">
            <input 
              class="form-check-input module-checkbox" 
              type="checkbox" 
              value="${module.value}" 
              id="module-${module.value}"
              ${selectedModules.includes(module.value) ? "checked" : ""}
            >
            <label class="form-check-label" for="module-${module.value}">
              ${module.label}
            </label>
          </div>
        </div>
      `,
        )
        .join("");

      const result = await Swal.fire({
        title: isEdit ? "Edit Role" : "Add New Role",
        html: `
          <div class="row g-3">
            <div class="col-md-12">
              <label for="swal-role-name" class="form-label text-start w-100">Role Name</label>
              <input 
                id="swal-role-name" 
                class="form-control" 
                placeholder="e.g., Academic Coordinator" 
                value="${existingRole ? existingRole.name : ""}"
                required
              >
            </div>
            <div class="col-md-12">
              <label for="swal-role-description" class="form-label text-start w-100">Description</label>
              <textarea 
                id="swal-role-description" 
                class="form-control" 
                placeholder="Brief description of the role" 
                rows="3"
              >${existingRole ? existingRole.description || "" : ""}</textarea>
            </div>
            <div class="col-12">
              <label class="form-label">Select Modules</label>
              <div class="row">
                ${moduleCheckboxes}
              </div>
            </div>
            <div class="col-12">
              <label class="form-label">Permissions for Selected Modules</label>
              <div id="permissions-container" class="border rounded p-3">
                <small class="text-muted">Select modules above to configure permissions</small>
              </div>
            </div>
          </div>
        `,
        width: "700px",
        showCancelButton: true,
        confirmButtonText: isEdit ? "Update Role" : "Create Role",
        cancelButtonText: "Cancel",
        confirmButtonColor: "#198754",
        cancelButtonColor: "#6c757d",
        didOpen: () => {
          this.setupRoleModalInteractions(selectedModules, rolePermissions);
        },
        preConfirm: () => {
          return this.validateAndGetRoleData();
        },
      });

      if (result.isConfirmed && result.value) {
        let operationSuccess = false;
        if (isEdit) {
          operationSuccess = await this.updateRole(
            existingRole._id,
            result.value,
          );
        } else {
          operationSuccess = await this.createRole(result.value);
        }

        // Only return to roles management if operation was successful
        if (operationSuccess) {
          // Small delay to ensure success modal is properly closed
          setTimeout(() => this.showRolesManagement(), 300);
        }
      }
    },

    setupRoleModalInteractions(selectedModules, rolePermissions) {
      const moduleCheckboxes = document.querySelectorAll(".module-checkbox");
      const permissionsContainer = document.getElementById(
        "permissions-container",
      );

      const updatePermissionsDisplay = () => {
        const checkedModules = Array.from(moduleCheckboxes)
          .filter((cb) => cb.checked)
          .map((cb) => cb.value);

        if (checkedModules.length === 0) {
          permissionsContainer.innerHTML =
            '<small class="text-muted">Select modules above to configure permissions</small>';
          return;
        }

        const permissionsHtml = checkedModules
          .map((module) => {
            const moduleLabel =
              MODULE_DEFINITIONS[module]?.label || module;
            const modulePerms = rolePermissions[module] || [];

            const moduleDef = MODULE_DEFINITIONS[module];
            const permissionCheckboxes = (moduleDef?.permissions || [])
              .map(
                (perm) => `
            <div class="form-check form-check-inline">
              <input 
                class="form-check-input permission-checkbox" 
                type="checkbox" 
                value="${perm.value}" 
                id="perm-${module}-${perm.value}"
                data-module="${module}"
                ${modulePerms.includes(perm.value) || (modulePerms.includes('manage') && perm.value !== 'manage') ? "checked" : ""}
              >
              <label class="form-check-label" for="perm-${module}-${perm.value}">
                ${perm.label}
              </label>
            </div>
          `,
              )
              .join("");

            return `
            <div class="mb-3">
              <h6 class="mb-2">${moduleLabel}</h6>
              <div class="ps-3">
                ${permissionCheckboxes}
              </div>
            </div>
          `;
          })
          .join("");

        permissionsContainer.innerHTML = permissionsHtml;

        // Wire manage checkbox: checking it auto-checks all siblings; unchecking clears them
        checkedModules.forEach((module) => {
          const manageCheckbox = document.getElementById(`perm-${module}-manage`);
          if (!manageCheckbox) return;
          const siblingCheckboxes = document.querySelectorAll(
            `.permission-checkbox[data-module="${module}"]:not([value="manage"])`,
          );
          manageCheckbox.addEventListener('change', () => {
            siblingCheckboxes.forEach((cb) => { cb.checked = manageCheckbox.checked; });
          });
        });
      };

      // Initial permissions display
      updatePermissionsDisplay();

      // Update permissions when modules change
      moduleCheckboxes.forEach((checkbox) => {
        checkbox.addEventListener("change", updatePermissionsDisplay);
      });
    },

    validateAndGetRoleData() {
      const name = document.getElementById("swal-role-name").value.trim();
      const description = document
        .getElementById("swal-role-description")
        .value.trim();

      if (!name) {
        Swal.showValidationMessage("Role name is required");
        return false;
      }

      const selectedModules = Array.from(
        document.querySelectorAll(".module-checkbox:checked"),
      ).map((cb) => cb.value);

      if (selectedModules.length === 0) {
        Swal.showValidationMessage("At least one module must be selected");
        return false;
      }

      const permissions = {};
      selectedModules.forEach((module) => {
        const modulePermissions = Array.from(
          document.querySelectorAll(
            `.permission-checkbox[data-module="${module}"]:checked`,
          ),
        ).map((cb) => cb.value);

        if (modulePermissions.length > 0) {
          permissions[module] = modulePermissions;
        }
      });

      return {
        name,
        description,
        modules: selectedModules,
        permissions,
      };
    },

    async createRole(roleData) {
      try {
        logger.info("Creating role:", roleData);
        const response = await apiService.createRole(roleData);

        if (response.success) {
          await this.loadRoles(); // Refresh roles list

          // Show success modal and wait for user acknowledgment
          await Swal.fire({
            title: "Success!",
            text: "Role created successfully",
            icon: "success",
            confirmButtonText: "OK",
            confirmButtonColor: "#198754",
            timer: 3000, // Auto-close after 3 seconds
            timerProgressBar: true,
            showConfirmButton: true,
            allowOutsideClick: false,
          });

          return true; // Operation successful
        }
      } catch (error) {
        logger.error("Error creating role:", error);

        // Show error modal and wait for user acknowledgment
        await Swal.fire({
          title: "Error!",
          text: error.response?.data?.message || "Failed to create role",
          icon: "error",
          confirmButtonText: "OK",
          confirmButtonColor: "#dc3545",
        });

        return false; // Operation failed
      }
    },

    async editRole(roleId) {
      try {
        const role = this.roles.find((r) => r._id === roleId);
        if (!role) {
          throw new Error("Role not found");
        }

        Swal.close(); // Close the roles management modal
        setTimeout(() => this.showRoleModal(role), 100);
      } catch (error) {
        logger.error("Error editing role:", error);
        Swal.fire({
          title: "Error!",
          text: "Failed to load role for editing",
          icon: "error",
          confirmButtonColor: "#dc3545",
        });
      }
    },

    async updateRole(roleId, roleData) {
      try {
        logger.info("Updating role:", roleId, roleData);
        const response = await apiService.updateRole(roleId, roleData);

        if (response.success) {
          await this.loadRoles(); // Refresh roles list

          // Show success modal and wait for user acknowledgment
          await Swal.fire({
            title: "Success!",
            text: "Role updated successfully",
            icon: "success",
            confirmButtonText: "OK",
            confirmButtonColor: "#198754",
            timer: 3000, // Auto-close after 3 seconds
            timerProgressBar: true,
            showConfirmButton: true,
            allowOutsideClick: false,
          });

          return true; // Operation successful
        }
      } catch (error) {
        logger.error("Error updating role:", error);

        // Show error modal and wait for user acknowledgment
        await Swal.fire({
          title: "Error!",
          text: error.response?.data?.message || "Failed to update role",
          icon: "error",
          confirmButtonText: "OK",
          confirmButtonColor: "#dc3545",
        });

        return false; // Operation failed
      }
    },

    async deleteRole(roleId) {
      try {
        const role = this.roles.find((r) => r._id === roleId);
        if (!role) {
          throw new Error("Role not found");
        }

        if (role.isSystem) {
          Swal.fire({
            title: "Cannot Delete!",
            text: "System roles cannot be deleted",
            icon: "warning",
            confirmButtonColor: "#ffc107",
          });
          return;
        }

        const result = await Swal.fire({
          title: "Delete Role?",
          text: `Are you sure you want to delete the role "${role.name}"? This action cannot be undone.`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Yes, Delete",
          cancelButtonText: "Cancel",
          confirmButtonColor: "#dc3545",
          cancelButtonColor: "#6c757d",
        });

        if (result.isConfirmed) {
          const response = await apiService.deleteRole(roleId);

          if (response.success) {
            await this.loadRoles(); // Refresh roles list

            // Show success modal and wait for user acknowledgment
            await Swal.fire({
              title: "Deleted!",
              text: "Role deleted successfully",
              icon: "success",
              confirmButtonText: "OK",
              confirmButtonColor: "#198754",
              timer: 3000, // Auto-close after 3 seconds
              timerProgressBar: true,
              showConfirmButton: true,
              allowOutsideClick: false,
            });

            // Return to roles management modal after user acknowledges
            setTimeout(() => this.showRolesManagement(), 300);
          }
        }
      } catch (error) {
        logger.error("Error deleting role:", error);

        // Show error modal and wait for user acknowledgment
        await Swal.fire({
          title: "Error!",
          text: error.response?.data?.message || "Failed to delete role",
          icon: "error",
          confirmButtonText: "OK",
          confirmButtonColor: "#dc3545",
        });
      }
    },
  },
};
</script>

<template>
  <div class="container-fluid p-4">
    <!-- Page Header -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="d-flex justify-content-between align-items-center">
          <div>
            <h2 class="fw-bold text-staff-primary mb-1">Users Management</h2>
            <p class="text-muted mb-0">Manage system users and permissions</p>
          </div>
          <div class="d-flex gap-2">
            <button v-if="authStore.hasPermission('users', 'view')" class="btn btn-outline-staff-primary btn-sm"
              @click="exportUsers">
              <i class="bi bi-download me-2"></i>Export
            </button>
            <button v-if="authStore.hasPermission('users', 'create')" class="btn btn-staff-primary btn-sm"
              @click="addNewUser">
              <i class="bi bi-plus me-2"></i>Add User
            </button>
            <button v-if="authStore.hasPermission('users', 'manage')" class="btn btn-success btn-sm"
              @click="showRolesManagement">
              <i class="bi bi-gear me-2"></i>Roles
            </button>
            <button class="btn btn-outline-secondary btn-sm" @click="loadUsers">
              <i class="bi bi-arrow-clockwise me-2"></i>Refresh
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <div class="row mb-4">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body">
            <div class="row g-3">
              <div class="col-md-4">
                <label for="searchQuery" class="form-label">Search</label>
                <input type="text" class="form-control" id="searchQuery" placeholder="Search by name or email..."
                  v-model="searchQuery" @input="onSearch" />
              </div>
              <div class="col-md-3">
                <label for="roleFilter" class="form-label">Role</label>
                <select class="form-select" id="roleFilter" v-model="roleFilter" @change="onFilterChange">
                  <option v-for="role in roleOptions" :key="role.value" :value="role.value">
                    {{ role.label }}
                  </option>
                </select>
              </div>
              <div class="col-md-3">
                <label for="statusFilter" class="form-label">Status</label>
                <select class="form-select" id="statusFilter" v-model="statusFilter" @change="onFilterChange">
                  <option v-for="status in statusOptions" :key="status.value" :value="status.value">
                    {{ status.label }}
                  </option>
                </select>
              </div>
              <div class="col-md-2 d-flex align-items-end">
                <button class="btn btn-outline-staff-primary btn-sm w-100" @click="onFilterChange">
                  <i class="bi bi-funnel me-2"></i>Apply Filters
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
      <p class="mt-3 text-muted">Loading users...</p>
    </div>

    <!-- Users Table -->
    <div v-else class="row">
      <div class="col-12">
        <div class="staff-card">
          <!-- <div class="card-header bg-transparent border-bottom">
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="mb-0 fw-bold">
                Users ({{ totalUsers }} total)
              </h5>
              <small class="text-muted">Page {{ currentPage }} of {{ totalPages }}</small>
            </div>
          </div> -->
          <div class="card-body p-0">
            <table class="table table-hover mb-0">
              <thead class="table-light">
                <tr>
                  <th>User</th>
                  <th>Contact</th>
                  <th>Role</th>
                  <th>Department/Position</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="user in users" :key="user._id">
                  <td>
                    <div class="d-flex align-items-center">
                      <div
                        class="bg-staff-light rounded-circle overflow-hidden d-flex align-items-center justify-content-center me-2"
                        style="width: 40px; height: 40px">
                        <img v-if="hasStudentProfileImage(user)" :src="user.profileImageUrl"
                          :alt="`${user.firstName} ${user.lastName}`" class="w-100 h-100" style="object-fit: cover" />
                        <i v-else class="bi bi-person text-staff-primary"></i>
                      </div>
                      <div>
                        <div class="fw-medium">
                          {{ user.firstName }} {{ user.otherName }}
                          {{ user.lastName }}
                        </div>
                        <div class="small text-muted" v-if="user.staffId">
                          Staff ID: {{ user.staffId }}
                        </div>
                        <div class="small text-muted" v-else-if="user.matriculationNumber">
                          Matric No: {{ user.matriculationNumber }}
                        </div>
                        <div class="small text-muted" v-else-if="user.applicationNumber">
                          Application No: {{ user.applicationNumber }}
                        </div>
                        <div class="small text-muted" v-else>
                          User ID: {{ user._id.slice(-6) }}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>
                      <div class="small contact-details">
                        <div class="d-flex align-items-center gap-2 flex-wrap">
                          <span>{{ user.email ?? "-" }}</span>
                          <span :class="getVerificationMeta(user.isEmailVerified, 'email').badgeClass"
                            :title="getVerificationMeta(user.isEmailVerified, 'email').srLabel"
                            :aria-label="getVerificationMeta(user.isEmailVerified, 'email').srLabel">
                            <i :class="getVerificationMeta(user.isEmailVerified, 'email').iconClass"></i>
                          </span>
                        </div>
                        <div class="mt-1 text-muted">{{ user.phone ?? "-" }}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="badge rounded-pill" :class="getRoleBadgeClass(user.role)">
                      {{ user.role.toUpperCase() }}
                    </span>
                    <div class="small text-muted" v-if="user.roleName">
                      {{ user.roleName }}
                    </div>
                  </td>
                  <td>
                    <div>
                      <template v-if="user.staffId">
                        <div class="small">{{ user.department || "-" }}</div>
                        <div class="small text-muted">
                          {{ user.position || "-" }}
                        </div>
                      </template>
                      <template v-else-if="
                        user.studentDepartment || user.studentProgram
                      ">
                        <div class="small">
                          {{ user.studentDepartment || "-" }}
                        </div>
                        <div class="small text-muted">
                          {{ user.studentProgram || "-" }}
                        </div>
                      </template>
                      <template v-else>
                        <div class="small">{{ user.department || "-" }}</div>
                        <div class="small text-muted">
                          {{ user.position || "-" }}
                        </div>
                      </template>
                    </div>
                  </td>
                  <td>
                    <span class="badge rounded-pill" :class="getStatusBadgeClass(user.isActive)">
                      {{ user.isActive ? "ACTIVE" : "INACTIVE" }}
                    </span>
                  </td>
                  <td>
                    <div class="small">
                      {{ formatDate(user.createdAt) }}
                    </div>
                  </td>
                  <td>
                    <div class="btn-group btn-group-sm">
                      <button class="btn btn-outline-staff-primary btn-sm" @click="viewUser(user)" title="View Details">
                        <i class="bi bi-eye"></i>
                      </button>
                      <button class="btn btn-outline-secondary btn-sm" @click="editUser(user)" title="Edit User"
                        v-if="authStore.hasPermission('users', 'edit')">
                        <i class="bi bi-pencil"></i>
                      </button>
                      <div class="btn-group" role="group">
                        <button type="button" class="btn btn-outline-warning btn-sm dropdown-toggle"
                          data-bs-toggle="dropdown" title="More Actions"
                          v-if="authStore.hasPermission('users', 'manage')">
                          <i class="bi bi-gear"></i>
                        </button>
                        <ul class="dropdown-menu">
                          <li>
                            <a class="dropdown-item" href="#" @click.prevent="updateUserStatus(user)">
                              <i class="bi bi-arrow-repeat text-primary me-2"></i>{{ user.isActive ? "Deactivate" :
                              "Activate" }}
                            </a>
                          </li>
                          <li>
                            <a class="dropdown-item" href="#" @click.prevent="resetPassword(user)">
                              <i class="bi bi-key text-warning me-2"></i>Reset
                              Password
                            </a>
                          </li>
                          <li>
                            <hr class="dropdown-divider" />
                          </li>
                          <li>
                            <a class="dropdown-item text-danger" href="#" @click.prevent="deleteUser(user)">
                              <i class="bi bi-trash me-2"></i>Delete User
                            </a>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Pagination -->
          <div class="card-footer bg-transparent py-2" v-if="totalPages > 0">
            <nav>
              <ul class="pagination pagination-sm mb-0 justify-content-center">
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <button class="page-link" @click="onPageChange(currentPage - 1)" :disabled="currentPage === 1">
                    Previous
                  </button>
                </li>
                <li class="page-item" :class="{ active: currentPage === page }" v-for="page in Math.min(totalPages, 10)"
                  :key="page">
                  <button class="page-link" @click="onPageChange(page)">
                    {{ page }}
                  </button>
                </li>
                <li class="page-item" :class="{ disabled: currentPage === totalPages }">
                  <button class="page-link" @click="onPageChange(currentPage + 1)"
                    :disabled="currentPage === totalPages">
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>

    <!-- User Modal (Unified for all user types) -->
    <div class="modal fade" :class="{ show: showUserModal }" :style="{ display: showUserModal ? 'block' : 'none' }"
      tabindex="-1">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">
              <i class="bi bi-person-plus me-2 text-primary"></i>
              {{ isEditMode ? "Edit User" : "Add New User" }}
            </h5>
            <button type="button" class="btn-close" @click="closeUserModal"></button>
          </div>
          <div class="modal-body">
            <div class="alert alert-info d-flex align-items-center" role="alert">
              <i class="bi bi-info-circle me-2"></i>
              <div>
                Login credentials will be automatically generated and emailed to
                the user.
                {{
                  showStaffFields
                    ? `Staff ID will be generated as: ${staffIdPrefix}xxx`
                    : ""
                }}
              </div>
            </div>

            <form @submit.prevent="saveUser">
              <!-- Basic Information -->
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="userFirstName" class="form-label">First Name *</label>
                  <input type="text" class="form-control" id="userFirstName" v-model="userForm.firstName" required />
                </div>
                <div class="col-md-6 mb-3">
                  <label for="userLastName" class="form-label">Last Name *</label>
                  <input type="text" class="form-control" id="userLastName" v-model="userForm.lastName" required />
                </div>
              </div>

              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="userOtherName" class="form-label">Other Name</label>
                  <input type="text" class="form-control" id="userOtherName" v-model="userForm.otherName" />
                </div>
                <div class="col-md-6 mb-3">
                  <label for="userEmail" class="form-label">Email Address *</label>
                  <input type="email" class="form-control" id="userEmail" v-model="userForm.email" required />
                </div>
              </div>

              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="userPhone" class="form-label">Phone Number</label>
                  <input type="tel" class="form-control" id="userPhone" v-model="userForm.phone"
                    placeholder="e.g. 08012345678" />
                </div>
              </div>

              <!-- User Type -->
              <div class="row">
                <div class="col-md-6 mb-3">
                  <label for="userType" class="form-label">User Type *</label>
                  <select class="form-select" id="userType" v-model="userForm.type" required>
                    <option v-for="type in userTypes" :key="type.value" :value="type.value" :disabled="!type.enabled">
                      {{ type.label }}
                      {{ !type.enabled ? "(Coming Soon)" : "" }}
                    </option>
                  </select>
                </div>
                <div class="col-md-6 mb-3">
                  <div class="form-check mt-4">
                    <input class="form-check-input" type="checkbox" id="isActive" v-model="userForm.isActive" />
                    <label class="form-check-label" for="isActive">
                      Active User
                    </label>
                  </div>
                </div>
              </div>

              <!-- Staff/Admin Specific Fields -->
              <div v-if="showStaffFields">
                <hr class="my-4" />
                <h6 class="fw-bold mb-3">Staff Information</h6>
                <div class="alert alert-info">
                  <small><i class="bi bi-info-circle me-1"></i>
                    Both administrators and staff are considered staff members
                    and require department, position, and role assignments.
                  </small>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="userDepartment" class="form-label">Department *</label>
                    <select class="form-select" id="userDepartment" v-model="userForm.department" required>
                      <option value="">Select Department</option>
                      <option v-for="dept in departments" :key="dept.value" :value="dept.value">
                        {{ dept.label }}
                      </option>
                    </select>
                    <small class="text-muted">
                      This determines the Staff ID prefix: Academics
                      (ALCN/ACD/xxx), Administration (ALCN/ADM/xxx)
                    </small>
                  </div>
                  <div class="col-md-6 mb-3">
                    <label for="userPosition" class="form-label">Position *</label>
                    <select class="form-select" id="userPosition" v-model="userForm.position" required>
                      <option value="">Select Position</option>
                      <option v-for="pos in positions" :key="pos" :value="pos">
                        {{ pos }}
                      </option>
                    </select>
                  </div>
                </div>

                <div class="row">
                  <div class="col-md-6 mb-3">
                    <label for="userRole" class="form-label">Role/Permissions *</label>
                    <select class="form-select" id="userRole" v-model="userForm.roleId" required>
                      <option value="">Select Role</option>
                      <option v-for="role in roles" :key="role._id" :value="role._id">
                        {{ role.name }}
                        <span v-if="role.description" class="text-muted">
                          - {{ role.description }}</span>
                      </option>
                    </select>
                  </div>
                  <div class="col-md-6 mb-3" v-if="userForm.department">
                    <label class="form-label">Generated Staff ID Preview</label>
                    <div class="form-control-plaintext bg-light p-2 rounded">
                      <strong>{{ staffIdPrefix }}###</strong>
                      <small class="d-block text-muted">Final number will be auto-generated</small>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" @click="closeUserModal">
              Cancel
            </button>
            <button type="button" class="btn btn-primary" @click="saveUser" :disabled="isSavingUser">
              <span v-if="isSavingUser" class="spinner-border spinner-border-sm me-2" role="status"
                aria-hidden="true"></span>
              <i v-else class="bi bi-person-plus me-2"></i>
              {{
                isSavingUser
                  ? "Creating..."
                  : isEditMode
                    ? "Update User"
                    : "Create User"
              }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Backdrop -->
    <div class="modal-backdrop fade" :class="{ show: showUserModal }" v-if="showUserModal"></div>
  </div>
</template>

<style scoped>
.staff-card {
  border: none;
  box-shadow: 0 2px 10px rgba(26, 95, 95, 0.1);
  border-radius: 12px;
  transition: all 0.3s ease;
}

.table th {
  font-weight: 600;
  color: var(--staff-primary);
  border-bottom: 2px solid var(--staff-light);
}

.table td {
  vertical-align: middle;
}

.pagination .page-link {
  color: var(--staff-primary);
  border-color: var(--staff-light);
}

/* Roles Management Modal Styles */
:global(.roles-management-modal) {
  z-index: 9999;
}

:global(.roles-management-modal .table) {
  margin-bottom: 0;
  font-size: 0.9rem;
}

:global(.roles-management-modal .table td),
:global(.roles-management-modal .table th) {
  padding: 0.75rem 0.5rem;
  vertical-align: middle;
}

:global(.roles-management-modal .btn-sm) {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
}

/* Role Modal Form Styles */
:global(.swal2-popup .form-check-input:checked) {
  background-color: var(--staff-primary, #1a5f5f);
  border-color: var(--staff-primary, #1a5f5f);
}

:global(.swal2-popup .form-check-label) {
  font-size: 0.9rem;
  margin-bottom: 0;
}

:global(.swal2-popup #permissions-container) {
  max-height: 300px;
  overflow-y: auto;
  background-color: #f8f9fa;
}

:global(.swal2-popup .form-check-inline) {
  margin-right: 1rem;
  margin-bottom: 0.5rem;
}

:global(.user-details-modal .user-details-popup) {
  height: 90vh;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

:global(.user-details-modal .user-details-content) {
  overflow-y: auto;
}

.pagination .page-item.active .page-link {
  color: white;
  background-color: var(--staff-primary);
  border-color: var(--staff-primary);
}

.dropdown-menu {
  border: none;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.modal-backdrop {
  background-color: rgba(0, 0, 0, 0.5);
}

.modal.show {
  animation: modalFadeIn 0.3s ease-out;
}

.contact-details {
  line-height: 1.35;
}

@keyframes modalFadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }

  to {
    opacity: 1;
    transform: scale(1);
  }
}
</style>

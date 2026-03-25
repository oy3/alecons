<script>
import { apiService } from "../../../services/api.js";
import { logger } from "@shared/utils/logger";

export default {
  name: "Programs",
  data() {
    return {
      programs: [],
      departments: [],
      programTypes: [],
      programModes: [],
      isLoading: true,
      searchQuery: "",
      currentPage: 1,
      perPage: 10,
      totalPrograms: 0,
      debounceTimeout: null,
    };
  },
  computed: {
    totalPages() {
      return Math.ceil(this.totalPrograms / this.perPage);
    },
    
    groupedPrograms() {
      // Group programs by name and department
      const groups = {};
      
      this.programs.forEach(program => {
        const key = `${program.name}_${program.departmentId}`;
        if (!groups[key]) {
          groups[key] = {
            id: program.id, // Use first program's ID as representative
            name: program.name,
            description: program.description,
            department: program.department,
            departmentId: program.departmentId,
            variants: [],
            hasActiveVariants: false
          };
        }
        
        groups[key].variants.push({
          id: program.id,
          programType: program.programType,
          programMode: program.programMode,
          programTypeId: program.programTypeId,
          programModeId: program.programModeId,
          durationYears: program.durationYears,
          active: program.active
        });
        
        if (program.active) {
          groups[key].hasActiveVariants = true;
        }
      });
      
      return Object.values(groups);
    }
  },
  watch: {
    searchQuery() {
      this.currentPage = 1;
      this.debouncedSearch();
    },
    currentPage() {
      this.loadPrograms();
    },
  },
  async mounted() {
    await this.loadData();
  },
  methods: {
    debouncedSearch() {
      clearTimeout(this.debounceTimeout);
      this.debounceTimeout = setTimeout(() => {
        this.loadPrograms();
      }, 300);
    },

    async loadData() {
      await Promise.all([
        this.loadPrograms(),
        this.loadDepartments(),
        this.loadProgramTypes(),
        this.loadProgramModes(),
      ]);
    },

    async loadPrograms() {
      try {
        this.isLoading = true;
        logger.info("Loading programs...");

        const params = {
          page: this.currentPage,
          limit: this.perPage,
        };

        if (this.searchQuery) {
          params.search = this.searchQuery;
        }

        const response = await apiService.getPrograms(params);
        
        if (response.success) {
          this.programs = response.data;
          this.totalPrograms = response.pagination?.total || 0;
          logger.info("Programs loaded successfully", {
            count: this.programs.length,
            total: this.totalPrograms
          });
        } else {
          throw new Error(response.message || 'Failed to load programs');
        }
      } catch (error) {
        logger.error("Failed to load programs:", error);
        this.$swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to load programs",
          confirmButtonColor: "#1a5f5f",
        });
      } finally {
        this.isLoading = false;
      }
    },

    async loadDepartments() {
      try {
        const response = await apiService.getActiveDepartments();
        logger.info("Departments API response:", response);
        
        if (response.success) {
          // Handle nested structure: response.data.departments
          const departments = response.data?.departments || response.data;
          logger.info("Parsed departments:", departments);
          
          if (Array.isArray(departments)) {
            this.departments = departments;
            logger.info("Departments loaded:", { count: departments.length, first: departments[0] });
          } else {
            logger.warn("Invalid departments response structure:", response);
            this.departments = [];
          }
        } else {
          logger.warn("Departments API returned success: false:", response);
          this.departments = [];
        }
      } catch (error) {
        logger.error("Failed to load departments:", error);
        this.departments = [];
      }
    },

    async loadProgramTypes() {
      try {
        const response = await apiService.getProgramTypes();
        if (response.success && Array.isArray(response.data)) {
          this.programTypes = response.data;
        } else {
          logger.warn("Invalid program types response:", response);
          this.programTypes = [];
        }
      } catch (error) {
        logger.error("Failed to load program types:", error);
        this.programTypes = [];
      }
    },

    async loadProgramModes() {
      try {
        const response = await apiService.getProgramModes();
        if (response.success && Array.isArray(response.data)) {
          this.programModes = response.data;
        } else {
          logger.warn("Invalid program modes response:", response);
          this.programModes = [];
        }
      } catch (error) {
        logger.error("Failed to load program modes:", error);
        this.programModes = [];
      }
    },

    async showAddProgramModal() {
      // Ensure arrays are properly initialized
      if (!Array.isArray(this.departments)) {
        logger.warn("Departments is not an array, reinitializing...");
        this.departments = [];
      }
      if (!Array.isArray(this.programTypes)) {
        logger.warn("Program types is not an array, reinitializing...");
        this.programTypes = [];
      }
      if (!Array.isArray(this.programModes)) {
        logger.warn("Program modes is not an array, reinitializing...");
        this.programModes = [];
      }

      // If arrays are empty, try to reload the data
      if (this.departments.length === 0 || this.programTypes.length === 0 || this.programModes.length === 0) {
        logger.info("Some arrays are empty, reloading data...");
        try {
          await Promise.all([
            this.loadDepartments(),
            this.loadProgramTypes(),
            this.loadProgramModes(),
          ]);
        } catch (error) {
          logger.error("Failed to reload data for modal:", error);
          this.$swal.fire({
            icon: "error",
            title: "Error",
            text: "Failed to load required data. Please refresh the page and try again.",
            confirmButtonColor: "#1a5f5f",
          });
          return;
        }
      }

      const departmentOptions = this.departments
        .map((dept) => {
          const deptId = dept._id || dept.id;
          logger.info("Department option:", { name: dept.name, id: deptId });
          return `<option value="${deptId}">${dept.name}</option>`;
        })
        .join("");

      const typeOptions = this.programTypes
        .filter((type) => type.active)
        .map((type) => `<option value="${type.id}">${type.type}</option>`)
        .join("");

      const modeOptions = this.programModes
        .filter((mode) => mode.active)
        .map((mode) => `<option value="${mode.id}">${mode.mode}</option>`)
        .join("");

      const { value: result } = await this.$swal.fire({
        title: "Add New Program",
        html: `
          <div class="row g-3 text-start">
            <div class="col-12">
              <label class="form-label">Department</label>
              <select id="department" class="form-select" required>
                <option value="">Select Department</option>
                ${departmentOptions}
              </select>
            </div>
            <div class="col-12">
              <label class="form-label">Program Name</label>
              <input id="programName" class="form-control" placeholder="e.g., Nursing" required>
            </div>
            <div class="col-12">
              <label class="form-label">Description (Optional)</label>
              <textarea id="description" class="form-control" rows="3" placeholder="Program description..."></textarea>
            </div>

            <div class="col-12 d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
              <small class="fw-bold">Program Variants</small>
              <button type="button" class="btn btn-sm btn-outline-staff-primary" onclick="window.addVariantRow()">
                <i class="bi bi-plus"></i> Add Another Variant
              </button>
            </div>

            <div class="col-12">
              <div id="variantsContainer">
                <div class="variant-row row g-2 mb-2" data-index="0">
                  <div class="col-3">
                    <label class="form-label small">Type</label>
                    <select class="form-select form-select-sm variant-type" required>
                      <option value="">Select Type</option>
                      ${typeOptions}
                    </select>
                  </div>
                  <div class="col-3">
                    <label class="form-label small">Mode</label>
                    <select class="form-select form-select-sm variant-mode" required>
                      <option value="">Select Mode</option>
                      ${modeOptions}
                    </select>
                  </div>
                  <div class="col-3">
                    <label class="form-label small">Duration (Years)</label>
                    <input type="number" class="form-control form-control-sm variant-duration" min="1" max="10" required>
                  </div>
                  <div class="col-2">
                    <label class="form-label small">Active</label>
                    <div class="form-check">
                      <input class="form-check-input variant-active" type="checkbox" checked>
                    </div>
                  </div>
                  <div class="col-1">
                    <label class="form-label small">&nbsp;</label>
                    <button type="button" class="btn btn-sm btn-outline-danger d-block" onclick="window.removeVariantRow(0)" disabled>
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Add Program",
        confirmButtonColor: "#1a5f5f",
        width: "800px",
        didOpen: () => {
          let variantIndex = 0;

          window.addVariantRow = () => {
            variantIndex++;
            const container = document.getElementById('variantsContainer');
            const newRow = document.createElement('div');
            newRow.className = 'variant-row row g-2 mb-2';
            newRow.setAttribute('data-index', variantIndex);
            newRow.innerHTML = `
              <div class="col-3">
                <select class="form-select form-select-sm variant-type" required>
                  <option value="">Select Type</option>
                  ${typeOptions}
                </select>
              </div>
              <div class="col-3">
                <select class="form-select form-select-sm variant-mode" required>
                  <option value="">Select Mode</option>
                  ${modeOptions}
                </select>
              </div>
              <div class="col-3">
                <input type="number" class="form-control form-control-sm variant-duration" min="1" max="10" required>
              </div>
              <div class="col-2">
                <div class="form-check">
                  <input class="form-check-input variant-active" type="checkbox" checked>
                </div>
              </div>
              <div class="col-1">
                <button type="button" class="btn btn-sm btn-outline-danger d-block" onclick="window.removeVariantRow(${variantIndex})">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            `;
            container.appendChild(newRow);
            this.updateDeleteButtons();
          };

          window.removeVariantRow = (index) => {
            const row = document.querySelector(`[data-index="${index}"]`);
            if (row) {
              row.remove();
              this.updateDeleteButtons();
            }
          };

          this.updateDeleteButtons = () => {
            const rows = document.querySelectorAll('.variant-row');
            rows.forEach((row, idx) => {
              const deleteBtn = row.querySelector('button');
              deleteBtn.disabled = rows.length <= 1;
            });
          };
        },
        preConfirm: () => {
          const department = document.getElementById("department").value;
          const programName = document.getElementById("programName").value;
          const description = document.getElementById("description").value;

          if (!department || !programName) {
            this.$swal.showValidationMessage("Please fill in all required fields");
            return false;
          }

          // Collect all variants
          const variants = [];
          const variantRows = document.querySelectorAll('.variant-row');
          
          for (let row of variantRows) {
            const programTypeId = row.querySelector('.variant-type').value;
            const programModeId = row.querySelector('.variant-mode').value;
            const durationYears = parseInt(row.querySelector('.variant-duration').value);
            const active = row.querySelector('.variant-active').checked;

            if (!programTypeId || !programModeId || !durationYears) {
              this.$swal.showValidationMessage("Please fill in all variant fields");
              return false;
            }

            variants.push({
              programTypeId,
              programModeId,
              durationYears,
              active
            });
          }

          if (variants.length === 0) {
            this.$swal.showValidationMessage("Please add at least one program variant");
            return false;
          }

          return {
            departmentId: department,
            programName,
            description,
            variants
          };
        },
      });

      if (result) {
        await this.addPrograms(result);
      }
    },

    async addPrograms(programData) {
      try {
        logger.info("Adding new programs:", programData);

        const results = [];
        
        // Create programs sequentially to avoid race conditions with auto-incrementing codes
        for (const variant of programData.variants) {
          const programRequest = {
            departmentId: programData.departmentId,
            name: programData.programName,
            description: programData.description,
            programTypeId: variant.programTypeId,
            programModeId: variant.programModeId,
            durationYears: variant.durationYears,
            active: variant.active
          };
          
          logger.info("Creating program with data:", programRequest);
          
          try {
            const result = await apiService.createProgram(programRequest);
            results.push(result);
            
            if (!result.success) {
              throw new Error(result.message || 'Failed to create program variant');
            }
          } catch (error) {
            logger.error("Failed to create program variant:", error);
            throw new Error(`Failed to create variant: ${error.message}`);
          }
        }
        
        // Check if all requests succeeded
        const allSucceeded = results.every(result => result.success);
        
        if (allSucceeded) {
          this.$swal.fire({
            icon: "success",
            title: "Success",
            text: `${results.length} program variant(s) added successfully`,
            timer: 2000,
            showConfirmButton: false,
          });
          
          await this.loadPrograms();
          this.$emit("refresh");
        } else {
          throw new Error("Some program variants failed to create");
        }
      } catch (error) {
        logger.error("Failed to add programs:", error);
        this.$swal.fire({
          icon: "error",
          title: "Error",
          text: error.message || "Failed to add program variants",
          confirmButtonColor: "#1a5f5f",
        });
      }
    },

    async editProgramGroup(programGroup) {
      console.log('Edit modal data:', {
        programGroup,
        departments: this.departments,
        programTypes: this.programTypes,
        programModes: this.programModes
      });

      // Helper function to extract ID from stringified object or return as-is if already an ID
      const extractId = (value) => {
        if (typeof value === 'string') {
          // Check if it's a stringified object
          if (value.includes('ObjectId(')) {
            // Extract the ObjectId value using regex
            const match = value.match(/ObjectId\('([^']+)'\)/);
            return match ? match[1] : value;
          }
          return value;
        }
        return value?._id || value?.id || value;
      };

      // Ensure arrays are properly initialized
      if (!Array.isArray(this.departments)) this.departments = [];
      if (!Array.isArray(this.programTypes)) this.programTypes = [];
      if (!Array.isArray(this.programModes)) this.programModes = [];

      // Extract actual department ID
      const actualDepartmentId = extractId(programGroup.departmentId);
      
      console.log('Extracted IDs:', {
        originalDepartmentId: programGroup.departmentId,
        actualDepartmentId,
        variants: programGroup.variants.map(v => ({
          originalTypeId: v.programTypeId,
          actualTypeId: extractId(v.programTypeId),
          originalModeId: v.programModeId,
          actualModeId: extractId(v.programModeId)
        }))
      });

      const departmentOptions = this.departments
        .map((dept) => {
          const deptId = dept._id || dept.id;
          return `<option value="${deptId}" ${
            deptId === actualDepartmentId ? "selected" : ""
          }>${dept.name}</option>`;
        })
        .join("");

      const typeOptions = this.programTypes
        .filter((type) => type.active)
        .map((type) => `<option value="${type.id}">${type.type}</option>`)
        .join("");

      const modeOptions = this.programModes
        .filter((mode) => mode.active)
        .map((mode) => `<option value="${mode.id}">${mode.mode}</option>`)
        .join("");

      const { value: result } = await this.$swal.fire({
        title: "Edit Program",
        html: `
          <div class="row g-3 text-start">
            <div class="col-12">
              <label class="form-label">Department</label>
              <select id="department" class="form-select" required disabled>
                <option value="">Select Department</option>
                ${departmentOptions}
              </select>
            </div>
            <div class="col-12">
              <label class="form-label">Program Name</label>
              <input id="programName" class="form-control" value="${programGroup.name}" required disabled>
            </div>
            <div class="col-12">
              <label class="form-label">Description (Optional)</label>
              <textarea id="description" class="form-control" rows="3" disabled>${programGroup.description || ""}</textarea>
            </div>

            <div class="col-12 d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
              <small class="fw-bold">Program Variants</small>
              <button type="button" class="btn btn-sm btn-outline-staff-primary" onclick="window.addVariantRow()">
                <i class="bi bi-plus"></i> Add Another Variant
              </button>
            </div>

            <div class="col-12">
              <div id="variantsContainer">
                ${programGroup.variants.map((variant, index) => {
                  // Extract actual IDs from potentially stringified objects
                  const actualTypeId = extractId(variant.programTypeId);
                  const actualModeId = extractId(variant.programModeId);
                  
                  const typeOptionsForVariant = this.programTypes.filter(type => type.active).map(type => 
                    `<option value="${type.id}" ${type.id === actualTypeId ? 'selected' : ''}>${type.type}</option>`
                  ).join('');
                  
                  const modeOptionsForVariant = this.programModes.filter(mode => mode.active).map(mode => 
                    `<option value="${mode.id}" ${mode.id === actualModeId ? 'selected' : ''}>${mode.mode}</option>`
                  ).join('');
                  
                  return `
                  <div class="variant-row row g-2 mb-2" data-index="${index}" data-variant-id="${variant.id}">
                    <div class="col-3">
                      <label class="form-label small">Type</label>
                      <select class="form-select form-select-sm variant-type" required>
                        <option value="">Select Type</option>
                        ${typeOptionsForVariant}
                      </select>
                    </div>
                    <div class="col-3">
                      <label class="form-label small">Mode</label>
                      <select class="form-select form-select-sm variant-mode" required>
                        <option value="">Select Mode</option>
                        ${modeOptionsForVariant}
                      </select>
                    </div>
                    <div class="col-3">
                      <label class="form-label small">Duration (Years)</label>
                      <input type="number" class="form-control form-control-sm variant-duration" min="1" max="10" value="${variant.durationYears || ''}" required>
                    </div>
                    <div class="col-2">
                      <label class="form-label small">Active</label>
                      <div class="form-check">
                        <input class="form-check-input variant-active" type="checkbox" ${variant.active ? 'checked' : ''}>
                      </div>
                    </div>
                    <div class="col-1">
                      <label class="form-label small">&nbsp;</label>
                      <button type="button" class="btn btn-sm btn-outline-danger d-block" onclick="window.removeVariantRow(${index})" ${programGroup.variants.length <= 1 ? 'disabled' : ''}>
                        <i class="bi bi-trash"></i>
                      </button>
                    </div>
                  </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Update Program",
        confirmButtonColor: "#1a5f5f",
        width: "800px",
        didOpen: () => {
          let variantIndex = programGroup.variants.length - 1;

          window.addVariantRow = () => {
            variantIndex++;
            const container = document.getElementById('variantsContainer');
            const newRow = document.createElement('div');
            newRow.className = 'variant-row row g-2 mb-2';
            newRow.setAttribute('data-index', variantIndex);
            newRow.innerHTML = `
              <div class="col-3">
                <select class="form-select form-select-sm variant-type" required>
                  <option value="">Select Type</option>
                  ${typeOptions}
                </select>
              </div>
              <div class="col-3">
                <select class="form-select form-select-sm variant-mode" required>
                  <option value="">Select Mode</option>
                  ${modeOptions}
                </select>
              </div>
              <div class="col-3">
                <input type="number" class="form-control form-control-sm variant-duration" min="1" max="10" required>
              </div>
              <div class="col-2">
                <div class="form-check">
                  <input class="form-check-input variant-active" type="checkbox" checked>
                </div>
              </div>
              <div class="col-1">
                <button type="button" class="btn btn-sm btn-outline-danger d-block" onclick="window.removeVariantRow(${variantIndex})">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            `;
            container.appendChild(newRow);
            this.updateDeleteButtons();
          };

          window.removeVariantRow = (index) => {
            const row = document.querySelector(`[data-index="${index}"]`);
            if (row) {
              row.remove();
              this.updateDeleteButtons();
            }
          };

          this.updateDeleteButtons = () => {
            const rows = document.querySelectorAll('.variant-row');
            rows.forEach((row, idx) => {
              const deleteBtn = row.querySelector('button');
              deleteBtn.disabled = rows.length <= 1;
            });
          };
        },
        preConfirm: () => {
          const department = document.getElementById("department").value;
          const programName = document.getElementById("programName").value;
          const description = document.getElementById("description").value;

          if (!department || !programName) {
            this.$swal.showValidationMessage("Please fill in all required fields");
            return false;
          }

          // Collect all variants
          const variants = [];
          const variantRows = document.querySelectorAll('.variant-row');
          
          for (let row of variantRows) {
            const programTypeId = row.querySelector('.variant-type').value;
            const programModeId = row.querySelector('.variant-mode').value;
            const durationYears = parseInt(row.querySelector('.variant-duration').value);
            const active = row.querySelector('.variant-active').checked;
            const variantId = row.getAttribute('data-variant-id'); // For existing variants

            if (!programTypeId || !programModeId || !durationYears) {
              this.$swal.showValidationMessage("Please fill in all variant fields");
              return false;
            }

            variants.push({
              id: variantId, // Will be null for new variants
              programTypeId,
              programModeId,
              durationYears,
              active
            });
          }

          if (variants.length === 0) {
            this.$swal.showValidationMessage("Please add at least one program variant");
            return false;
          }

          return {
            departmentId: department,
            programName,
            description,
            variants,
            originalGroup: programGroup
          };
        },
      });

      if (result) {
        await this.updateProgramGroup(result);
      }
    },

    async updateProgramGroup(programData) {
      try {
        logger.info("Updating program group:", programData);

        // Separate existing and new variants
        const existingVariants = programData.variants.filter(v => v.id);
        const newVariants = programData.variants.filter(v => !v.id);
        const existingVariantIds = existingVariants.map(v => v.id);
        const originalVariantIds = programData.originalGroup.variants.map(v => v.id);

        // Find variants to delete (in original but not in current)
        const variantsToDelete = originalVariantIds.filter(id => !existingVariantIds.includes(id));

        const operations = [];

        // Update existing variants
        existingVariants.forEach(variant => {
          operations.push(
            apiService.updateProgram(variant.id, {
              departmentId: programData.departmentId,
              name: programData.programName,
              description: programData.description,
              programTypeId: variant.programTypeId,
              programModeId: variant.programModeId,
              durationYears: variant.durationYears,
              active: variant.active
            })
          );
        });

        // Create new variants
        newVariants.forEach(variant => {
          operations.push(
            apiService.createProgram({
              departmentId: programData.departmentId,
              name: programData.programName,
              description: programData.description,
              programTypeId: variant.programTypeId,
              programModeId: variant.programModeId,
              durationYears: variant.durationYears,
              active: variant.active
            })
          );
        });

        // Delete removed variants
        variantsToDelete.forEach(variantId => {
          operations.push(apiService.deleteProgram(variantId));
        });

        const results = await Promise.all(operations);
        
        // Check if all requests succeeded
        const allSucceeded = results.every(result => result.success);
        
        if (allSucceeded) {
          this.$swal.fire({
            icon: "success",
            title: "Success",
            text: "Program updated successfully",
            timer: 2000,
            showConfirmButton: false,
          });
          
          await this.loadPrograms();
          this.$emit("refresh");
        } else {
          throw new Error("Some program operations failed");
        }
      } catch (error) {
        logger.error("Failed to update program group:", error);
        this.$swal.fire({
          icon: "error",
          title: "Error",
          text: "Failed to update program",
          confirmButtonColor: "#1a5f5f",
        });
      }
    },

    async deleteProgramGroup(programGroup) {
      const result = await this.$swal.fire({
        title: "Delete Program",
        text: `Are you sure you want to delete "${programGroup.name}" and all its variants? This action cannot be undone.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc3545",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Yes, delete it!",
      });

      if (result.isConfirmed) {
        try {
          logger.info("Deleting program group:", programGroup);
          
          // Delete all variants
          const deletePromises = programGroup.variants.map(variant => 
            apiService.deleteProgram(variant.id)
          );
          
          const results = await Promise.all(deletePromises);
          const allSucceeded = results.every(result => result.success);
          
          if (allSucceeded) {
            this.$swal.fire({
              icon: "success",
              title: "Deleted!",
              text: "Program and all variants have been deleted.",
              timer: 2000,
              showConfirmButton: false,
            });

            await this.loadPrograms();
            this.$emit("refresh");
          } else {
            throw new Error("Some program variants failed to delete");
          }
        } catch (error) {
          logger.error("Failed to delete program group:", error);
          this.$swal.fire({
            icon: "error",
            title: "Error",
            text: "Failed to delete program",
            confirmButtonColor: "#1a5f5f",
          });
        }
      }
    },

    async manageProgramTypes() {
      await this.showManagementModal("types", "Program Types");
    },

    async manageProgramModes() {
      await this.showManagementModal("modes", "Program Modes");
    },

    async showManagementModal(type, title) {
      const isTypes = type === "types";
      const items = isTypes ? this.programTypes : this.programModes;
      const itemName = isTypes ? "Type" : "Mode";
      const itemField = isTypes ? "type" : "mode";

      const generateTable = () => {
        return items
          .map(
            (item) => `
          <tr data-id="${item.id}">
            <td>${item[itemField]}</td>
            <td>${item.description || '-'}</td>
            <td class="text-center">
              <span class="badge ${
                item.active ? "bg-success" : "bg-secondary"
              }">
                ${item.active ? "Active" : "Inactive"}
              </span>
            </td>
            <td class="text-center">
              <button class="btn btn-sm btn-outline-primary me-1" onclick="window.editItem('${item.id}')">
                <i class="bi bi-pencil"></i>
              </button>
              <button class="btn btn-sm btn-outline-secondary me-1" onclick="window.toggleItem('${item.id}')">
                <i class="bi bi-toggle-${item.active ? "on" : "off"}"></i>
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="window.deleteItem('${item.id}')">
                <i class="bi bi-trash"></i>
              </button>
            </td>
          </tr>
        `
          )
          .join("");
      };

      await this.$swal.fire({
        title: `Manage ${title}`,
        html: `
          <div class="text-start">
            <!-- Add New Form -->
            <div class="card p-0 mb-3">
              <div class="card-body">
                <div class="row g-2">
                  <div class="col-md-4">
                    <input type="text" id="new${itemName}" class="form-control form-control-sm" placeholder="Enter ${itemName} here" maxlength="2">
                  </div>
                  <div class="col-md-6">
                    <input type="text" id="newDescription" class="form-control form-control-sm" placeholder="Enter Description">
                  </div>
                  <div class="col-md-2">
                    <button class="btn btn-sm btn-primary w-100" onclick="window.addNew${itemName}()">
                      <i class="bi bi-plus-lg"></i> Add
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Table -->
            <div class="table-responsive" style="max-height: 400px; overflow-y: auto;">
              <table class="table table-sm table-hover">
                <thead class="table-light sticky-top">
                  <tr>
                    <th>${itemName}</th>
                    <th>Description</th>
                    <th class="text-center">Status</th>
                    <th class="text-center">Actions</th>
                  </tr>
                </thead>
                <tbody id="itemsTableBody">
                  ${generateTable()}
                </tbody>
              </table>
            </div>
          </div>
        `,
        showCloseButton: true,
        showConfirmButton: false,
        width: "900px",
        didOpen: () => {
          const refreshTable = () => {
            const tableBody = document.getElementById('itemsTableBody');
            if (tableBody) {
              tableBody.innerHTML = generateTable();
            }
          };

          window.addNewType = async () => await this.addNewItem(type, itemName, itemField, refreshTable);
          window.addNewMode = async () => await this.addNewItem(type, itemName, itemField, refreshTable);
          window.editItem = async (id) => await this.editItem(type, id, itemField, refreshTable);
          window.toggleItem = async (id) => await this.toggleItem(type, id, refreshTable);
          window.deleteItem = async (id) => await this.deleteItem(type, id, refreshTable);
        },
        willClose: () => {
          // Clean up global functions
          delete window.addNewType;
          delete window.addNewMode;
          delete window.editItem;
          delete window.toggleItem;
          delete window.deleteItem;
        }
      });
    },

    async addNewItem(type, itemName, itemField, refreshTable) {
      const nameInput = document.getElementById(`new${itemName}`);
      const descInput = document.getElementById("newDescription");

      const name = nameInput.value.trim();
      const description = descInput.value.trim();

      if (!name) {
        this.$swal.showValidationMessage(`Please enter a ${itemName.toLowerCase()}`);
        return;
      }

      if (name.length > 2) {
        this.$swal.showValidationMessage(`${itemName} must be maximum 2 characters`);
        return;
      }

      try {
        const data = {
          [itemField]: name.toUpperCase(), // Convert to uppercase
          description: description,
          active: true
        };

        const response = type === "types" 
          ? await apiService.createProgramType(data)
          : await apiService.createProgramMode(data);

        if (response.success) {
          // Update local data
          const items = type === "types" ? this.programTypes : this.programModes;
          items.unshift(response.data);

          // Clear inputs
          nameInput.value = "";
          descInput.value = "";

          // Only refresh table if modal is still open
          if (document.getElementById('itemsTableBody')) {
            refreshTable();
          }

          this.$swal.fire({
            icon: "success",
            title: "Added!",
            text: `${itemName} added successfully`,
            timer: 1500,
            showConfirmButton: false,
          });
        } else {
          throw new Error(response.message || `Failed to add ${itemName.toLowerCase()}`);
        }
      } catch (error) {
        this.$swal.fire({
          icon: "error",
          title: "Error",
          text: error.message,
          confirmButtonColor: "#1a5f5f",
        });
      }
    },

    async editItem(type, id, itemField, refreshTable) {
      const items = type === "types" ? this.programTypes : this.programModes;
      const item = items.find(i => i.id === id);
      
      if (!item) return;

      const { value: formValues } = await this.$swal.fire({
        title: `Edit ${type === "types" ? "Program Type" : "Program Mode"}`,
        html: `
          <div class="row g-3 text-start">
            <div class="col-12">
              <label class="form-label">${type === "types" ? "Type" : "Mode"}</label>
              <input id="itemName" class="form-control text-uppercase" value="${item[itemField]}" maxlength="2" style="text-transform: uppercase;">
            </div>
            <div class="col-12">
              <label class="form-label">Description</label>
              <input id="itemDescription" class="form-control" value="${item.description || ""}">
            </div>
            <div class="col-12">
              <div class="form-check">
                <input class="form-check-input" type="checkbox" id="itemActive" ${item.active ? "checked" : ""}>
                <label class="form-check-label" for="itemActive">Active</label>
              </div>
            </div>
          </div>
        `,
        showCancelButton: true,
        confirmButtonText: "Update",
        confirmButtonColor: "#1a5f5f",
        preConfirm: () => {
          const name = document.getElementById("itemName").value.trim();
          const description = document.getElementById("itemDescription").value.trim();
          const active = document.getElementById("itemActive").checked;

          if (!name) {
            this.$swal.showValidationMessage("Please enter a name");
            return false;
          }

          if (name.length > 2) {
            this.$swal.showValidationMessage("Name must be maximum 2 characters");
            return false;
          }

          return {
            [itemField]: name.toUpperCase(), // Convert to uppercase
            description,
            active
          };
        },
      });

      if (formValues) {
        try {
          const response = type === "types" 
            ? await apiService.updateProgramType(id, formValues)
            : await apiService.updateProgramMode(id, formValues);

          if (response.success) {
            // Update local data
            const itemIndex = items.findIndex(i => i.id === id);
            if (itemIndex !== -1) {
              items[itemIndex] = response.data;
            }

            // Only refresh table if modal is still open
            if (document.getElementById('itemsTableBody')) {
              refreshTable();
            }

            this.$swal.fire({
              icon: "success",
              title: "Updated!",
              text: `${type === "types" ? "Program type" : "Program mode"} updated successfully`,
              timer: 1500,
              showConfirmButton: false,
            });
          } else {
            throw new Error(response.message || "Failed to update");
          }
        } catch (error) {
          this.$swal.fire({
            icon: "error",
            title: "Error",
            text: error.message,
            confirmButtonColor: "#1a5f5f",
          });
        }
      }
    },

    async toggleItem(type, id, refreshTable) {
      try {
        const response = type === "types" 
          ? await apiService.toggleProgramTypeStatus(id)
          : await apiService.toggleProgramModeStatus(id);

        if (response.success) {
          // Update local data
          const items = type === "types" ? this.programTypes : this.programModes;
          const item = items.find(i => i.id === id);
          if (item) {
            item.active = response.data.active;
          }

          // Only refresh table if modal is still open
          if (document.getElementById('itemsTableBody')) {
            refreshTable();
          }
        } else {
          throw new Error(response.message || "Failed to toggle status");
        }
      } catch (error) {
        this.$swal.fire({
          icon: "error",
          title: "Error",
          text: error.message,
          confirmButtonColor: "#1a5f5f",
        });
      }
    },

    async deleteItem(type, id, refreshTable) {
      const result = await this.$swal.fire({
        title: "Delete Item",
        text: "Are you sure you want to delete this item?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#dc3545",
        cancelButtonColor: "#6c757d",
        confirmButtonText: "Yes, delete it!",
      });

      if (result.isConfirmed) {
        try {
          const response = type === "types" 
            ? await apiService.deleteProgramType(id)
            : await apiService.deleteProgramMode(id);

          if (response.success) {
            // Update local data
            const items = type === "types" ? this.programTypes : this.programModes;
            const index = items.findIndex(i => i.id === id);
            if (index !== -1) {
              items.splice(index, 1);
            }

            // Only refresh table if modal is still open
            if (document.getElementById('itemsTableBody')) {
              refreshTable();
            }

            this.$swal.fire({
              icon: "success",
              title: "Deleted!",
              text: "Item has been deleted.",
              timer: 1500,
              showConfirmButton: false,
            });
          } else {
            throw new Error(response.message || "Failed to delete");
          }
        } catch (error) {
          this.$swal.fire({
            icon: "error",
            title: "Error",
            text: error.message,
            confirmButtonColor: "#1a5f5f",
          });
        }
      }
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
                <label class="form-label">Search Programs</label>
                <input
                  v-model="searchQuery"
                  type="text"
                  class="form-control"
                  placeholder="Search by program code, name, or department..."
                />
              </div>
              <div class="col-md-3">
                <button
                  class="btn btn-staff-primary w-100"
                  @click="showAddProgramModal"
                >
                  <i class="bi bi-plus-circle me-2"></i>Add New Program
                </button>
              </div>
              <div class="col-md-3">
                <div class="btn-group w-100">
                  <button
                    class="btn btn-outline-staff-primary"
                    @click="manageProgramTypes"
                  >
                    <i class="bi bi-tags me-1"></i>Types
                  </button>
                  <button
                    class="btn btn-outline-staff-primary"
                    @click="manageProgramModes"
                  >
                    <i class="bi bi-gear me-1"></i>Modes
                  </button>
                </div>
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
      <p class="mt-3 text-muted">Loading programs...</p>
    </div>

    <!-- Programs Table -->
    <div v-else class="row">
      <div class="col-12">
        <div class="card p-0 border-0 shadow-sm">
          <div class="card-body p-0">
            <div class="table-responsive">
              <table class="table table-hover mb-0">
                <thead class="table-light">
                  <tr>
                    <!-- <th>Code</th> -->
                    <th>Name</th>
                    <th>Department</th>
                    <th>Program Offerings</th>
                    <!-- <th>Duration</th> -->
                    <th class="text-center">Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-if="groupedPrograms.length === 0">
                    <td colspan="5" class="text-center py-5">
                      <div class="text-muted">
                        <i class="bi bi-book-x fs-1 mb-3 d-block"></i>
                        <h5 class="mb-2">No Programs Found</h5>
                        <p class="mb-0" v-if="searchQuery">
                          No programs match your search criteria.
                        </p>
                        <p class="mb-0" v-else>
                          No programs have been created yet.
                        </p>
                      </div>
                    </td>
                  </tr>

                  <tr v-for="programGroup in groupedPrograms" :key="`${programGroup.name}_${programGroup.departmentId}`">
                    <td>
                      <div class="fw-medium">{{ programGroup.name }}</div>
                      <small class="text-muted" v-if="programGroup.description">{{ programGroup.description }}</small>
                    </td>
                    <td>
                      <span class="badge bg-secondary">{{ programGroup.department || 'N/A' }}</span>
                    </td>
                    <td>
                      <div class="d-flex flex-wrap gap-1">
                        <span 
                          v-for="variant in programGroup.variants" 
                          :key="variant.id"
                          class="badge text-white small d-inline-flex align-items-center gap-1"
                          :class="variant.active ? 'bg-info' : 'bg-secondary'"
                          :title="`${variant.programType || 'Unknown type'} ${variant.programMode || 'Unknown mode'} - ${variant.durationYears || 'N/A'} year(s) - ${variant.active ? 'Active' : 'Inactive'}`"
                        >
                          <span>{{ variant.programType || 'Type N/A' }}</span>
                          <span>{{ variant.programMode || 'Mode N/A' }}</span>
                          <small v-if="!variant.active" class="opacity-75">(Inactive)</small>
                        </span>
                      </div>
                    </td>
                    <td class="text-center">
                      <span
                        class="badge rounded-pill"
                        :class="programGroup.hasActiveVariants ? 'bg-success' : 'bg-secondary'"
                      >
                        {{ programGroup.hasActiveVariants ? "Active" : "Inactive" }}
                      </span>
                    </td>
                    <td>
                      <div class="btn-group btn-group-sm">
                        <button
                          class="btn btn-outline-success btn-sm"
                          @click="editProgramGroup(programGroup)"
                          title="Edit Program"
                        >
                          <i class="bi bi-pencil"></i>
                        </button>
                        <button
                          class="btn btn-outline-danger btn-sm"
                          @click="deleteProgramGroup(programGroup)"
                          title="Delete Program"
                        >
                          <i class="bi bi-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Pagination -->
          <div class="card-footer border-top-0 bg-transparent" v-if="totalPages > 1">
            <nav>
              <ul class="pagination pagination-sm mb-0 justify-content-center">
                <li class="page-item" :class="{ disabled: currentPage === 1 }">
                  <button
                    class="page-link"
                    @click="currentPage = currentPage - 1"
                    :disabled="currentPage === 1"
                  >
                    Previous
                  </button>
                </li>
                <li
                  class="page-item"
                  :class="{ active: currentPage === page }"
                  v-for="page in totalPages"
                  :key="page"
                >
                  <button class="page-link" @click="currentPage = page">
                    {{ page }}
                  </button>
                </li>
                <li
                  class="page-item"
                  :class="{ disabled: currentPage === totalPages }"
                >
                  <button
                    class="page-link"
                    @click="currentPage = currentPage + 1"
                    :disabled="currentPage === totalPages"
                  >
                    Next
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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

.pagination .page-item.active .page-link {
  background-color: var(--staff-primary);
  border-color: var(--staff-primary);
  color: white;
}

code {
  font-size: 0.85rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background-color: var(--staff-light);
}

.badge {
  font-size: 0.75rem;
}

.badge.small {
  font-size: 0.65rem;
}
</style>

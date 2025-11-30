import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { apiService } from "../services/api.js";
import { logger } from "@shared/utils/logger";

export const useAuthStore = defineStore("auth", () => {
    // State
    const user = ref(null);
    const application = ref(null);
    const student = ref(null); // Student-specific data from Student collection
    const token = ref(null);
    const isLoading = ref(false);
    const isInitialized = ref(false);
    const isLoggingOut = ref(false); // Flag to handle logout navigation

    // Getters
    const isAuthenticated = computed(() => !!user.value && !!token.value);
    const userName = computed(() => {
        if (!user.value) return "";
        return `${user.value.firstName} ${user.value.lastName}`.trim();
    });
    const userFirstName = computed(() => user.value?.firstName || "n/a");
    const userEmail = computed(() => user.value?.email || "");
    const isStudent = computed(() => user.value?.role === "student");

    // Student-specific getters
    const matriculationNumber = computed(
        () => student.value?.matriculationNumber || ""
    );
    const currentLevel = computed(() => student.value?.currentLevel || 0);
    const currentSemester = computed(() => student.value?.currentSemester || 0);
    const studentStatus = computed(() => student.value?.status || "n/a");
    const cumulativeGPA = computed(() => student.value?.cumulativeGPA || 0.0);
    const profileImageUrl = computed(
        () =>
            student.value?.profileImageUrl ||
            application.value?.profileImageUrl ||
            null
    );

    // Program information getters
    const programType = computed(() => student.value?.programType?.type || "");
    const programName = computed(() => student.value?.program?.name || "");
    const programCode = computed(() => student.value?.program?.code || "");
    const programModeCode = computed(
        () => student.value?.programMode?.mode || ""
    );
    const programMode = computed(
        () => student.value?.programMode?.description || ""
    );

    // Full program display (e.g., "ND Nursing", "HND Computer Science")
    const fullProgramName = computed(() => {
        const type = programType.value;
        const name = programName.value;

        if (type && name) {
            return `${type} ${name}`;
        } else if (name) {
            return name;
        } else if (type) {
            return type;
        }
        return "Not Available";
    });

    // Program with mode (e.g., "ND Nursing (Full Time)")
    const fullProgramWithMode = computed(() => {
        const program = fullProgramName.value;
        const mode = programMode.value;

        if (program !== "Not Available" && mode) {
            return `${program} (${mode})`;
        }
        return program;
    });

    // Actions
    async function initialize() {
        if (isInitialized.value) {
            logger.debug("Auth store already initialized");
            return;
        }

        try {
            isLoading.value = true;
            logger.debug("Initializing auth store...");

            // Get token from localStorage
            const storedToken = localStorage.getItem("student_token");
            logger.debug("Stored token found:", !!storedToken);

            if (!storedToken) {
                logger.debug("No stored token found, initialization complete");
                isInitialized.value = true;
                return;
            }

            // Set token and fetch fresh user data
            token.value = storedToken;
            logger.debug("Token set, fetching user data...");
            await fetchUserData();
            logger.debug("Auth initialization successful");
        } catch (error) {
            logger.error("Failed to initialize auth store:", error.message);
            logger.error("Error details:", error);
            // If initialization fails, clear everything
            await logout();
        } finally {
            isLoading.value = false;
            isInitialized.value = true;
            logger.debug("Auth store initialization complete");
        }
    }

    async function login(credentials) {
        try {
            isLoading.value = true;

            const response = await apiService.login(credentials);

            // Handle both wrapped (success/data) and unwrapped responses
            const loginData = response.success ? response.data : response;

            if (response.success || loginData.access_token) {
                // Validate user role - only students can access student portal
                const userRole = loginData.user?.role;
                if (userRole !== "student") {
                    const errorMsg = `Access denied. This portal is for students only. Your role: ${userRole}`;
                    return { success: false, error: errorMsg };
                }

                // Set token
                const accessToken = loginData.access_token;
                token.value = accessToken;
                localStorage.setItem("student_token", accessToken);

                // Set user data
                user.value = loginData.user;
                application.value = loginData.application || null;
                student.value = null; // Will be loaded by fetchUserData during initialization

                return { success: true };
            } else {
                const errorMsg = response.error || response.message || "Login failed";
                return { success: false, error: errorMsg };
            }
        } catch (error) {
            logger.error("Login error:", error.message);
            return { success: false, error: error.message || "Login failed" };
        } finally {
            isLoading.value = false;
        }
    }

    async function fetchUserData() {
        try {
            if (!token.value) {
                throw new Error("No authentication token available");
            }

            logger.debug(
                "Fetching user data with token:",
                token.value.substring(0, 20) + "..."
            );

            // Get current user profile using standard auth endpoint
            const profileResponse = await apiService.getProfile();
            logger.debug("Profile response received:", {
                success: profileResponse.success,
                hasUser: !!profileResponse.data?.user,
                hasApplication: !!profileResponse.data?.application,
            });

            if (profileResponse.success) {
                user.value = profileResponse.data.user;
                application.value = profileResponse.data.application || null;

                // Try to load student-specific data if user is a student
                if (user.value?.role === "student") {
                    try {
                        const studentResponse = await apiService.getStudentProfile();
                        if (studentResponse.success && studentResponse.data?.student) {
                            student.value = studentResponse.data.student;
                            logger.debug("Student data loaded successfully:", {
                                studentId: student.value?.id,
                                matriculationNumber: student.value?.matriculationNumber,
                            });
                        }
                    } catch (error) {
                        logger.warn("Failed to load student-specific data:", error.message);
                        student.value = null; // Clear student data on error
                    }
                } else {
                    student.value = null; // Clear if not a student
                }

                logger.debug("User data set successfully:", {
                    userId: user.value?.id,
                    userRole: user.value?.role,
                    applicationId: application.value?.id,
                    hasStudentData: !!student.value,
                });
            } else {
                const errorMsg = profileResponse.error || "Failed to fetch user data";
                logger.error("Profile response unsuccessful:", errorMsg);
                throw new Error(errorMsg);
            }
        } catch (error) {
            logger.error("Failed to fetch user data:", error.message);
            logger.error("Error details:", error);

            // If we can't fetch user data with a valid token, it's likely expired
            if (
                error.message.includes("Authentication") ||
                error.message.includes("Unauthorized") ||
                error.message.includes("401")
            ) {
                logger.warn("Token appears to be expired, logging out");
                await logout();
                throw new Error("Session expired. Please login again.");
            }

            throw error;
        }
    }

    async function refreshUserData() {
        try {
            await fetchUserData();
            return { success: true };
        } catch (error) {
            logger.error("Failed to refresh user data:", error.message);
            return { success: false, error: error.message };
        }
    }

    async function loadStudentData() {
        try {
            if (!user.value || user.value.role !== "student") {
                logger.debug("User is not a student, skipping student data load");
                return { success: false, error: "User is not a student" };
            }

            const studentResponse = await apiService.getStudentProfile();
            if (studentResponse.success && studentResponse.data?.student) {
                student.value = studentResponse.data.student;
                logger.debug("Student data loaded:", {
                    studentId: student.value.id,
                    matriculationNumber: student.value.matriculationNumber,
                });
                return { success: true, data: student.value };
            } else {
                logger.warn("Failed to load student data:", studentResponse.error);
                return {
                    success: false,
                    error: studentResponse.error || "Failed to load student data",
                };
            }
        } catch (error) {
            logger.error("Error loading student data:", error.message);
            return { success: false, error: error.message };
        }
    }

    async function logout() {
        try {
            isLoggingOut.value = true;

            // Clear state
            user.value = null;
            application.value = null;
            student.value = null;
            token.value = null;

            // Clear localStorage
            localStorage.removeItem("student_token");

            // Wait a tick for reactivity to update
            await new Promise((resolve) => setTimeout(resolve, 10));
        } catch (error) {
            logger.error("Error during logout:", error.message);
        } finally {
            // Keep the logging out flag until navigation completes
            // It will be cleared in the component after navigation
        }
    }

    // Helper to complete logout navigation
    function completeLogout() {
        isLoggingOut.value = false;
    }

    // Helper to handle authentication errors from API calls
    function handleAuthError() {
        logout();
    }

    return {
        // State
        user,
        application,
        student,
        token,
        isLoading,
        isInitialized,
        isLoggingOut,

        // Getters
        isAuthenticated,
        userName,
        userFirstName,
        userEmail,
        isStudent,
        matriculationNumber,
        currentLevel,
        currentSemester,
        studentStatus,
        cumulativeGPA,
        profileImageUrl,
        // Program information
        programType,
        programName,
        programCode,
        programModeCode,
        programMode,
        fullProgramName,
        fullProgramWithMode,

        // Actions
        initialize,
        login,
        logout,
        completeLogout,
        fetchUserData,
        refreshUserData,
        loadStudentData,
        handleAuthError,
    };
});

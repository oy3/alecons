<script>
import { useAuthStore } from "../../stores/auth.js";
import AcademicResults from "../academics/components/AcademicResults.vue";
import GradeScaleManagement from "./components/GradeScaleManagement.vue";
import ResultReviewQueue from "./components/ResultReviewQueue.vue";

export default {
  name: "ResultGrading",
  components: { AcademicResults, GradeScaleManagement, ResultReviewQueue },
  data() {
    return { activeTab: "lecturer" };
  },
  setup() {
    return { authStore: useAuthStore() };
  },
  computed: {
    canEnterScores() {
      return this.authStore.hasPermission("academicResults", "enter_scores");
    },
    canReviewHod() {
      return this.authStore.hasPermission("academicResults", "review_hod");
    },
    canReviewProvost() {
      return this.authStore.hasPermission("academicResults", "review_provost");
    },
    canPublish() {
      return this.authStore.hasPermission("academicResults", "publish");
    },
    canConfigure() {
      return this.authStore.hasPermission("academicResults", "configure");
    },
    canViewPublished() {
      return ["view", "export", "amend"].some((permission) =>
        this.authStore.hasPermission("academicResults", permission),
      );
    },
  },
  async mounted() {
    await this.authStore.initialize();
    if (!this.authStore.hasModuleAccess("academicResults")) {
      await this.$swal.fire({
        icon: "error",
        title: "Access Denied",
        text: "You do not have permission to access result grading.",
      });
      this.$router.push("/dashboard");
      return;
    }
    if (this.canEnterScores) this.activeTab = "lecturer";
    else if (this.canReviewHod) this.activeTab = "hod";
    else if (this.canReviewProvost) this.activeTab = "provost";
    else if (this.canPublish) this.activeTab = "publish";
    else if (this.canViewPublished) this.activeTab = "published";
    else if (this.canConfigure) this.activeTab = "grade-scales";
    else this.activeTab = "";
  },
};
</script>

<template>
  <div class="container-fluid p-4">
    <div class="mb-4">
      <h2 class="fw-bold text-staff-primary mb-1">Result Grading</h2>
      <p class="text-muted mb-0">
        Configure course assessments, enter scores, review results, and publish
        approved academic records.
      </p>
    </div>
    <ul class="nav nav-tabs mb-4" role="tablist">
      <li v-if="canEnterScores" class="nav-item">
        <button
          class="nav-link rounded-bottom-0 bg-transparent"
          :class="{ active: activeTab === 'lecturer' }"
          @click="activeTab = 'lecturer'"
        >
          Lecturer Entry
        </button>
      </li>
      <li v-if="canReviewHod" class="nav-item">
        <button
          class="nav-link rounded-bottom-0 bg-transparent"
          :class="{ active: activeTab === 'hod' }"
          @click="activeTab = 'hod'"
        >
          HOD Queue
        </button>
      </li>
      <li v-if="canReviewHod" class="nav-item">
        <button
          class="nav-link rounded-bottom-0 bg-transparent"
          :class="{ active: activeTab === 'hod-ready' }"
          @click="activeTab = 'hod-ready'"
        >
          Ready for Provost
        </button>
      </li>
      <li v-if="canReviewProvost" class="nav-item">
        <button
          class="nav-link rounded-bottom-0 bg-transparent"
          :class="{ active: activeTab === 'provost' }"
          @click="activeTab = 'provost'"
        >
          Provost Queue
        </button>
      </li>
      <li v-if="canPublish" class="nav-item">
        <button
          class="nav-link rounded-bottom-0 bg-transparent"
          :class="{ active: activeTab === 'publish' }"
          @click="activeTab = 'publish'"
        >
          Publication Queue
        </button>
      </li>
      <li v-if="canViewPublished" class="nav-item">
        <button
          class="nav-link rounded-bottom-0 bg-transparent"
          :class="{ active: activeTab === 'published' }"
          @click="activeTab = 'published'"
        >
          Published Results
        </button>
      </li>
      <li v-if="canConfigure" class="nav-item">
        <button
          class="nav-link rounded-bottom-0 bg-transparent"
          :class="{ active: activeTab === 'grade-scales' }"
          @click="activeTab = 'grade-scales'"
        >
          Grade Scales
        </button>
      </li>
    </ul>
    <AcademicResults v-if="activeTab === 'lecturer'" />
    <ResultReviewQueue v-else-if="activeTab === 'hod'" queue="hod" />
    <ResultReviewQueue
      v-else-if="activeTab === 'hod-ready'"
      queue="hod-ready"
    />
    <ResultReviewQueue v-else-if="activeTab === 'provost'" queue="provost" />
    <ResultReviewQueue v-else-if="activeTab === 'publish'" queue="publish" />
    <ResultReviewQueue
      v-else-if="activeTab === 'published'"
      queue="published"
    />
    <GradeScaleManagement v-else-if="activeTab === 'grade-scales'" />
    <div v-else class="alert alert-warning">
      Your role has Result Grading access but no workflow action permission.
    </div>
  </div>
</template>

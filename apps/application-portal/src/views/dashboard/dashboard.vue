<script lang="js">

import TodoList from "./components/TodoList.vue";
import BiodataCard from "./components/BiodataCard.vue";
import ProgressCard from "./components/ProgressCard.vue";

export default {
  name: "Dashboard",
  data() {
    return {
      todos: [
        { title: "Submit Application", description: "Complete and submit your form" },
        { title: "Make Payment", description: "Pay the application fee" },
        { title: "Upload Documents", description: "Upload all required credentials" },
        { title: "Check Status", description: "Track your application progress" },
        { title: "Attend Interview", description: "Be available for the scheduled interview" },
      ],
      stages: [
        "Registration",
        "Form Fee",
        "Application Form",
        "Admission",
        "Acceptance Fee",
        "Clearance",
        "Admin Fee",
        "School Fees",
        "Done",
      ],
      currentStage: 1,
    };
  },
  mounted() {},
  methods: {},
  computed: {
    progressPercent() {
      return (this.currentStage / (this.stages.length - 1)) * 100;
    },
  },
  components: { TodoList, BiodataCard, ProgressCard },
};
</script>

<template>
  <div class="container-fluid mt-3  p-5">
    <div class="row g-5">
      <div class="col-lg-8 col-12">
        <ProgressCard
          class="mb-4"
          :stages="stages"
          :currentStage="currentStage"
          name="John"
        />

        <!-- To-do -->
        <TodoList :todos="todos" />
      </div>

      <!-- Bio Data Card -->
      <div class="col-lg-4 col-12">
        <BiodataCard
          profileImage="https://placehold.co/100"
          name="John Doe"
          appNo="1234567890"
          email="johndoe@example.com"
          phone="080123456789"
          gender="Male"
          location="Lagos"
        />
      </div>
    </div>
  </div>
</template>

<style scoped></style>

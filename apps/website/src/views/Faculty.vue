<script lang="js">
export default {
  metaInfo: {
    title: "Our Faculty - Alecons College of Nursing Sciences",
    meta: [
      {
        name: "description",
        content:
          "Meet our experienced and dedicated faculty members who are committed to providing high-quality nursing education and mentorship.",
      },
      {
        name: "keywords",
        content:
          "nursing faculty Nigeria, Alecons College of Nursing Sciences teachers, nursing lecturers, healthcare educators, alecons",
      },
    ],
  },
  name: "Faculty",
  data() {
    return {
      currentPage: 1,
      facultyPerPage: 6,
      publishedPapersLabel: "10+",
      stats: [
        {
          icon: "bi bi-people",
          label: "Expert Faculty",
          valueKey: "totalFaculty",
        },
        {
          icon: "bi bi-mortarboard",
          label: "PhD Holders",
          valueKey: "phdFaculty",
        },
        {
          icon: "bi bi-book",
          label: "Average Years Experience",
          valueKey: "averageExperience",
        },
        {
          icon: "bi bi-award",
          label: "Published Papers",
          valueKey: "publishedPapers",
        },
      ],
      departments: [
        {
          name: "Nursing Sciences",
          head: "Dr. Olaopa",
          facultyMembers: 8,
          description:
            "Core nursing education covering medical-surgical, pediatric, maternal, and psychiatric nursing.",
        },
        {
          name: "Midwifery",
          head: "-",
          facultyMembers: 0,
          description:
            "Specialized training in maternal and child health, reproductive health, and family planning.",
        },
        {
          name: "Public Health",
          head: "-",
          facultyMembers: 0,
          description:
            "Public health nursing, health promotion, and community-based healthcare interventions.",
        },
        // {
        //   name: "Nursing Research",
        //   head: "-",
        //   facultyMembers: 0,
        //   description:
        //     "Research methodology, evidence-based practice, and quality improvement in healthcare.",
        // },
      ],
      facultyMembers: [
        {
          name: "Mrs. Yewande Akute",
          role: "Provost",
          qualifications: "",
          department: "Administration",
          specialization: "Nursing Leadership & Mgt.",
          experience: "20+ years",
          experienceYears: 20,
          bio: "Mrs. Akute provides strategic leadership for the college and supports a strong academic culture grounded in student development and institutional growth.",
          email: "provost@alecons.edu.ng",
          phone: "+234 916 000 8679",
          image: "https://placehold.co/100x100?text=IMG",
        },
        {
          name: "Dr. Olaopa",
          role: "HOD Nursing",
          qualifications: "",
          department: "Nursing Sciences",
          specialization: "Anatomy",
          experience: "15+ years",
          experienceYears: 15,
          bio: "Dr. Olaopa leads the nursing unit with a strong focus on foundational training, helping students build confident clinical and academic skills from the start.",
          email: "hod.nursing@alecons.edu.ng",
          phone: "",
          image: "https://placehold.co/100x100?text=IMG",
        },
        {
          name: "Mr. Tunji Kehinde",
          role: "Registrar",
          qualifications: "",
          department: "Administration",
          specialization: "",
          experience: "15+ years",
          experienceYears: 15,
          bio: "Mr. Kehinde oversees key administrative processes and supports smooth academic operations across admissions, records, and institutional coordination.",
          email: "registrar@alecons.edu.ng",
          phone: "",
          image: "https://placehold.co/100x100?text=IMG",
        },
        {
          name: "Mr. Donatus Okoroji",
          role: "Bursar",
          qualifications: "",
          department: "Finance & Administration",
          specialization: "Use of Computer",
          experience: "4+ years",
          experienceYears: 4,
          bio: "Mr. Okoroji manages the college's financial administration and brings practical digital literacy support to institutional and academic processes.",
          email: "bursar@alecons.edu.ng",
          phone: "",
          image: "https://placehold.co/100x100?text=IMG",
        },
        {
          name: "Dr. Wura Owolabi",
          role: "Lecturer",
          qualifications: "",
          department: "Basic Medical Sciences",
          specialization: "Medical Microbiology / Physiology",
          experience: "10+ years",
          experienceYears: 10,
          bio: "Dr. Owolabi teaches core biomedical subjects and helps students connect scientific principles with practical nursing and patient care applications.",
          email: "wuraowolabi@alecons.edu.ng",
          phone: "",
          image: "https://placehold.co/100x100?text=IMG",
        },
        {
          name: "Mr. Olaoba",
          role: "Lecturer",
          qualifications: "",
          department: "Basic Medical Sciences",
          specialization: "Applied Chemistry",
          experience: "8+ years",
          experienceYears: 8,
          bio: "Mr. Olaoba delivers chemistry-based instruction that strengthens students' understanding of scientific concepts essential to healthcare training.",
          email: "olooba@alecons.edu.ng",
          phone: "",
          image: "https://placehold.co/100x100?text=IMG",
        },
        {
          name: "Mrs. Adeola Johnson",
          role: "Lecturer",
          qualifications: "",
          department: "Nursing Sciences",
          specialization: "Emergency Nursing",
          experience: "12+ years",
          experienceYears: 12,
          bio: "Mrs. Johnson supports students with practical instruction in emergency care while reinforcing responsible citizenship and professional conduct in training.",
          email: "adeolajohnson@alecons.edu.ng",
          phone: "",
          image: "https://placehold.co/100x100?text=IMG",
        },
        {
          name: "Mr. Taofeek",
          role: "Lecturer",
          qualifications: "",
          department: "Basic Medical Sciences",
          specialization: "Physics",
          experience: "9+ years",
          experienceYears: 9,
          bio: "Mr. Taofeek teaches physics with an applied approach that helps students understand measurement, energy, and core scientific reasoning in healthcare contexts.",
          email: "taofeek@alecons.edu.ng",
          phone: "",
          image: "https://placehold.co/100x100?text=IMG",
        },
        {
          name: "Mr. Akilo",
          role: "Lecturer",
          qualifications: "",
          department: "General Studies",
          specialization: "English",
          experience: "10+ years",
          experienceYears: 10,
          bio: "Mr. Akilo helps students strengthen communication, writing, and comprehension skills that support academic success and professional practice.",
          email: "akilo@alecons.edu.ng",
          phone: "",
          image: "https://placehold.co/100x100?text=IMG",
        },

        {
          name: "Mrs. Oso",
          role: "Hostel Matron",
          qualifications: "",
          department: "Student Affairs",
          specialization: "Clinical Instructor",
          experience: "10+ years",
          experienceYears: 10,
          bio: "Mrs. Oso supports student welfare in the hostel and guides learners through hands-on clinical expectations with a practical, student-focused approach.",
          email: "hostel.matron@alecons.edu.ng",
          phone: "",
          image: "https://placehold.co/100x100?text=IMG",
        },
        {
          name: "Mr. Oluwaseun",
          role: "Clerical Officer",
          qualifications: "",
          department: "Administration",
          specialization: "",
          experience: "5+ years",
          experienceYears: 5,
          bio: "Mr. Oluwaseun provides reception and clerical support, ensuring smooth communication and administrative operations for students and visitors.",
          email: "oluwaseun@alecons.edu.ng",
          phone: "",
          image: "https://placehold.co/100x100?text=IMG",
        },
      ],
    };
  },
  computed: {
    totalFaculty() {
      return `${this.facultyMembers.length}+`;
    },
    phdFaculty() {
      return this.facultyMembers.filter(
        (member) =>
          member.qualifications.includes("PhD") ||
          member.name.startsWith("Dr."),
      ).length;
    },
    averageExperience() {
      const totalYears = this.facultyMembers.reduce(
        (sum, member) => sum + member.experienceYears,
        0,
      );
      const averageYears = Math.round(totalYears / this.facultyMembers.length);

      return `${averageYears}+`;
    },
    publishedPapers() {
      return this.publishedPapersLabel;
    },
    totalPages() {
      return Math.ceil(this.facultyMembers.length / this.facultyPerPage);
    },
    paginatedFacultyMembers() {
      const startIndex = (this.currentPage - 1) * this.facultyPerPage;
      const endIndex = startIndex + this.facultyPerPage;

      return this.facultyMembers.slice(startIndex, endIndex);
    },
    visiblePages() {
      return Array.from({ length: this.totalPages }, (_, index) => index + 1);
    },
  },
  methods: {
    scrollToStaffs() {
      const staffsSection = document.getElementById("staffs");

      if (!staffsSection) {
        return;
      }

      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}#staffs`,
      );

      staffsSection.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    goToPage(page) {
      if (page < 1 || page > this.totalPages || page === this.currentPage) {
        return;
      }

      this.currentPage = page;
      this.$nextTick(() => {
        this.scrollToStaffs();
      });
    },
    goToPreviousPage() {
      this.goToPage(this.currentPage - 1);
    },
    goToNextPage() {
      this.goToPage(this.currentPage + 1);
    },
  },
};
</script>

<template>
  <div class="container-fluid p-0" style="margin-top: 117px">
    <div class="acon-bg-primary p-5 text-center">
      <h1 class="text-uppercase fw-bold">Faculty</h1>
      <p class="fs-4 mx-0 mx-md-5 fw-light">
        Meet our dedicated team of experienced nursing professionals,
        researchers, and educators who are committed to excellence in nursing
        education.
      </p>
    </div>

    <div class="acon-bg-light p-5 text-center">
      <div class="row g-4">
        <div v-for="stat in stats" :key="stat.label" class="col-md-3">
          <i :class="`${stat.icon} display-4 acon-text-secondary`"></i>
          <h3 class="fw-semibold acon-text-secondary">
            {{ this[stat.valueKey] }}
          </h3>
          <p class="fw-light">{{ stat.label }}</p>
        </div>
      </div>
    </div>

    <div class="p-5 text-center">
      <h2 class="fw-bold acon-text-primary">Academic Departments</h2>
      <p class="lead mb-5 text-secondary">
        Our academic departments provide specialized expertise across all areas
        of nursing education.
      </p>

      <div class="row g-4">
        <div
          v-for="department in departments"
          :key="department.name"
          class="col-md-6"
        >
          <div class="card border-0 shadow p-2">
            <div class="card-body">
              <h5 class="card-title text-start acon-text-primary fw-bold fs-4">
                {{ department.name }}
              </h5>
              <div class="d-flex">
                <div class="me-auto text-dark-emphasis">Department Head:</div>
                <div class="acon-text-secondary">{{ department.head }}</div>
              </div>
              <div class="d-flex mb-2">
                <div class="me-auto text-dark-emphasis">Faculty Members:</div>
                <div class="acon-text-secondary">
                  {{ department.facultyMembers }}
                </div>
              </div>
              <p class="card-text text-start text-dark-emphasis">
                {{ department.description }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div id="staffs" class="acon-bg-light p-5 text-center">
      <h2 class="fw-bold acon-text-primary">Faculty Members</h2>
      <p class="lead mb-5 text-secondary">
        Our faculty combines extensive clinical experience with advanced
        academic qualifications to provide the highest quality nursing education
      </p>

      <div class="row g-4">
        <div
          v-for="member in paginatedFacultyMembers"
          :key="member.email"
          class="col-md-4"
        >
          <div class="card border-0 shadow p-2 h-100">
            <div class="card-body text-dark-emphasis">
              <img
                :src="member.image"
                class="rounded-circle mb-3"
                height="100"
                width="100"
                :alt="`${member.name} portrait`"
              />
              <h5 class="card-title acon-text-primary fw-bold">
                {{ member.name }}
              </h5>
              <p class="acon-text-secondary mb-0">
                {{ member.role }}
              </p>
              <span
                v-if="member.qualifications"
                class="badge rounded-pill text-bg-light text-muted mb-3"
              >
                {{ member.qualifications }}
              </span>
              <div class="d-flex">
                <div class="me-auto">Department:</div>
                <div class="acon-text-primary">{{ member.department }}</div>
              </div>
              <div v-if="member.specialization" class="d-flex">
                <div class="me-auto">Specialization:</div>
                <div class="acon-text-primary">{{ member.specialization }}</div>
              </div>
              <div class="d-flex mb-3">
                <div class="me-auto">Experience:</div>
                <div class="acon-text-primary">{{ member.experience }}</div>
              </div>

              <p class="card-text text-start mb-3">
                {{ member.bio }}
              </p>

              <p v-if="member.email" class="d-flex align-items-center mb-0">
                <i class="bi bi-envelope acon-text-primary me-2"></i>
                {{ member.email }}
              </p>
              <p v-if="member.phone" class="d-flex align-items-center mb-0">
                <i class="bi bi-telephone acon-text-primary me-2"></i>
                {{ member.phone }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <nav class="mt-5" aria-label="Faculty pagination">
        <ul class="pagination justify-content-center">
          <li class="page-item" :class="{ disabled: currentPage === 1 }">
            <button
              class="page-link acon-link acon-text-primary"
              type="button"
              :disabled="currentPage === 1"
              @click="goToPreviousPage"
            >
              Previous
            </button>
          </li>
          <li
            v-for="page in visiblePages"
            :key="page"
            class="page-item"
            :class="{ active: page === currentPage }"
          >
            <button
              class="page-link acon-link"
              :class="
                page === currentPage
                  ? 'btn-acon-primary text-white border-0'
                  : 'acon-text-primary'
              "
              type="button"
              @click="goToPage(page)"
            >
              {{ page }}
            </button>
          </li>
          <li
            class="page-item"
            :class="{ disabled: currentPage === totalPages }"
          >
            <button
              class="page-link acon-link acon-text-primary"
              type="button"
              :disabled="currentPage === totalPages"
              @click="goToNextPage"
            >
              Next
            </button>
          </li>
        </ul>
      </nav>
    </div>

    <div class="acon-bg-secondary p-5 text-center">
      <h2 class="fw-bold">Educate. Inspire. Grow. Join Our Faculty</h2>
      <p class="fs-5 fw-light mx-0 mx-md-5 mb-4" style="color: #fff3f0">
        At ALECONS, we don’t just teach — we inspire. We're seeking passionate
        educators and healthcare professionals to help cultivate compassionate,
        skilled nurses. Be part of a forward-thinking institution committed to
        academic excellence and community impact.
      </p>
      <a
        class="btn btn-acon-dark btn-lg px-5"
        href="mailto:careers@alecons.edu.ng"
      >
        Join the Team
      </a>
    </div>
  </div>
</template>

<style scoped>
#staffs {
  scroll-margin-top: 130px;
}
</style>

<script lang="js">
export default {
  name: "ApplicationForm",
  data() {
    return {
      stages: [
        "Personal",
        "Academic",
        "Upload",
        "Submit"
      ],
      currentStage: 0,
      sittings: [
        { examType: "", examYear: "", examNumber: "" }
      ],
      maxSittings: 2,
      examTypes: ["WAEC/SSCE", "NECO", "NABTEB", "GCE"],
      years: [],
      subjects: [
        { subject: "English Language", grade: "", sitting: "", locked: true },
        { subject: "Mathematics", grade: "", sitting: "", locked: true },
      ],
      subjectOptions: [
        "English Language",
        "Mathematics",
        "Biology",
        "Chemistry",
        "Physics",
        "Agricultural Science",
        "Further Mathematics",
        "Economics",
        "Geography",
        "Government",
        "Literature in English",
        "Commerce",
        "Accounting",
        "Civic Education",
        "Computer Studies",
        "Technical Drawing",
        "Food & Nutrition",
        "Home Management",
        "Christian Religious Studies",
        "Islamic Religious Studies"
      ],
      maxSubjects: 9,
      grades: ["A1", "B2", "B3", "C4", "C5", "C6", "D7", "E8", "F9"],
      referenceLetters: [null, null],
      declaration: false,

      // Personal Information
      firstName: "John",
      middleName: "Middleborugh",
      lastName: "Doe",
      dateOfBirth: "09/11/1999",
      gender: "Male",
      phone: "080123456789",
      email: "johndoe@mail.com",
      religion: "Christain",
      maritalStatus: "Single",
      state: "Lagos",
      lga: "Ikeja",
      nationality: "Nigerian",
      address: "123 Main St, Ikeja, Lagos",

      // Next of Kin Information
      nextOfKinName: "Jane Doe",
      nextOfKinPhone: "080123456789",
      nextOfKinEmail: "janedoe@mail.com",
      nextOfKinRelationship: "Spouse",
      nextOfKinAddress: "123 Main St, Ikeja, Lagos",

      // Referee Information
      referee1Name: "Referee 1",
      referee1Phone: "080123456789",
      referee1Email: "referee1@mail.com",
      referee2Name: "Referee 2",
      referee2Phone: "080123456789",
      referee2Email: "referee2@mail.com", 

      // Academic Information
      primarySchool: "Primary School",
      primarySchoolStart: "2010",
      primarySchoolEnd: "2016",
      secondarySchool: "Secondary School",
      secondarySchoolStart: "2016",
      secondarySchoolEnd: "2020",

    };
  },
  computed: {
    progressPercent() {
      return (this.currentStage / (this.stages.length - 1)) * 100;
    }
  },
  created() {
    const currentYear = new Date().getFullYear();
    for (let year = currentYear; year >= 1980; year--) {
      this.years.push(year);
    }
  },
  methods: {
    nextStage() {
      if (this.currentStage < this.stages.length - 1) {
        this.currentStage++;
      }
    },
    prevStage() {
      if (this.currentStage > 0) {
        this.currentStage--;
      }
    },
    addSitting() {
      if (this.sittings.length < this.maxSittings) {
        this.sittings.push({ examType: "", examYear: "", examNumber: "" });
      }
    },
    removeSitting(index) {
      if (this.sittings.length > 1) {
        this.sittings.splice(index, 1);
      }
    },
    addSubject() {
      if (this.subjects.length < this.maxSubjects) {
        this.subjects.push({ subject: "", grade: "", sitting: "" });
      }
    },
    removeSubject(index) {
      if (this.subjects.length > 2) {
        this.subjects.splice(index, 1);
      }
    }
  },
};
</script>

<template>
  <div class="mt-3 p-5">
    <h4 class="fw-bold mb-5 text-center">Application form for 2025/2026</h4>

    <div class="position-relative mb-5 mx-md-5">
      <div
        class="progress"
        role="progressbar"
        :aria-valuenow="progressPercent"
        aria-valuemin="0"
        aria-valuemax="100"
        style="height: 2px"
      >
        <div
          class="progress-bar acon-bg-primary"
          :style="{ width: progressPercent + '%' }"
        ></div>

        <!-- Dots -->
        <div
          class="dots-overlay d-flex justify-content-between position-absolute start-0 w-100"
        >
          <div
            v-for="(stage, index) in stages"
            :key="index"
            class="d-flex flex-column align-items-center"
            style="width: 0"
          >
            <!-- Dot with number inside -->
            <span
              class="dot d-flex align-items-center justify-content-center"
              :class="{ completed: index <= currentStage }"
            >
              {{ index + 1 }}
            </span>
            <!-- Label -->
            <small class="text-muted text-center mt-1">{{ stage }}</small>
          </div>
        </div>
      </div>
    </div>

    <div class="pt-5">
      <!-- Stage 1: Personal details -->
      <div v-if="currentStage === 0">
        <div class="d-flex justify-content-between">
          <h6 class="fw-semibold">Personal details</h6>
          <p class="small">
            Mandatory fields are marked with an asterisk(<span
              class="text-danger"
              >*</span
            >)
          </p>
        </div>

        <div class="card border-0 acon-bg-light p-3">
          <div class="row g-3">
            <div class="col-md-4">
              <label for="firstName" class="form-label small">
                First Name <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="firstName" />
            </div>

            <div class="col-md-4">
              <label for="middleName" class="form-label small">
                Middle Name <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="middleName" />
            </div>

            <div class="col-md-4">
              <label for="lastName" class="form-label small">
                Last Name <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="lastName" />
            </div>

            <div class="col-md-6">
              <label for="dateOfBirth" class="form-label small">
                Date of Birth <span class="text-danger">*</span>
              </label>
              <input type="date" class="form-control" id="dateOfBirth" />
            </div>

            <div class="col-md-6">
              <label for="gender" class="form-label small">
                Gender <span class="text-danger">*</span>
              </label>
              <div class="d-flex justify-content-between">
                <div class="form-check">
                  <input
                    class="form-check-input"
                    type="radio"
                    name="radioDefault"
                    id="radioDefault1"
                  />
                  <label class="form-check-label" for="radioDefault1">
                    Male
                  </label>
                </div>
                <div class="form-check">
                  <input
                    class="form-check-input"
                    type="radio"
                    name="radioDefault"
                    id="radioDefault2"
                  />
                  <label class="form-check-label" for="radioDefault2">
                    Female
                  </label>
                </div>
                <div class="form-check">
                  <input
                    class="form-check-input"
                    type="radio"
                    name="radioDefault"
                    id="radioDefault3"
                  />
                  <label class="form-check-label" for="radioDefault3">
                    Others
                  </label>
                </div>
              </div>
            </div>

            <div class="col-md-6">
              <label for="phone" class="form-label small">
                Phone <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="phone" />
            </div>

            <div class="col-md-6">
              <label for="email" class="form-label small">
                Email <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="email" />
            </div>

            <div class="col-md-6">
              <label for="religion" class="form-label small">
                Religion <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="religion" />
            </div>

            <div class="col-md-6">
              <label for="maritalStatus" class="form-label small">
                Marital Status <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="maritalStatus" />
            </div>

            <div class="col-md-4">
              <label for="state" class="form-label small">
                State of Origin <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="state" />
            </div>

            <div class="col-md-4">
              <label for="lga" class="form-label small">
                Local Government Area <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="lga" />
            </div>

            <div class="col-md-4">
              <label for="nationality" class="form-label small">
                Nationality <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="nationality" />
            </div>

            <div class="col-md-12">
              <label for="address" class="form-label small">
                Contact Address <span class="text-danger">*</span>
              </label>
              <textarea class="form-control" id="address" rows="3"></textarea>
            </div>
          </div>
        </div>

        <h6 class="fw-semibold mt-5">Other details</h6>
        <div class="card border-0 acon-bg-light p-3">
          <div class="row g-3">
            <div class="col-md-4">
              <label for="nextOfKinName" class="form-label small"
                >Next of Kin Name <span class="text-danger">*</span></label
              >
              <input type="text" class="form-control" id="nextOfKinName" />
            </div>

            <div class="col-md-4">
              <label for="nextOfKinPhone" class="form-label small">
                Next of Kin Phone <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="nextOfKinPhone" />
            </div>

            <div class="col-md-4">
              <label for="nextOfKinEmail" class="form-label small">
                Next of Kin Email <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="nextOfKinEmail" />
            </div>

            <div class="col-md-4">
              <label for="nextOfKinRelationship" class="form-label small">
                Next of Kin Relationship <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                id="nextOfKinRelationship"
              />
            </div>

            <div class="col-md-8">
              <label for="nextOfKinAddress" class="form-label small">
                Next of Kin Address <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="nextOfKinAddress" />
            </div>

            <div class="col-md-4">
              <label for="referee1Name" class="form-label small">
                Referee 1 Name <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="referee1Name" />
            </div>

            <div class="col-md-4">
              <label for="referee1Phone" class="form-label small">
                Referee 1 Phone <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="referee1Phone" />
            </div>

            <div class="col-md-4">
              <label for="referee1Email" class="form-label small">
                Referee 1 Email <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="referee1Email" />
            </div>

            <div class="col-md-4">
              <label for="referee2Name" class="form-label small">
                Referee 2 Name <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="referee2Name" />
            </div>

            <div class="col-md-4">
              <label for="referee2Phone" class="form-label small">
                Referee 2 Phone <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="referee2Phone" />
            </div>

            <div class="col-md-4">
              <label for="referee1Email" class="form-label small">
                Referee 2 Email <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="referee2Email" />
            </div>
          </div>
        </div>
      </div>

      <!-- Stage 2: Academic details -->
      <div v-if="currentStage === 1">
        <h6 class="fw-semibold">Academic Background</h6>
        <div class="card border-0 acon-bg-light p-3">
          <div class="row g-3">
            <div class="col-md-6">
              <label for="primarySchool" class="form-label small">
                Primary School <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="primarySchool" />
            </div>

            <div class="col-md-3">
              <label for="primarySchoolStart" class="form-label small">
                Start Date <span class="text-danger">*</span>
              </label>
              <input type="date" class="form-control" id="primarySchoolStart" />
            </div>

            <div class="col-md-3">
              <label for="primarySchoolEnd" class="form-label small">
                End Date <span class="text-danger">*</span>
              </label>
              <input type="date" class="form-control" id="primarySchoolEnd" />
            </div>

            <div class="col-md-6">
              <label for="secondarySchool" class="form-label small">
                Secondary School <span class="text-danger">*</span>
              </label>
              <input type="text" class="form-control" id="secondarySchool" />
            </div>

            <div class="col-md-3">
              <label for="secondarySchoolStart" class="form-label small">
                Start Date <span class="text-danger">*</span>
              </label>
              <input
                type="date"
                class="form-control"
                id="secondarySchoolStart"
              />
            </div>

            <div class="col-md-3">
              <label for="secondarySchoolEnd" class="form-label small">
                End Date <span class="text-danger">*</span>
              </label>
              <input type="date" class="form-control" id="secondarySchoolEnd" />
            </div>
          </div>
        </div>

        <div class="d-flex justify-content-between mt-5 mb-1">
          <h6 class="fw-semibold">
            Post Secondary School
            <span class="fw-light small"
              >(e.g. WAEC/SSCE, NECO, NABTEB, etc)</span
            >
          </h6>

          <button
            class="btn btn-acon-dark btn-sm"
            @click="addSitting"
            :disabled="sittings.length >= maxSittings"
          >
            <i class="bi bi-plus"></i> Add Sitting
          </button>
        </div>

        <!-- Render Each Sitting -->
        <div class="card border-0 acon-bg-light p-3">
          <div
            v-for="(sitting, index) in sittings"
            :key="index"
            class="row g-3 mb-3"
          >
            <div class="d-flex justify-content-between align-items-center mb-2">
              <p class="small text-secondary mb-0">Sitting {{ index + 1 }}</p>

              <!-- Remove button (only show if more than 1 sitting) -->
              <button
                v-if="sittings.length > 1"
                class="btn btn-sm btn-danger"
                @click="removeSitting(index)"
              >
                <i class="bi bi-trash"></i>
              </button>
            </div>

            <div class="col-md-4 mt-0">
              <label for="examType" class="form-label small">
                Exam Type <span class="text-danger">*</span>
              </label>
              <select
                v-model="sitting.examType"
                class="form-select"
                id="examType"
              >
                <option disabled value="">--Select Exam Type--</option>
                <option v-for="(type, i) in examTypes" :key="i" :value="type">
                  {{ type }}
                </option>
              </select>
            </div>

            <div class="col-md-4 mt-0">
              <label for="examYear" class="form-label small">
                Exam Year <span class="text-danger">*</span>
              </label>
              <select
                v-model="sitting.examYear"
                class="form-select"
                id="examYear"
              >
                <option disabled value="">--Select Year--</option>
                <option v-for="year in years" :key="year" :value="year">
                  {{ year }}
                </option>
              </select>
            </div>

            <div class="col-md-4 mt-0">
              <label for="examNumber" class="form-label small">
                Exam Number <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                v-model="sitting.examNumber"
                id="examNumber"
              />
            </div>
          </div>
        </div>

        <div class="d-flex justify-content-between mt-5 mb-1">
          <h6 class="fw-semibold">
            O'Level Result
            <span class="fw-light small"
              >(5 Credits not more than two sittings)</span
            >
          </h6>

          <button
            class="btn btn-acon-dark btn-sm"
            @click="addSubject"
            :disabled="subjects.length >= maxSubjects"
          >
            <i class="bi bi-plus"></i> Add Subject
          </button>
        </div>

        <div class="card border-0 acon-bg-light p-3">
          <div
            class="row g-3 mb-3"
            v-for="(row, index) in subjects"
            :key="index"
          >
            <div class="col-md-5">
              <label class="form-label small">
                Subject <span class="text-danger">*</span>
              </label>

              <select
                v-model="row.subject"
                class="form-select"
                :disabled="row.locked"
              >
                <option disabled value="">--Select Subject--</option>
                <option
                  v-for="subject in subjectOptions"
                  :key="subject"
                  :value="subject"
                >
                  {{ subject }}
                </option>
              </select>
            </div>

            <div class="col-md-3">
              <label for="grade" class="form-label small">
                Grade <span class="text-danger">*</span>
              </label>
              <select v-model="row.grade" class="form-select">
                <option disabled value="">--Select Grade--</option>
                <option v-for="grade in grades" :key="grade" :value="grade">
                  {{ grade }}
                </option>
              </select>
            </div>

            <div class="col-md-3">
              <label for="sitting" class="form-label small">
                Sitting <span class="text-danger">*</span>
              </label>

              <select v-model="row.sitting" class="form-select">
                <option disabled value="">--Select Sitting--</option>
                <option
                  v-for="(s, i) in sittings"
                  :key="i"
                  :value="'Sitting ' + (i + 1)"
                >
                  Sitting {{ i + 1 }}
                </option>
              </select>
            </div>

            <button
              v-if="!row.locked"
              class="btn btn-danger btn-sm col-md-1"
              @click="removeSubject(index)"
            >
              <i class="bi bi-x h3"></i>
            </button>
          </div>
        </div>
      </div>

      <!-- Stage 3: Upload -->
      <div v-if="currentStage === 2">
        <h6 class="fw-semibold">Upload profile picture</h6>
        <div class="card border-0 acon-bg-light p-3">
          <div class="row g-3 mb-3">
            <div class="d-flex align-items-center">
              <div class="me-3">
                <img
                  v-if="profilePreview"
                  :src="profilePreview"
                  alt="Profile Preview"
                  class="rounded-circle border"
                  style="width: 100px; height: 100px; object-fit: cover"
                />
                <div
                  v-else
                  class="rounded-circle d-flex align-items-center justify-content-center bg-secondary text-white"
                  style="width: 100px; height: 100px"
                >
                  <i class="bi bi-person h2 mb-0"></i>
                </div>
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  class="form-control"
                  @change="handleProfileUpload"
                />
                <small class="text-muted">
                  Upload a clear passport photograph
                </small>
              </div>
            </div>
          </div>
        </div>

        <!-- O'Level Uploads -->
        <h6 class="fw-semibold mt-5">O'Level Result Uploads</h6>
        <div class="card border-0 acon-bg-light p-3">
          <div
            class="row g-3 mb-3"
            v-for="(sitting, index) in sittings"
            :key="index"
          >
            <p class="small text-secondary mb-0">
              Sitting {{ index + 1 }} - WAEC/SSCE
            </p>
            <input
              type="file"
              accept="application/pdf/*"
              class="form-control"
              @change="handleOLevelUpload($event, index)"
            />
            <small class="text-muted">
              Upload O'Level result for this sitting
            </small>
          </div>
        </div>

        <!-- Reference Letters -->
        <h6 class="fw-semibold mt-5">Reference Letters</h6>
        <div class="card border-0 acon-bg-light p-3">
          <div
            class="row g-3 mb-3"
            v-for="(ref, index) in referenceLetters"
            :key="index"
          >
            <p class="small text-secondary mb-2">
              Reference Letter {{ index + 1 }}
            </p>
            <input
              type="file"
              accept="application/pdf,image/*"
              class="form-control mt-0"
              @change="handleReferenceUpload($event, index)"
            />
            <small class="text-muted mt-2">
              Mandatory: upload referee letter {{ index + 1 }}
            </small>
          </div>
        </div>
      </div>

      <!-- Stage 4: Submit -->
      <!-- Inside your application_form.vue, replace the Stage 4 section -->
      <!-- Stage 4: Submit -->
      <div v-if="currentStage === 3">
        <h6 class="fw-semibold">Review Application Details</h6>
        <div class="card border-0 acon-bg-light p-4">
          <!-- Personal Information -->
          <div class="mb-4">
            <h6 class="fw-semibold mb-3">Personal Information</h6>
            <div class="row g-3">
              <div class="col-md-4">
                <p class="small text-muted mb-1">First Name</p>
                <p class="mb-0">{{ firstName }}</p>
              </div>
              <div class="col-md-4">
                <p class="small text-muted mb-1">Middle Name</p>
                <p class="mb-0">{{ middleName }}</p>
              </div>
              <div class="col-md-4">
                <p class="small text-muted mb-1">Last Name</p>
                <p class="mb-0">{{ lastName }}</p>
              </div>
              <div class="col-md-4">
                <p class="small text-muted mb-1">Date of Birth</p>
                <p class="mb-0">{{ dateOfBirth }}</p>
              </div>
              <div class="col-md-4">
                <p class="small text-muted mb-1">Gender</p>
                <p class="mb-0">{{ gender }}</p>
              </div>
              <div class="col-md-4">
                <p class="small text-muted mb-1">Phone</p>
                <p class="mb-0">{{ phone }}</p>
              </div>
              <div class="col-md-4">
                <p class="small text-muted mb-1">Email</p>
                <p class="mb-0">{{ email }}</p>
              </div>
              <div class="col-md-4">
                <p class="small text-muted mb-1">Marital Status</p>
                <p class="mb-0">{{ maritalStatus }}</p>
              </div>
              <div class="col-md-4">
                <p class="small text-muted mb-1">State of Origin</p>
                <p class="mb-0">{{ state }}</p>
              </div>
              <div class="col-md-12">
                <p class="small text-muted mb-1">Contact Address</p>
                <p class="mb-0">{{ address }}</p>
              </div>
            </div>
          </div>

          <!-- Next of Kin Information -->
          <div class="mb-4">
            <h6 class="fw-semibold mb-3">Next of Kin Details</h6>
            <div class="row g-3">
              <div class="col-md-4">
                <p class="small text-muted mb-1">Name</p>
                <p class="mb-0">{{ nextOfKinName }}</p>
              </div>
              <div class="col-md-4">
                <p class="small text-muted mb-1">Phone</p>
                <p class="mb-0">{{ nextOfKinPhone }}</p>
              </div>
              <div class="col-md-4">
                <p class="small text-muted mb-1">Email</p>
                <p class="mb-0">{{ nextOfKinEmail }}</p>
              </div>
              <div class="col-md-12">
                <p class="small text-muted mb-1">Address</p>
                <p class="mb-0">{{ nextOfKinAddress }}</p>
              </div>
            </div>
          </div>

          <!-- Referee Information -->
          <div class="mb-4">
            <h6 class="fw-semibold mb-3">Referee Details</h6>
            <div class="row g-3">
              <div class="col-md-6">
                <h6 class="small fw-semibold">Referee 1</h6>
                <p class="small text-muted mb-1">Name: {{ referee1Name }}</p>
                <p class="small text-muted mb-1">Phone: {{ referee1Phone }}</p>
                <p class="small text-muted mb-1">Email: {{ referee1Email }}</p>
              </div>
              <div class="col-md-6">
                <h6 class="small fw-semibold">Referee 2</h6>
                <p class="small text-muted mb-1">Name: {{ referee2Name }}</p>
                <p class="small text-muted mb-1">Phone: {{ referee2Phone }}</p>
                <p class="small text-muted mb-1">Email: {{ referee2Email }}</p>
              </div>
            </div>
          </div>

          <!-- Academic Background -->
          <div class="mb-4">
            <h6 class="fw-semibold mb-3">Academic Background</h6>
            <div class="row g-3">
              <div class="col-12">
                <h6 class="small fw-semibold">Primary Education</h6>
                <p class="small text-muted mb-1">School: {{ primarySchool }}</p>
                <p class="small text-muted mb-1">
                  Period: {{ primarySchoolStart }} - {{ primarySchoolEnd }}
                </p>
              </div>
              <div class="col-12">
                <h6 class="small fw-semibold">Secondary Education</h6>
                <p class="small text-muted mb-1">
                  School: {{ secondarySchool }}
                </p>
                <p class="small text-muted mb-1">
                  Period: {{ secondarySchoolStart }} - {{ secondarySchoolEnd }}
                </p>
              </div>
            </div>
          </div>

          <!-- O'Level Results -->
          <div class="mb-4">
            <h6 class="fw-semibold mb-3">O'Level Results</h6>

            <!-- Exam Sittings -->
            <div v-for="(sitting, index) in sittings" :key="index" class="mb-3">
              <h6 class="small fw-semibold">Sitting {{ index + 1 }}</h6>
              <div class="row g-3">
                <div class="col-md-4">
                  <p class="small text-muted mb-1">
                    Exam Type: {{ sitting.examType }}
                  </p>
                </div>
                <div class="col-md-4">
                  <p class="small text-muted mb-1">
                    Year: {{ sitting.examYear }}
                  </p>
                </div>
                <div class="col-md-4">
                  <p class="small text-muted mb-1">
                    Number: {{ sitting.examNumber }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Subjects -->
            <div class="mt-3">
              <h6 class="small fw-semibold">Subjects</h6>
              <div class="table-responsive">
                <table class="table table-bordered table-sm" style="    --bs-table-bg: #f0f8f8">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Grade</th>
                      <th>Sitting</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(subject, index) in subjects" :key="index">
                      <td>{{ subject.subject }}</td>
                      <td>{{ subject.grade }}</td>
                      <td>{{ subject.sitting }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Uploaded Documents -->
          <div class="mb-4">
            <h6 class="fw-semibold mb-3">Uploaded Documents</h6>
            <div class="row g-3">
              <div class="col-md-4">
                <p class="small text-muted mb-1">Profile Picture</p>
                <img
                  v-if="profilePreview"
                  :src="profilePreview"
                  alt="Profile"
                  class="img-thumbnail"
                  style="width: 100px; height: 100px; object-fit: cover"
                />
              </div>
              <div class="col-12">
                <h6 class="small fw-semibold">O'Level Results</h6>
                <p
                  v-for="(sitting, index) in sittings"
                  :key="index"
                  class="small text-muted mb-1"
                >
                  Sitting {{ index + 1 }} Document:
                  {{ sitting.documentName || "Uploaded" }}
                </p>
              </div>
              <div class="col-12">
                <h6 class="small fw-semibold">Reference Letters</h6>
                <p
                  v-for="(ref, index) in referenceLetters"
                  :key="index"
                  class="small text-muted mb-1"
                >
                  Reference Letter {{ index + 1 }}:
                  {{ ref?.name || "Uploaded" }}
                </p>
              </div>
            </div>
          </div>

          <!-- Declaration -->
          <div class="mb-4">
            <div class="form-check">
              <input
                class="form-check-input"
                type="checkbox"
                v-model="declaration"
                id="declaration"
              />
              <label class="form-check-label small" for="declaration">
                I declare that the information provided above is true and
                correct to the best of my knowledge.
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="d-flex justify-content-between mt-5">
      <button
        class="col-md-4 btn btn-outline-acon-primary px-md-5 d-flex align-items-center justify-content-center"
        v-if="currentStage > 0"
        @click="prevStage"
      >
        <i class="bi bi-arrow-left-short h4 mb-0"></i> Previous
      </button>

      <button
        class="col-md-4 btn btn-acon-primary px-md-5 d-flex align-items-center justify-content-center"
        v-if="currentStage < stages.length - 1"
        @click="nextStage"
      >
        Next step <i class="bi bi-arrow-right-short h4 mb-0"></i>
      </button>

      <button
        class="col-md-4 btn btn-acon-secondary px-md-5"
        v-if="currentStage === stages.length - 1"
        type="submit"
      >
        Submit
      </button>
    </div>
  </div>
</template>

<style scoped>
.dots-overlay {
  top: 50%;
  transform: translateY(-50%);
  height: 0;
  overflow: visible;
}

.dot {
  width: 24px;
  /* bigger to fit numbers */
  height: 24px;
  border-radius: 50%;
  background-color: var(--bs-secondary-bg);
  flex-shrink: 0;
  transform: translateY(-50%);
  font-size: 12px;
  /* number size */
  font-weight: bold;
  color: #fff;
  /* default text color */
}

.dot.completed {
  background-color: #2d7d7d;
  /* primary */
  color: #fff;
  /* white text */
}
</style>

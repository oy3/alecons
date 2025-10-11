<script lang="js">
import { useAuthStore } from '../../stores/auth.js';
import { apiService } from '../../services/api.js';
import { logger } from '@shared/utils/logger';
import { Country, State, City } from 'country-state-city';
import Swal from 'sweetalert2';
import vSelect from 'vue-select';
import 'vue-select/dist/vue-select.css';

export default {
  name: "ApplicationForm",
  components: {
    vSelect
  },
  setup() {
    const authStore = useAuthStore();
    return {
      authStore,
    };
  },
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
      examTypes: ["WAEC/SSCE", "NECO", "GCE"],
      years: [],
      subjects: [
        { subject: "English Language", grade: "", sitting: "", locked: true },
        { subject: "Mathematics", grade: "", sitting: "", locked: true },
        { subject: "Biology", grade: "", sitting: "", locked: true },
        { subject: "Chemistry", grade: "", sitting: "", locked: true },
        { subject: "Physics", grade: "", sitting: "", locked: true },
      ],
      subjectOptions: [
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

      // Location data
      countries: [],
      states: [],
      cities: [],

      // Religion options
      religionOptions: [
        "Christianity",
        "Islam",
        "Traditional/African Religion",
        "Buddhism",
        "Hinduism",
        "Judaism",
        "Other",
        "Prefer not to say"
      ],

      // Next of Kin Relationship options
      relationshipOptions: [
        "Parent",
        "Guardian",
        "Sibling",
        "Spouse",
        "Uncle/Aunt",
        "Grandparent",
        "Cousin",
        "Friend",
        "Other"
      ],

      // Upload states
      isUploading: false,
      isSubmitting: false,
      profilePreview: null,
      profileFileInfo: null, // Store file name and size
      uploadedDocuments: {
        profile: null,
        olevels: {},
        references: {}
      },

      // Personal Information - will be prefilled from auth store
      firstName: "",
      middleName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      phone: "",
      email: "",
      religion: "",
      maritalStatus: "",
      state: "",
      lga: "",
      nationality: "",
      address: "",

      // Next of Kin Information
      nextOfKinName: "",
      nextOfKinPhone: "",
      nextOfKinEmail: "",
      nextOfKinRelationship: "",
      nextOfKinAddress: "",

      // Referee Information
      referee1Name: "",
      referee1Phone: "",
      referee1Email: "",
      referee2Name: "",
      referee2Phone: "",
      referee2Email: "",

      // Academic Information
      primarySchool: "",
      primarySchoolStart: "",
      primarySchoolEnd: "",
      secondarySchool: "",
      secondarySchoolStart: "",
      secondarySchoolEnd: "",

      // Validation
      validationErrors: {}
    };
  },
  computed: {
    progressPercent() {
      return (this.currentStage / (this.stages.length - 1)) * 100;
    },
    user() {
      return this.authStore.user;
    },
    application() {
      return this.authStore.application;
    },
    selectedCountry() {
      return this.countries.find(country => country.name === this.nationality);
    },
    selectedState() {
      return this.states.find(state => state.name === this.state);
    },
    // For vue-select display, we need the actual selected objects
    selectedNationalityObject() {
      return this.countries.find(country => country.name === this.nationality);
    },
    selectedStateObject() {
      return this.states.find(state => state.name === this.state);
    },
    selectedLgaObject() {
      return this.cities.find(city => city.name === this.lga);
    },
    // Filter available subjects to exclude already selected ones
    getAvailableSubjectsFor() {
      return (currentIndex) => {
        // Get all selected subjects except the current row being edited
        const selectedSubjects = this.subjects
          .map((subject, index) => index !== currentIndex ? subject.subject : null)
          .filter(subject => subject && subject.trim() !== '');

        // Return subjects that haven't been selected yet
        return this.subjectOptions.filter(subject => !selectedSubjects.includes(subject));
      };
    }
  },
  watch: {
    // Watch for changes in application data (in case it loads asynchronously)
    application: {
      handler(newApplication, oldApplication) {
        if (newApplication && newApplication !== oldApplication) {
          logger.info('Application data changed, re-prefilling form data');
          this.prefillUserData();
        }
      },
      deep: true,
      immediate: true
    },
    nationality() {
      this.loadStatesForCountry();
      this.state = "";
      this.lga = "";
      this.cities = [];
    },
    state() {
      this.loadCitiesForState();
      this.lga = "";
    }
  },
  created() {
    this.generateYears();
    this.loadCountries();
    this.prefillUserData();
  },
  async mounted() {
    // Check if user has already completed the application form
    if (this.application && this.application.currentStage > 3) {
      logger.info('User has already completed application form, redirecting to dashboard', {
        currentStage: this.application.currentStage
      });

      await Swal.fire({
        title: 'Application Already Submitted',
        text: 'You have already completed your application form.',
        icon: 'info',
        confirmButtonText: 'Go to Dashboard'
      });

      this.$router.push('/dashboard');
      return;
    }
  },
  methods: {
    generateYears() {
      const currentYear = new Date().getFullYear();

      // Use user's birth year as minimum year if available, otherwise fallback to 1980
      let minYear = 1980;
      if (this.application?.dob) {
        const birthYear = new Date(this.application.dob).getFullYear();
        minYear = birthYear;
      }

      this.years = [];
      for (let year = currentYear; year >= minYear; year--) {
        this.years.push(year);
      }

      logger.info('Generated exam years:', {
        minYear,
        maxYear: currentYear,
        totalYears: this.years.length,
        hasDob: !!this.application?.dob
      });
    },

    loadCountries() {
      this.countries = Country.getAllCountries();
      logger.info('Loaded countries:', this.countries.length);
    },

    loadStatesForCountry() {
      if (this.selectedCountry) {
        this.states = State.getStatesOfCountry(this.selectedCountry.isoCode);
        logger.info('Loaded states for country:', this.selectedCountry.name, this.states.length);
      } else {
        this.states = [];
      }
    },

    loadCitiesForState() {
      if (this.selectedState && this.selectedCountry) {
        this.cities = City.getCitiesOfState(this.selectedCountry.isoCode, this.selectedState.isoCode);
        logger.info('Loaded cities for state:', this.selectedState.name, this.cities.length);
      } else {
        this.cities = [];
      }
    },

    validateStage(stageIndex) {
      this.validationErrors = {};
      let isValid = true;

      if (stageIndex === 0) { // Personal Information
        const requiredFields = {
          firstName: 'First name is required',
          lastName: 'Last name is required',
          dateOfBirth: 'Date of birth is required',
          gender: 'Gender is required',
          phone: 'Phone number is required',
          email: 'Email is required',
          religion: 'Religion is required',
          maritalStatus: 'Marital status is required',
          nationality: 'Nationality is required',
          state: 'State is required',
          lga: 'Local government area is required',
          address: 'Contact address is required',
          nextOfKinName: 'Next of kin name is required',
          nextOfKinPhone: 'Next of kin phone is required',
          nextOfKinEmail: 'Next of kin email is required',
          nextOfKinRelationship: 'Next of kin relationship is required',
          nextOfKinAddress: 'Next of kin address is required',
          referee1Name: 'Referee 1 name is required',
          referee1Phone: 'Referee 1 phone is required',
          referee1Email: 'Referee 1 email is required',
          referee2Name: 'Referee 2 name is required',
          referee2Phone: 'Referee 2 phone is required',
          referee2Email: 'Referee 2 email is required'
        };

        for (const [field, message] of Object.entries(requiredFields)) {
          if (!this[field] || this[field].trim() === '') {
            this.validationErrors[field] = message;
            isValid = false;
          }
        }

        // Email validation
        if (this.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
          this.validationErrors.email = 'Please enter a valid email address';
          isValid = false;
        }

        // Next of Kin email validation
        if (this.nextOfKinEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.nextOfKinEmail)) {
          this.validationErrors.nextOfKinEmail = 'Please enter a valid email address for next of kin';
          isValid = false;
        }

        // Referee emails validation
        if (this.referee1Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.referee1Email)) {
          this.validationErrors.referee1Email = 'Please enter a valid email address for referee 1';
          isValid = false;
        }

        if (this.referee2Email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.referee2Email)) {
          this.validationErrors.referee2Email = 'Please enter a valid email address for referee 2';
          isValid = false;
        }

        // Phone validation (basic)
        if (this.phone && !/^\+?[\d\s-()]{10,}$/.test(this.phone)) {
          this.validationErrors.phone = 'Please enter a valid phone number';
          isValid = false;
        }

        // Next of Kin phone validation
        if (this.nextOfKinPhone && !/^\+?[\d\s-()]{10,}$/.test(this.nextOfKinPhone)) {
          this.validationErrors.nextOfKinPhone = 'Please enter a valid phone number for next of kin';
          isValid = false;
        }

        // Referee phone validation
        if (this.referee1Phone && !/^\+?[\d\s-()]{10,}$/.test(this.referee1Phone)) {
          this.validationErrors.referee1Phone = 'Please enter a valid phone number for referee 1';
          isValid = false;
        }

        if (this.referee2Phone && !/^\+?[\d\s-()]{10,}$/.test(this.referee2Phone)) {
          this.validationErrors.referee2Phone = 'Please enter a valid phone number for referee 2';
          isValid = false;
        }
      }

      if (stageIndex === 1) { // Academic Information
        // Validate primary school fields
        if (!this.primarySchool || this.primarySchool.trim() === '') {
          this.validationErrors.primarySchool = 'Primary school name is required';
          isValid = false;
        }

        if (!this.primarySchoolStart || this.primarySchoolStart.trim() === '') {
          this.validationErrors.primarySchoolStart = 'Primary school start date is required';
          isValid = false;
        }

        if (!this.primarySchoolEnd || this.primarySchoolEnd.trim() === '') {
          this.validationErrors.primarySchoolEnd = 'Primary school end date is required';
          isValid = false;
        }

        // Comprehensive date validation for primary school
        if (!this.validateDateRange(this.primarySchoolStart, this.primarySchoolEnd, 'primarySchoolStart', 'primarySchoolEnd', 'Primary school')) {
          isValid = false;
        }

        // Validate secondary school fields
        if (!this.secondarySchool || this.secondarySchool.trim() === '') {
          this.validationErrors.secondarySchool = 'Secondary school name is required';
          isValid = false;
        }

        if (!this.secondarySchoolStart || this.secondarySchoolStart.trim() === '') {
          this.validationErrors.secondarySchoolStart = 'Secondary school start date is required';
          isValid = false;
        }

        if (!this.secondarySchoolEnd || this.secondarySchoolEnd.trim() === '') {
          this.validationErrors.secondarySchoolEnd = 'Secondary school end date is required';
          isValid = false;
        }

        // Comprehensive date validation for secondary school
        if (!this.validateDateRange(this.secondarySchoolStart, this.secondarySchoolEnd, 'secondarySchoolStart', 'secondarySchoolEnd', 'Secondary school')) {
          isValid = false;
        }

        // Validate education progression logic
        if (!this.validateEducationProgression()) {
          isValid = false;
        }

        // Validate sittings
        this.sittings.forEach((sitting, index) => {
          if (!sitting.examType || sitting.examType.trim() === '') {
            this.validationErrors[`sitting_${index}_examType`] = `Sitting ${index + 1}: Exam type is required`;
            isValid = false;
          }
          if (!sitting.examYear || sitting.examYear.toString().trim() === '') {
            this.validationErrors[`sitting_${index}_examYear`] = `Sitting ${index + 1}: Exam year is required`;
            isValid = false;
          }
          if (!sitting.examNumber || sitting.examNumber.trim() === '') {
            this.validationErrors[`sitting_${index}_examNumber`] = `Sitting ${index + 1}: Exam number is required`;
            isValid = false;
          }
        });

        // Validate subjects
        const filledSubjects = this.subjects.filter(s => s.subject && s.grade && s.sitting);
        if (filledSubjects.length < 5) {
          this.validationErrors.subjects = 'At least 5 subjects are required (including English and Mathematics)';
          isValid = false;
        }

        // Validate each subject individually
        this.subjects.forEach((subject, index) => {
          if (subject.subject && subject.subject.trim() !== '') {
            if (!subject.grade || subject.grade.trim() === '') {
              this.validationErrors[`subject_${index}_grade`] = `Grade is required for ${subject.subject}`;
              isValid = false;
            }
            if (!subject.sitting || subject.sitting.trim() === '') {
              this.validationErrors[`subject_${index}_sitting`] = `Sitting is required for ${subject.subject}`;
              isValid = false;
            }
          }
        });

        // Check English and Math grades
        const englishSubject = this.subjects.find(s => s.subject === 'English Language');
        const mathSubject = this.subjects.find(s => s.subject === 'Mathematics');
        const biologySubject = this.subjects.find(s => s.subject === 'Biology');
        const physicsSubject = this.subjects.find(s => s.subject === 'Physics');
        const chemistrySubject = this.subjects.find(s => s.subject === 'Chemistry');

        if (!englishSubject?.grade || !mathSubject?.grade || !biologySubject?.grade || !physicsSubject?.grade || !chemistrySubject?.grade) {
          this.validationErrors.coreSubjects = 'English Language, Mathematics, Biology, Physics, and Chemistry grades are required';
          isValid = false;
        }
      }

      if (stageIndex === 2) { // Upload Stage
        // Validate profile picture upload
        if (!this.uploadedDocuments.profile) {
          this.validationErrors.profilePicture = 'Profile picture is required';
          isValid = false;
        }

        // Validate O'Level result uploads for each sitting
        this.sittings.forEach((sitting, index) => {
          if (!this.uploadedDocuments.olevels[index]) {
            this.validationErrors[`olevel_${index}`] = `O'Level result upload is required for Sitting ${index + 1}`;
            isValid = false;
          }
        });

        // Validate reference letter uploads
        if (!this.uploadedDocuments.references[0]) {
          this.validationErrors.reference1 = 'Reference letter 1 is required';
          isValid = false;
        }

        if (!this.uploadedDocuments.references[1]) {
          this.validationErrors.reference2 = 'Reference letter 2 is required';
          isValid = false;
        }
      }

      return isValid;
    },

    async nextStage() {
      if (this.validateStage(this.currentStage)) {
        if (this.currentStage < this.stages.length - 1) {
          this.currentStage++;
        }
      } else {
        await Swal.fire({
          title: 'Validation Error',
          text: 'Please fill in all required fields correctly before proceeding.',
          icon: 'error',
          confirmButtonText: 'OK'
        });
      }
    },

    prefillUserData() {
      if (this.user) {
        // Prefill basic user data
        this.firstName = this.user.firstName || "";
        this.lastName = this.user.lastName || "";
        this.email = this.user.email || "";
        // phone is now stored in application collection, not user

        logger.info('Prefilled user data:', {
          firstName: this.firstName,
          lastName: this.lastName,
          email: this.email
        });
      }

      if (this.application) {
        logger.info('Application data available for prefilling:', {
          applicationData: this.application,
          hasDob: !!this.application.dob,
          hasGender: !!this.application.gender,
          hasPhone: !!this.application.phone,
          dobValue: this.application.dob,
          genderValue: this.application.gender,
          phoneValue: this.application.phone
        });

        // Prefill application-specific data if it exists
        this.middleName = this.application.middleName || this.user?.otherName || "";
        this.phone = this.application.phone || ""; // Phone from application collection
        this.dateOfBirth = this.application.dob ?
          new Date(this.application.dob).toISOString().split('T')[0] : "";
        this.gender = this.application.gender || "";
        
        // Only prefill if current form field is empty (don't overwrite user input)
        if (!this.religion) {
          this.religion = this.application.religion || "";
        }
        if (!this.maritalStatus) {
          this.maritalStatus = this.application.maritalStatus || "";
        }
        if (!this.address) {
          this.address = this.application.address || "";
        }

        logger.info('After prefilling application data:', {
          middleName: this.middleName,
          phone: this.phone,
          dateOfBirth: this.dateOfBirth,
          gender: this.gender,
          religion: this.religion,
          maritalStatus: this.maritalStatus,
          address: this.address
        });

        // Regenerate years now that we have the application data with birth year
        this.generateYears();

        // Prefill academic background
        if (this.application.academicBackground) {
          const academic = this.application.academicBackground;
          if (academic.primary) {
            this.primarySchool = academic.primary.name || "";
            this.primarySchoolStart = academic.primary.startDate || "";
            this.primarySchoolEnd = academic.primary.endDate || "";
          }
          if (academic.secondary) {
            this.secondarySchool = academic.secondary.name || "";
            this.secondarySchoolStart = academic.secondary.startDate || "";
            this.secondarySchoolEnd = academic.secondary.endDate || "";
          }
        }

        // Prefill next of kin
        if (this.application.nextOfKin) {
          this.nextOfKinName = this.application.nextOfKin.name || "";
          this.nextOfKinPhone = this.application.nextOfKin.phone || "";
          this.nextOfKinEmail = this.application.nextOfKin.email || "";
          this.nextOfKinRelationship = this.application.nextOfKin.relationship || "";
          this.nextOfKinAddress = this.application.nextOfKin.address || "";
        }

        // Prefill referees
        if (this.application.referees && this.application.referees.length > 0) {
          this.referee1Name = this.application.referees[0]?.name || "";
          this.referee1Phone = this.application.referees[0]?.phone || "";
          this.referee1Email = this.application.referees[0]?.email || "";

          if (this.application.referees.length > 1) {
            this.referee2Name = this.application.referees[1]?.name || "";
            this.referee2Phone = this.application.referees[1]?.phone || "";
            this.referee2Email = this.application.referees[1]?.email || "";
          }
        }

        // Prefill examinations if they exist
        if (this.application.examinations && this.application.examinations.length > 0) {
          this.sittings = this.application.examinations.map(exam => ({
            examType: exam.examType || "",
            examYear: exam.examYear || "",
            examNumber: exam.examNumber || ""
          }));

          // Prefill subjects from the first examination
          if (this.application.examinations[0].subjects) {
            const existingSubjects = this.application.examinations[0].subjects;
            // Keep the mandatory subjects and add others
            this.subjects = [
              ...this.subjects, // Keep English, Maths, Biology, Physics and Chemistry locked
              ...existingSubjects.filter(subj =>
                !["English Language", "Mathematics", "Biology", "Physics", "Chemistry"].includes(subj.subject)  
              ).map(subj => ({
                subject: subj.subject,
                grade: subj.grade,
                sitting: "Sitting 1", // Default to first sitting
                locked: false
              }))
            ];
          }
        }

        // Set profile image if exists
        if (this.application.profileImageUrl) {
          this.profilePreview = this.application.profileImageUrl;
          this.uploadedDocuments.profile = {
            url: this.application.profileImageUrl,
            type: 'profile_picture'
          };
        }

        logger.info('Prefilled application data:', {
          hasApplication: !!this.application,
          applicationNumber: this.application.applicationNumber,
          dob: this.application.dob,
          currentStage: this.application.currentStage
        });
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
    },

    // Date validation methods
    validateDateInput(dateString, fieldName) {
      if (!dateString) return true; // Empty dates will be caught by required validation

      const date = new Date(dateString);
      const today = new Date();
      const currentYear = today.getFullYear();

      // Check if date is valid
      if (isNaN(date.getTime())) {
        this.validationErrors[fieldName] = 'Please enter a valid date';
        return false;
      }

      // Check if date is not in the future
      if (date > today) {
        this.validationErrors[fieldName] = 'Date cannot be in the future';
        return false;
      }

      // Check reasonable date ranges for education
      const year = date.getFullYear();
      if (year < 1950 || year > currentYear) {
        this.validationErrors[fieldName] = `Year must be between 1950 and ${currentYear}`;
        return false;
      }

      // Clear any existing error for this field
      delete this.validationErrors[fieldName];
      return true;
    },

    validateDateRange(startDate, endDate, startFieldName, endFieldName, schoolType) {
      if (!startDate || !endDate) return true;

      const start = new Date(startDate);
      const end = new Date(endDate);

      // Validate individual dates first
      if (!this.validateDateInput(startDate, startFieldName) ||
        !this.validateDateInput(endDate, endFieldName)) {
        return false;
      }

      // Check if end date is after start date
      if (start >= end) {
        this.validationErrors[endFieldName] = `${schoolType} end date must be after start date`;
        return false;
      }

      // Check reasonable duration (minimum 1 year, maximum 15 years)
      const yearsDiff = (end - start) / (1000 * 60 * 60 * 24 * 365.25);
      if (yearsDiff < 1) {
        this.validationErrors[endFieldName] = `${schoolType} duration must be at least 1 year`;
        return false;
      }
      if (yearsDiff > 15) {
        this.validationErrors[endFieldName] = `${schoolType} duration cannot exceed 15 years`;
        return false;
      }

      // Clear errors if validation passes
      delete this.validationErrors[startFieldName];
      delete this.validationErrors[endFieldName];
      return true;
    },

    validateEducationProgression() {
      if (!this.primarySchoolEnd || !this.secondarySchoolStart) return true;

      const primaryEnd = new Date(this.primarySchoolEnd);
      const secondaryStart = new Date(this.secondarySchoolStart);

      // Secondary school should start after primary school ends (allow same year)
      if (secondaryStart < primaryEnd) {
        this.validationErrors.secondarySchoolStart = 'Secondary school start date should be after primary school end date';
        return false;
      }

      // Check for reasonable gap (not more than 5 years gap)
      const yearsDiff = (secondaryStart - primaryEnd) / (1000 * 60 * 60 * 24 * 365.25);
      if (yearsDiff > 5) {
        this.validationErrors.secondarySchoolStart = 'Gap between primary and secondary school cannot exceed 5 years';
        return false;
      }

      delete this.validationErrors.secondarySchoolStart;
      return true;
    },

    // Real-time validation handlers
    onPrimaryStartDateChange() {
      this.validateDateInput(this.primarySchoolStart, 'primarySchoolStart');
      if (this.primarySchoolEnd) {
        this.validateDateRange(this.primarySchoolStart, this.primarySchoolEnd, 'primarySchoolStart', 'primarySchoolEnd', 'Primary school');
      }
      this.validateEducationProgression();
    },

    onPrimaryEndDateChange() {
      this.validateDateInput(this.primarySchoolEnd, 'primarySchoolEnd');
      if (this.primarySchoolStart) {
        this.validateDateRange(this.primarySchoolStart, this.primarySchoolEnd, 'primarySchoolStart', 'primarySchoolEnd', 'Primary school');
      }
      this.validateEducationProgression();
    },

    onSecondaryStartDateChange() {
      this.validateDateInput(this.secondarySchoolStart, 'secondarySchoolStart');
      if (this.secondarySchoolEnd) {
        this.validateDateRange(this.secondarySchoolStart, this.secondarySchoolEnd, 'secondarySchoolStart', 'secondarySchoolEnd', 'Secondary school');
      }
      this.validateEducationProgression();
    },

    onSecondaryEndDateChange() {
      this.validateDateInput(this.secondarySchoolEnd, 'secondarySchoolEnd');
      if (this.secondarySchoolStart) {
        this.validateDateRange(this.secondarySchoolStart, this.secondarySchoolEnd, 'secondarySchoolStart', 'secondarySchoolEnd', 'Secondary school');
      }
    },

    // Location selection handlers
    onNationalityChange(selectedCountry) {
      this.nationality = selectedCountry ? selectedCountry.name : '';
      this.state = '';
      this.lga = '';
      this.loadStatesForCountry();
    },

    onStateChange(selectedState) {
      this.state = selectedState ? selectedState.name : '';
      this.lga = '';
      this.loadCitiesForState();
    },

    onLgaChange(selectedCity) {
      this.lga = selectedCity ? selectedCity.name : '';
    },

    // Helper method to clear file input
    clearFileInput(inputId) {
      try {
        // Use getElementById which is more reliable for dynamic elements
        const fileInput = document.getElementById(inputId);

        if (fileInput && fileInput.type === 'file') {
          fileInput.value = '';
          // Trigger change event to ensure any bound data is updated
          fileInput.dispatchEvent(new Event('input', { bubbles: true }));
          logger.info(`Successfully cleared file input: ${inputId}`);
        } else {
          logger.warn(`File input not found or invalid: ${inputId}`);
        }
      } catch (error) {
        logger.warn(`Failed to clear file input ${inputId}:`, error);
      }
    },

    // File upload methods
    async handleProfileUpload(event) {
      const file = event.target.files[0];
      if (!file) return;

      await this.uploadFile(file, 'profile_picture');
    },

    async handleOLevelUpload(event, sittingIndex) {
      const file = event.target.files[0];
      if (!file) return;

      await this.uploadFile(file, 'olevel_result', { sittingIndex });
    },

    async handleReferenceUpload(event, referenceIndex) {
      const file = event.target.files[0];
      if (!file) return;

      await this.uploadFile(file, 'reference_letter', { referenceIndex });
    },

    async uploadFile(file, fileType, options = {}) {
      if (!file) {
        await Swal.fire({
          title: 'No File Selected',
          text: 'Please select a file to upload.',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
        return;
      }

      try {
        this.isUploading = true;

        logger.info('Starting file upload:', {
          fileName: file.name,
          fileSize: `${(file.size / (1024 * 1024)).toFixed(2)}MB`,
          fileType,
          options
        });

        // Validate file size based on type
        const fileSizeLimits = {
          'profile_picture': 2 * 1024 * 1024, // 2MB for profile pictures
          'olevel_result': 3 * 1024 * 1024,   // 3MB for documents
          'reference_letter': 3 * 1024 * 1024 // 3MB for documents
        };

        const maxSize = fileSizeLimits[fileType];
        const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);

        if (file.size > maxSize) {
          await Swal.fire({
            title: 'File Too Large',
            text: `File size exceeds ${maxSizeMB}MB limit for ${fileType.replace('_', ' ')}. Current size: ${(file.size / (1024 * 1024)).toFixed(2)}MB`,
            icon: 'error',
            confirmButtonText: 'OK'
          });
          return;
        }

        // Validate file type
        const allowedTypes = {
          'profile_picture': ['image/jpeg', 'image/jpg'],
          'olevel_result': ['application/pdf'],
          'reference_letter': ['application/pdf']
        };

        if (!allowedTypes[fileType]?.includes(file.type)) {
          await Swal.fire({
            title: 'Invalid File Type',
            text: `Invalid file type. Expected: ${allowedTypes[fileType]?.join(', ')}`,
            icon: 'error',
            confirmButtonText: 'OK'
          });
          return;
        }

        // Create FormData
        const formData = new FormData();
        formData.append('file', file);
        formData.append('fileType', fileType);

        if (options.sittingIndex !== undefined) {
          formData.append('sittingIndex', options.sittingIndex.toString());
        }
        if (options.referenceIndex !== undefined) {
          formData.append('referenceIndex', options.referenceIndex.toString());
        }

        // Upload file
        const response = await apiService.post('/applications/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (response.success) {
          logger.info('File uploaded to temporary storage:', {
            fileType,
            url: response.data.url,
            key: response.data.key
          });

          // Store uploaded file metadata for later submission
          // Note: Files are uploaded to DigitalOcean but not saved to database yet
          switch (fileType) {
            case 'profile_picture':
              this.profilePreview = response.data.url;
              this.profileFileInfo = {
                name: file.name,
                size: this.formatFileSize(file.size)
              };
              this.uploadedDocuments.profile = {
                url: response.data.url,
                key: response.data.key, // Store key for cleanup if needed
                type: fileType,
                originalName: file.name,
                size: file.size,
                uploadedAt: response.data.uploadedAt
              };
              break;
            case 'olevel_result':
              this.uploadedDocuments.olevels[options.sittingIndex] = {
                url: response.data.url,
                key: response.data.key,
                type: fileType,
                name: file.name,
                originalName: file.name,
                size: file.size,
                uploadedAt: response.data.uploadedAt,
                sittingIndex: options.sittingIndex
              };
              break;
            case 'reference_letter':
              this.uploadedDocuments.references[options.referenceIndex] = {
                url: response.data.url,
                key: response.data.key,
                type: fileType,
                name: file.name,
                originalName: file.name,
                size: file.size,
                uploadedAt: response.data.uploadedAt,
                referenceIndex: options.referenceIndex
              };
              break;
          }

          // Show success message
          await Swal.fire({
            title: 'File Ready',
            text: `${file.name} uploaded successfully. Complete and submit the form to finalize your application.`,
            icon: 'success',
            timer: 3000,
            timerProgressBar: true,
            showConfirmButton: false
          });

        } else {
          throw new Error(response.error || 'Upload failed');
        }

      } catch (error) {
        logger.error('File upload failed:', {
          fileName: file.name,
          fileType,
          error: error.message
        });

        // Show error message
        await Swal.fire({
          title: 'Upload Failed',
          text: error.message || 'File upload failed',
          icon: 'error',
          confirmButtonText: 'Try Again'
        });

      } finally {
        this.isUploading = false;
        // Clear the input so same file can be selected again if needed
        if (event && event.target) {
          event.target.value = '';
        }
      }
    },

    formatFileSize(bytes) {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    async removeDocument(documentType, documentUrl) {
      try {
        // Check if we have an application - if not, try to get it
        let applicationId = this.application?.id;

        if (!applicationId) {
          // Try to refresh the auth store to get the latest application data
          await this.authStore.refreshUserData();
          applicationId = this.application?.id;
        }

        if (!applicationId) {
          throw new Error('No application found. Please save your application first before removing documents.');
        }

        const response = await apiService.post('/applications/remove-document', {
          applicationId,
          documentType,
          documentUrl
        });

        if (response.success) {
          // Update local state
          switch (documentType) {
            case 'profile_picture':
              this.profilePreview = null;
              this.uploadedDocuments.profile = null;
              this.profileFileInfo = null;
              // Clear the file input
              this.clearFileInput('profileFileInput');
              break;
            case 'olevel_result':
              // Find which sitting this document belongs to
              for (let index in this.uploadedDocuments.olevels) {
                if (this.uploadedDocuments.olevels[index]?.url === documentUrl) {
                  this.uploadedDocuments.olevels[index] = null;
                  // Clear the corresponding file input
                  this.clearFileInput(`olevelFileInput_${index}`);
                  break;
                }
              }
              break;
            case 'reference_letter':
              // Find which reference this document belongs to
              for (let index in this.uploadedDocuments.references) {
                if (this.uploadedDocuments.references[index]?.url === documentUrl) {
                  this.uploadedDocuments.references[index] = null;
                  // Clear the corresponding file input
                  this.clearFileInput(`referenceFileInput_${index}`);
                  break;
                }
              }
              break;
          }

          this.$toast?.success('Document removed successfully');
        } else {
          throw new Error(response.error || 'Failed to remove document');
        }
      } catch (error) {
        logger.error('Document removal failed:', error);
        this.$toast?.error(error.message || 'Failed to remove document');
      }
    },

    async submitApplication() {
      // Check if declaration is checked before proceeding
      if (!this.declaration) {
        await Swal.fire({
          title: 'Declaration Required',
          text: 'Please check the declaration box to confirm that all information provided is true and correct.',
          icon: 'warning',
          confirmButtonText: 'OK'
        });
        return;
      }

      try {
        this.isSubmitting = true;

        logger.info('Starting application submission...');

        // Debug: Check program selections
        logger.info('Program selections:', {
          selectedProgram: this.selectedProgram,
          selectedProgramType: this.selectedProgramType,
          selectedProgramMode: this.selectedProgramMode
        });

        // If no program is selected, use default program data from API
        let programId = this.selectedProgram?._id;
        let programTypeId = this.selectedProgramType?._id;
        let programModeId = this.selectedProgramMode?._id;

        if (!programId || !programTypeId || !programModeId) {
          logger.info('No program selected, fetching default programs from API...');

          try {
            const [programsResponse, typesResponse, modesResponse] = await Promise.all([
              apiService.get('/programs'),
              apiService.get('/programs/types'),
              apiService.get('/programs/modes')
            ]);

            if (programsResponse.success && programsResponse.data.length > 0) {
              programId = programId || programsResponse.data[0].id;
            }
            if (typesResponse.success && typesResponse.data.length > 0) {
              programTypeId = programTypeId || typesResponse.data[0].id;
            }
            if (modesResponse.success && modesResponse.data.length > 0) {
              programModeId = programModeId || modesResponse.data[0].id;
            }

            logger.info('Using default programs:', { programId, programTypeId, programModeId });
          } catch (error) {
            logger.error('Failed to fetch default programs:', error);
            throw new Error('Failed to get program information. Please try again.');
          }
        }

        // Collect all uploaded files into a single array
        const uploadedFiles = [];

        // Add profile picture if uploaded
        if (this.uploadedDocuments.profile) {
          uploadedFiles.push(this.uploadedDocuments.profile);
        }

        // Add O'Level results
        Object.values(this.uploadedDocuments.olevels).forEach(doc => {
          if (doc) uploadedFiles.push(doc);
        });

        // Add reference letters
        Object.values(this.uploadedDocuments.references).forEach(doc => {
          if (doc) uploadedFiles.push(doc);
        });

        // Prepare application data
        const applicationData = {
          programId: programId,
          programTypeId: programTypeId,
          programModeId: programModeId,
          personalInfo: {
            firstName: this.firstName,
            middleName: this.middleName,
            lastName: this.lastName,
            dob: this.dateOfBirth, // Backend expects 'dob' field
            gender: this.gender,
            phone: this.phone,
            email: this.email,
            religion: this.religion,
            maritalStatus: this.maritalStatus,
            address: this.address,
            lga: this.lga,
            stateOfOrigin: this.state,
            nationality: this.nationality
          },
          academicInfo: {
            primarySchool: {
              name: this.primarySchool,
              startDate: this.primarySchoolStart,
              endDate: this.primarySchoolEnd
            },
            secondarySchool: {
              name: this.secondarySchool,
              startDate: this.secondarySchoolStart,
              endDate: this.secondarySchoolEnd
            },
            examinations: this.sittings.map((sitting, sittingIndex) => ({
              examType: sitting.examType,
              examYear: sitting.examYear,
              examNumber: sitting.examNumber,
              subjects: this.subjects.filter(s => {
                // Match subjects to sitting by sitting type or index
                const sittingMatch = s.sitting === sitting.examType ||
                  s.sitting === `Sitting ${sittingIndex + 1}`;
                return s.subject && s.grade && sittingMatch;
              })
            })),
            nextOfKin: {
              name: this.nextOfKinName,
              phone: this.nextOfKinPhone,
              email: this.nextOfKinEmail,
              relationship: this.nextOfKinRelationship,
              address: this.nextOfKinAddress
            },
            referees: [
              {
                name: this.referee1Name,
                phone: this.referee1Phone,
                email: this.referee1Email
              },
              {
                name: this.referee2Name,
                phone: this.referee2Phone,
                email: this.referee2Email
              }
            ]
          },
          uploadedFiles: uploadedFiles
        };

        logger.info('Submitting application:', {
          programId: applicationData.programId,
          uploadedFilesCount: uploadedFiles.length,
          personalInfo: !!applicationData.personalInfo,
          academicInfo: !!applicationData.academicInfo,
          dob: applicationData.personalInfo.dob,
          stateOfOrigin: applicationData.personalInfo.stateOfOrigin,
          examinationsCount: applicationData.academicInfo.examinations.length,
          totalSubjects: applicationData.academicInfo.examinations.reduce((total, exam) => total + exam.subjects.length, 0)
        });

        // Submit application
        const response = await apiService.post('/applications/submit-application', applicationData);

        if (response.success) {
          logger.info('Application submitted successfully:', response.data);

          // Update auth store with new application data
          await this.authStore.updateApplication(response.data);

          // Refresh user data to get updated currentStage
          await this.authStore.refreshUserData();

          // Show success message
          await Swal.fire({
            title: 'Application Submitted!',
            text: `Your application has been submitted successfully. Application ID: ${response.data.applicationNumber}`,
            icon: 'success',
            confirmButtonText: 'Continue to Dashboard'
          });

          // Clear uploaded documents from local state
          this.uploadedDocuments = {
            profile: null,
            olevels: {},
            references: {}
          };
          this.profilePreview = null;
          this.profileFileInfo = null;

          // Redirect to dashboard
          this.$router.push('/dashboard');

        } else {
          throw new Error(response.error || 'Application submission failed');
        }

      } catch (error) {
        logger.error('Application submission failed:', error);

        // Show error message
        await Swal.fire({
          title: 'Submission Failed',
          text: error.message || 'Failed to submit application. Please try again.',
          icon: 'error',
          confirmButtonText: 'Try Again'
        });

        // If submission failed and files were uploaded, offer to clean them up
        if (error.message && error.message.includes('cleaned up')) {
          // Files were already cleaned up by the server
          this.uploadedDocuments = {
            profile: null,
            olevels: {},
            references: {}
          };
          this.profilePreview = null;
          this.profileFileInfo = null;
        }

      } finally {
        this.isSubmitting = false;
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
              <input
                type="text"
                class="form-control"
                id="firstName"
                v-model="firstName"
                :disabled="true"
                readonly
              />
              <small class="text-muted"
                >This field is auto-filled from your account</small
              >
            </div>

            <div class="col-md-4">
              <label for="middleName" class="form-label small">
                Middle Name <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                id="middleName"
                v-model="middleName"
                :disabled="true"
                readonly
              />
              <small class="text-muted"
                >This field is auto-filled from your account</small
              >
            </div>

            <div class="col-md-4">
              <label for="lastName" class="form-label small">
                Last Name <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                id="lastName"
                v-model="lastName"
                :disabled="true"
                readonly
              />
              <small class="text-muted"
                >This field is auto-filled from your account</small
              >
            </div>

            <div class="col-md-6">
              <label for="dateOfBirth" class="form-label small">
                Date of Birth <span class="text-danger">*</span>
              </label>
              <input
                type="date"
                class="form-control"
                id="dateOfBirth"
                v-model="dateOfBirth"
                :disabled="true"
                readonly
              />
              <small class="text-muted"
                >This field is auto-filled from your account</small
              >
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
                    name="gender"
                    id="genderMale"
                    value="male"
                    v-model="gender"
                    disabled
                  />
                  <label class="form-check-label" for="genderMale">
                    Male
                  </label>
                </div>
                <div class="form-check">
                  <input
                    class="form-check-input"
                    type="radio"
                    name="gender"
                    id="genderFemale"
                    value="female"
                    v-model="gender"
                    disabled
                  />
                  <label class="form-check-label" for="genderFemale">
                    Female
                  </label>
                </div>
                <div class="form-check">
                  <input
                    class="form-check-input"
                    type="radio"
                    name="gender"
                    id="genderOther"
                    value="other"
                    v-model="gender"
                    disabled
                  />
                  <label class="form-check-label" for="genderOther">
                    Others
                  </label>
                </div>
              </div>
              <small class="text-muted"
                >This field is auto-filled from your account</small
              >
            </div>

            <div class="col-md-6">
              <label for="phone" class="form-label small">
                Phone <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                id="phone"
                v-model="phone"
                :class="{ 'is-invalid': validationErrors.phone }"
                :disabled="true"
                readonly
              />
              <small class="text-muted"
                >This field is auto-filled from your account</small
              >
              <div v-if="validationErrors.phone" class="invalid-feedback">
                {{ validationErrors.phone }}
              </div>
            </div>

            <div class="col-md-6">
              <label for="email" class="form-label small">
                Email <span class="text-danger">*</span>
              </label>
              <input
                type="email"
                class="form-control"
                id="email"
                v-model="email"
                :class="{ 'is-invalid': validationErrors.email }"
                :disabled="true"
                readonly
              />
              <small class="text-muted"
                >This field is auto-filled from your account</small
              >
              <div v-if="validationErrors.email" class="invalid-feedback">
                {{ validationErrors.email }}
              </div>
            </div>

            <div class="col-md-6">
              <label for="religion" class="form-label small">
                Religion <span class="text-danger">*</span>
              </label>
              <select
                class="form-select"
                id="religion"
                v-model="religion"
                :class="{ 'is-invalid': validationErrors.religion }"
                required
              >
                <option value="">--Select Religion--</option>
                <option
                  v-for="religionItem in religionOptions"
                  :key="religionItem"
                  :value="religionItem"
                >
                  {{ religionItem }}
                </option>
              </select>
              <div v-if="validationErrors.religion" class="invalid-feedback">
                {{ validationErrors.religion }}
              </div>
            </div>

            <div class="col-md-6">
              <label for="maritalStatus" class="form-label small">
                Marital Status <span class="text-danger">*</span>
              </label>
              <select
                class="form-select"
                id="maritalStatus"
                v-model="maritalStatus"
                :class="{ 'is-invalid': validationErrors.maritalStatus }"
                required
              >
                <option value="">--Select Marital Status--</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
              </select>
              <div
                v-if="validationErrors.maritalStatus"
                class="invalid-feedback"
              >
                {{ validationErrors.maritalStatus }}
              </div>
            </div>

            <div class="col-md-4">
              <label for="nationality" class="form-label small">
                Nationality <span class="text-danger">*</span>
              </label>
              <v-select
                v-model="selectedNationalityObject"
                :options="countries"
                label="name"
                :searchable="true"
                :clearable="false"
                placeholder="--Select nationality--"
                :class="{ 'is-invalid': validationErrors.nationality }"
                class="vue-select-custom"
                @update:modelValue="onNationalityChange"
              />
              <div v-if="validationErrors.nationality" class="invalid-feedback">
                {{ validationErrors.nationality }}
              </div>
            </div>

            <div class="col-md-4">
              <label for="state" class="form-label small">
                State of Origin <span class="text-danger">*</span>
              </label>
              <v-select
                v-model="selectedStateObject"
                :options="states"
                label="name"
                :searchable="true"
                :clearable="false"
                :disabled="!nationality"
                :placeholder="
                  nationality ? '--Select State--' : 'Select nationality first'
                "
                :class="{ 'is-invalid': validationErrors.state }"
                class="vue-select-custom"
                @update:modelValue="onStateChange"
              />
              <div v-if="validationErrors.state" class="invalid-feedback">
                {{ validationErrors.state }}
              </div>
            </div>

            <div class="col-md-4">
              <label for="lga" class="form-label small">
                Local Government Area <span class="text-danger">*</span>
              </label>
              <v-select
                v-model="selectedLgaObject"
                :options="cities"
                label="name"
                :searchable="true"
                :clearable="false"
                :disabled="!state"
                :placeholder="state ? '--Select LGA--' : 'Select state first'"
                :class="{ 'is-invalid': validationErrors.lga }"
                class="vue-select-custom"
                @update:modelValue="onLgaChange"
              />
              <div v-if="validationErrors.lga" class="invalid-feedback">
                {{ validationErrors.lga }}
              </div>
            </div>

            <div class="col-md-12">
              <label for="address" class="form-label small">
                Contact Address <span class="text-danger">*</span>
              </label>
              <textarea
                class="form-control"
                id="address"
                rows="3"
                v-model="address"
                :class="{ 'is-invalid': validationErrors.address }"
                required
              ></textarea>
              <div v-if="validationErrors.address" class="invalid-feedback">
                {{ validationErrors.address }}
              </div>
            </div>
          </div>
        </div>

        <h6 class="fw-semibold mt-5">Other details</h6>
        <div class="card border-0 acon-bg-light p-3">
          <div class="row g-3">
            <div class="col-md-4">
              <label for="nextOfKinName" class="form-label small">
                Next of Kin Name <span class="text-danger">*</span></label
              >
              <input
                type="text"
                class="form-control"
                id="nextOfKinName"
                v-model="nextOfKinName"
                :class="{ 'is-invalid': validationErrors.nextOfKinName }"
                required
              />
              <div
                v-if="validationErrors.nextOfKinName"
                class="invalid-feedback"
              >
                {{ validationErrors.nextOfKinName }}
              </div>
            </div>

            <div class="col-md-4">
              <label for="nextOfKinPhone" class="form-label small">
                Next of Kin Phone <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                id="nextOfKinPhone"
                v-model="nextOfKinPhone"
                :class="{ 'is-invalid': validationErrors.nextOfKinPhone }"
                required
              />
              <div
                v-if="validationErrors.nextOfKinPhone"
                class="invalid-feedback"
              >
                {{ validationErrors.nextOfKinPhone }}
              </div>
            </div>

            <div class="col-md-4">
              <label for="nextOfKinEmail" class="form-label small">
                Next of Kin Email <span class="text-danger">*</span>
              </label>
              <input
                type="email"
                class="form-control"
                id="nextOfKinEmail"
                v-model="nextOfKinEmail"
                :class="{ 'is-invalid': validationErrors.nextOfKinEmail }"
                required
              />
              <div
                v-if="validationErrors.nextOfKinEmail"
                class="invalid-feedback"
              >
                {{ validationErrors.nextOfKinEmail }}
              </div>
            </div>

            <div class="col-md-4">
              <label for="nextOfKinRelationship" class="form-label small">
                Next of Kin Relationship <span class="text-danger">*</span>
              </label>
              <select
                class="form-select"
                id="nextOfKinRelationship"
                v-model="nextOfKinRelationship"
                :class="{
                  'is-invalid': validationErrors.nextOfKinRelationship,
                }"
                required
              >
                <option value="">--Select Relationship--</option>
                <option
                  v-for="relationship in relationshipOptions"
                  :key="relationship"
                  :value="relationship"
                >
                  {{ relationship }}
                </option>
              </select>
              <div
                v-if="validationErrors.nextOfKinRelationship"
                class="invalid-feedback"
              >
                {{ validationErrors.nextOfKinRelationship }}
              </div>
            </div>

            <div class="col-md-8">
              <label for="nextOfKinAddress" class="form-label small">
                Next of Kin Address <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                id="nextOfKinAddress"
                v-model="nextOfKinAddress"
                :class="{ 'is-invalid': validationErrors.nextOfKinAddress }"
                required
              />
              <div
                v-if="validationErrors.nextOfKinAddress"
                class="invalid-feedback"
              >
                {{ validationErrors.nextOfKinAddress }}
              </div>
            </div>

            <div class="col-md-4">
              <label for="referee1Name" class="form-label small">
                Referee 1 Name <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                id="referee1Name"
                v-model="referee1Name"
                :class="{ 'is-invalid': validationErrors.referee1Name }"
                required
              />
              <div
                v-if="validationErrors.referee1Name"
                class="invalid-feedback"
              >
                {{ validationErrors.referee1Name }}
              </div>
            </div>

            <div class="col-md-4">
              <label for="referee1Phone" class="form-label small">
                Referee 1 Phone <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                id="referee1Phone"
                v-model="referee1Phone"
                :class="{ 'is-invalid': validationErrors.referee1Phone }"
                required
              />
              <div
                v-if="validationErrors.referee1Phone"
                class="invalid-feedback"
              >
                {{ validationErrors.referee1Phone }}
              </div>
            </div>

            <div class="col-md-4">
              <label for="referee1Email" class="form-label small">
                Referee 1 Email <span class="text-danger">*</span>
              </label>
              <input
                type="email"
                class="form-control"
                id="referee1Email"
                v-model="referee1Email"
                :class="{ 'is-invalid': validationErrors.referee1Email }"
                required
              />
              <div
                v-if="validationErrors.referee1Email"
                class="invalid-feedback"
              >
                {{ validationErrors.referee1Email }}
              </div>
            </div>

            <div class="col-md-4">
              <label for="referee2Name" class="form-label small">
                Referee 2 Name <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                id="referee2Name"
                v-model="referee2Name"
                :class="{ 'is-invalid': validationErrors.referee2Name }"
                required
              />
              <div
                v-if="validationErrors.referee2Name"
                class="invalid-feedback"
              >
                {{ validationErrors.referee2Name }}
              </div>
            </div>

            <div class="col-md-4">
              <label for="referee2Phone" class="form-label small">
                Referee 2 Phone <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                id="referee2Phone"
                v-model="referee2Phone"
                :class="{ 'is-invalid': validationErrors.referee2Phone }"
                required
              />
              <div
                v-if="validationErrors.referee2Phone"
                class="invalid-feedback"
              >
                {{ validationErrors.referee2Phone }}
              </div>
            </div>

            <div class="col-md-4">
              <label for="referee2Email" class="form-label small">
                Referee 2 Email <span class="text-danger">*</span>
              </label>
              <input
                type="email"
                class="form-control"
                id="referee2Email"
                v-model="referee2Email"
                :class="{ 'is-invalid': validationErrors.referee2Email }"
                required
              />
              <div
                v-if="validationErrors.referee2Email"
                class="invalid-feedback"
              >
                {{ validationErrors.referee2Email }}
              </div>
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
              <input
                type="text"
                class="form-control"
                id="primarySchool"
                v-model="primarySchool"
                :class="{ 'is-invalid': validationErrors.primarySchool }"
                required
              />
              <div
                v-if="validationErrors.primarySchool"
                class="invalid-feedback"
              >
                {{ validationErrors.primarySchool }}
              </div>
            </div>

            <div class="col-md-3">
              <label for="primarySchoolStart" class="form-label small">
                Start Date <span class="text-danger">*</span>
              </label>
              <input
                type="date"
                class="form-control"
                id="primarySchoolStart"
                v-model="primarySchoolStart"
                :class="{ 'is-invalid': validationErrors.primarySchoolStart }"
                :min="
                  this.application?.dob
                    ? new Date(this.application.dob).toISOString().split('T')[0]
                    : ''
                "
                :max="
                  primarySchoolEnd || new Date().toISOString().split('T')[0]
                "
                @change="onPrimaryStartDateChange"
                @blur="onPrimaryStartDateChange"
                required
              />
              <div
                v-if="validationErrors.primarySchoolStart"
                class="invalid-feedback"
              >
                {{ validationErrors.primarySchoolStart }}
              </div>
            </div>

            <div class="col-md-3">
              <label for="primarySchoolEnd" class="form-label small">
                End Date <span class="text-danger">*</span>
              </label>
              <input
                type="date"
                class="form-control"
                id="primarySchoolEnd"
                v-model="primarySchoolEnd"
                :class="{ 'is-invalid': validationErrors.primarySchoolEnd }"
                :min="primarySchoolStart"
                :max="
                  secondarySchoolStart || new Date().toISOString().split('T')[0]
                "
                @change="onPrimaryEndDateChange"
                @blur="onPrimaryEndDateChange"
                required
              />
              <div
                v-if="validationErrors.primarySchoolEnd"
                class="invalid-feedback"
              >
                {{ validationErrors.primarySchoolEnd }}
              </div>
            </div>

            <div class="col-md-6">
              <label for="secondarySchool" class="form-label small">
                Secondary School <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                id="secondarySchool"
                v-model="secondarySchool"
                :class="{ 'is-invalid': validationErrors.secondarySchool }"
                required
              />
              <div
                v-if="validationErrors.secondarySchool"
                class="invalid-feedback"
              >
                {{ validationErrors.secondarySchool }}
              </div>
            </div>

            <div class="col-md-3">
              <label for="secondarySchoolStart" class="form-label small">
                Start Date <span class="text-danger">*</span>
              </label>
              <input
                type="date"
                class="form-control"
                id="secondarySchoolStart"
                v-model="secondarySchoolStart"
                :class="{ 'is-invalid': validationErrors.secondarySchoolStart }"
                :min="primarySchoolEnd"
                :max="
                  secondarySchoolEnd || new Date().toISOString().split('T')[0]
                "
                @change="onSecondaryStartDateChange"
                @blur="onSecondaryStartDateChange"
                required
              />
              <div
                v-if="validationErrors.secondarySchoolStart"
                class="invalid-feedback"
              >
                {{ validationErrors.secondarySchoolStart }}
              </div>
            </div>

            <div class="col-md-3">
              <label for="secondarySchoolEnd" class="form-label small">
                End Date <span class="text-danger">*</span>
              </label>
              <input
                type="date"
                class="form-control"
                id="secondarySchoolEnd"
                v-model="secondarySchoolEnd"
                :class="{ 'is-invalid': validationErrors.secondarySchoolEnd }"
                :min="secondarySchoolStart"
                :max="new Date().toISOString().split('T')[0]"
                @change="onSecondaryEndDateChange"
                @blur="onSecondaryEndDateChange"
                required
              />
              <div
                v-if="validationErrors.secondarySchoolEnd"
                class="invalid-feedback"
              >
                {{ validationErrors.secondarySchoolEnd }}
              </div>
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
                :class="{
                  'is-invalid': validationErrors[`sitting_${index}_examType`],
                }"
                id="examType"
              >
                <option disabled value="">--Select Exam Type--</option>
                <option v-for="(type, i) in examTypes" :key="i" :value="type">
                  {{ type }}
                </option>
              </select>
              <div
                v-if="validationErrors[`sitting_${index}_examType`]"
                class="invalid-feedback"
              >
                {{ validationErrors[`sitting_${index}_examType`] }}
              </div>
            </div>

            <div class="col-md-4 mt-0">
              <label for="examYear" class="form-label small">
                Exam Year <span class="text-danger">*</span>
              </label>
              <select
                v-model="sitting.examYear"
                class="form-select"
                :class="{
                  'is-invalid': validationErrors[`sitting_${index}_examYear`],
                }"
                id="examYear"
              >
                <option disabled value="">--Select Year--</option>
                <option v-for="year in years" :key="year" :value="year">
                  {{ year }}
                </option>
              </select>
              <div
                v-if="validationErrors[`sitting_${index}_examYear`]"
                class="invalid-feedback"
              >
                {{ validationErrors[`sitting_${index}_examYear`] }}
              </div>
            </div>

            <div class="col-md-4 mt-0">
              <label for="examNumber" class="form-label small">
                Exam Number <span class="text-danger">*</span>
              </label>
              <input
                type="text"
                class="form-control"
                v-model="sitting.examNumber"
                :class="{
                  'is-invalid': validationErrors[`sitting_${index}_examNumber`],
                }"
                id="examNumber"
              />
              <div
                v-if="validationErrors[`sitting_${index}_examNumber`]"
                class="invalid-feedback"
              >
                {{ validationErrors[`sitting_${index}_examNumber`] }}
              </div>
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
                <!-- Show the locked subject's value if it's locked -->
                <option v-if="row.locked" :value="row.subject" selected>
                  {{ row.subject }}
                </option>
                <!-- Show available options for unlocked subjects (excluding already selected) -->
                <option
                  v-for="subject in getAvailableSubjectsFor(index)"
                  :key="subject"
                  :value="subject"
                  v-show="!row.locked"
                >
                  {{ subject }}
                </option>
              </select>
            </div>

            <div class="col-md-3">
              <label for="grade" class="form-label small">
                Grade <span class="text-danger">*</span>
              </label>
              <select
                v-model="row.grade"
                class="form-select"
                :class="{
                  'is-invalid': validationErrors[`subject_${index}_grade`],
                }"
              >
                <option disabled value="">--Select Grade--</option>
                <option v-for="grade in grades" :key="grade" :value="grade">
                  {{ grade }}
                </option>
              </select>
              <div
                v-if="validationErrors[`subject_${index}_grade`]"
                class="invalid-feedback"
              >
                {{ validationErrors[`subject_${index}_grade`] }}
              </div>
            </div>

            <div class="col-md-3">
              <label for="sitting" class="form-label small">
                Sitting <span class="text-danger">*</span>
              </label>

              <select
                v-model="row.sitting"
                class="form-select"
                :class="{
                  'is-invalid': validationErrors[`subject_${index}_sitting`],
                }"
              >
                <option disabled value="">--Select Sitting--</option>
                <option
                  v-for="(s, i) in sittings"
                  :key="i"
                  :value="'Sitting ' + (i + 1)"
                >
                  Sitting {{ i + 1 }}
                </option>
              </select>
              <div
                v-if="validationErrors[`subject_${index}_sitting`]"
                class="invalid-feedback"
              >
                {{ validationErrors[`subject_${index}_sitting`] }}
              </div>
            </div>

            <div class="col-md-1 d-flex align-items-end">
              <button
                v-if="!row.locked"
                class="btn btn-danger btn-sm"
                @click="removeSubject(index)"
              >
                <i class="bi bi-x h3"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- General validation errors for Stage 2 -->
        <div
          v-if="validationErrors.subjects || validationErrors.coreSubjects"
          class="mt-3"
        >
          <div v-if="validationErrors.subjects" class="alert alert-danger">
            <i class="bi bi-exclamation-triangle"></i>
            {{ validationErrors.subjects }}
          </div>
          <!-- <div v-if="validationErrors.coreSubjects" class="alert alert-danger">
            <i class="bi bi-exclamation-triangle"></i> {{ validationErrors.coreSubjects }}
          </div> -->
        </div>
      </div>

      <!-- Stage 3: Upload -->
      <div v-if="currentStage === 2">
        <!-- Loading indicator -->
        <div
          v-if="isUploading"
          class="alert alert-info d-flex align-items-center"
        >
          <div class="spinner-border spinner-border-sm me-2" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          Uploading file, please wait...
        </div>

        <h6 class="fw-semibold">Upload profile picture</h6>
        <div class="card border-0 acon-bg-light p-3">
          <div class="row g-3 mb-3">
            <div class="d-flex align-items-center">
              <div class="me-3 position-relative">
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

                <!-- Remove button for profile picture -->
                <button
                  v-if="profilePreview && !isUploading"
                  @click="
                    removeDocument(
                      'profile_picture',
                      uploadedDocuments.profile?.url
                    )
                  "
                  class="btn btn-danger btn-sm position-absolute top-0 end-0 rounded-circle"
                  style="width: 25px; height: 25px; padding: 0; line-height: 1"
                  title="Remove profile picture"
                >
                  <i class="bi bi-x" style="font-size: 14px"></i>
                </button>
              </div>
              <div class="flex-grow-1">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg"
                  class="form-control"
                  ref="profileFileInput"
                  id="profileFileInput"
                  :class="{ 'is-invalid': validationErrors.profilePicture }"
                  @change="handleProfileUpload"
                  :disabled="isUploading"
                  required
                />
                <small class="text-muted">
                  Upload a clear passport photograph (JPG/JPEG, Max: 2MB)
                </small>

                <div
                  v-if="validationErrors.profilePicture"
                  class="invalid-feedback"
                >
                  {{ validationErrors.profilePicture }}
                </div>

                <!-- File info display -->
                <div v-if="profileFileInfo" class="mt-2 p-2 bg-light rounded">
                  <div class="d-flex align-items-center">
                    <i class="bi bi-file-image text-primary me-2"></i>
                    <div>
                      <div class="small fw-medium">
                        {{ profileFileInfo.name }}
                      </div>
                      <div class="text-muted" style="font-size: 0.75rem">
                        {{ profileFileInfo.size }}
                      </div>
                    </div>
                    <i
                      class="bi bi-check-circle-fill text-success ms-auto"
                      title="Uploaded successfully"
                    ></i>
                  </div>
                </div>
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
            <div class="d-flex justify-content-between align-items-center mb-2">
              <p class="small text-secondary mb-0">
                Sitting {{ index + 1 }} -
                {{ sitting.examType || "Exam Type Not Set" }}
              </p>

              <!-- Remove uploaded document -->
              <button
                v-if="uploadedDocuments.olevels[index] && !isUploading"
                @click="
                  removeDocument(
                    'olevel_result',
                    uploadedDocuments.olevels[index].url
                  )
                "
                class="btn btn-sm btn-outline-danger"
              >
                <i class="bi bi-trash"></i> Remove
              </button>
            </div>

            <!-- Show uploaded file info -->
            <div
              v-if="uploadedDocuments.olevels[index]"
              class="alert alert-success py-2"
            >
              <i class="bi bi-check-circle-fill me-2"></i>
              <strong>Uploaded:</strong>
              {{ uploadedDocuments.olevels[index].name }}
            </div>

            <input
              type="file"
              accept="application/pdf"
              class="form-control"
              :ref="`olevelFileInput_${index}`"
              :id="`olevelFileInput_${index}`"
              :class="{ 'is-invalid': validationErrors[`olevel_${index}`] }"
              @change="handleOLevelUpload($event, index)"
              :disabled="isUploading"
              required
            />
            <small class="text-muted">
              Upload O'Level result for this sitting (PDF only, Max: 3MB)
            </small>

            <div
              v-if="validationErrors[`olevel_${index}`]"
              class="invalid-feedback"
            >
              {{ validationErrors[`olevel_${index}`] }}
            </div>
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
            <div class="d-flex justify-content-between align-items-center mb-2">
              <p class="small text-secondary mb-0">
                Reference Letter {{ index + 1 }}
              </p>

              <!-- Remove uploaded document -->
              <button
                v-if="uploadedDocuments.references[index] && !isUploading"
                @click="
                  removeDocument(
                    'reference_letter',
                    uploadedDocuments.references[index].url
                  )
                "
                class="btn btn-sm btn-outline-danger"
              >
                <i class="bi bi-trash"></i> Remove
              </button>
            </div>

            <!-- Show uploaded file info -->
            <div
              v-if="uploadedDocuments.references[index]"
              class="alert alert-success py-2"
            >
              <i class="bi bi-check-circle-fill me-2"></i>
              <strong>Uploaded:</strong>
              {{ uploadedDocuments.references[index].name }}
            </div>

            <input
              type="file"
              accept="application/pdf"
              class="form-control mt-0"
              :ref="`referenceFileInput_${index}`"
              :id="`referenceFileInput_${index}`"
              :class="{
                'is-invalid': validationErrors[`reference${index + 1}`],
              }"
              @change="handleReferenceUpload($event, index)"
              :disabled="isUploading"
              required
            />
            <small class="text-muted mt-2">
              Mandatory: upload referee letter {{ index + 1 }} (PDF only, Max:
              3MB)
            </small>
            <div
              v-if="validationErrors[`reference${index + 1}`]"
              class="invalid-feedback"
            >
              {{ validationErrors[`reference${index + 1}`] }}
            </div>
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
                <table
                  class="table table-bordered table-sm"
                  style="--bs-table-bg: #f0f8f8"
                >
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
              <!-- Profile Picture -->
              <div class="col-md-6">
                <p class="small text-muted mb-1">Profile Picture:</p>
                <div
                  v-if="uploadedDocuments.profile"
                  class="d-flex align-items-center"
                >
                  <img
                    :src="uploadedDocuments.profile.url"
                    alt="Profile"
                    class="img-thumbnail me-2"
                    style="width: 60px; height: 60px; object-fit: cover"
                  />
                  <div>
                    <p class="mb-0 small text-success">
                      <i class="bi bi-check-circle-fill me-1"></i>Uploaded
                    </p>
                  </div>
                </div>
                <p v-else class="small text-warning">
                  <i class="bi bi-exclamation-triangle-fill me-1"></i>Not
                  uploaded
                </p>
              </div>

              <!-- O'Level Results -->
              <div class="col-12">
                <h6 class="small fw-semibold">O'Level Results</h6>
                <div
                  v-for="(sitting, index) in sittings"
                  :key="index"
                  class="mb-2"
                >
                  <div
                    v-if="uploadedDocuments.olevels[index]"
                    class="d-flex align-items-center"
                  >
                    <i
                      class="bi bi-file-earmark-pdf text-danger me-2"
                      style="font-size: 1.2em"
                    ></i>
                    <div>
                      <p class="mb-0 small">
                        <strong>Sitting {{ index + 1 }}:</strong>
                        {{ uploadedDocuments.olevels[index].name }}
                      </p>
                      <p class="mb-0 small text-success">
                        <i class="bi bi-check-circle-fill me-1"></i>Uploaded
                      </p>
                    </div>
                  </div>
                  <p v-else class="small text-warning">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i>
                    Sitting {{ index + 1 }}: Not uploaded
                  </p>
                </div>
              </div>

              <!-- Reference Letters -->
              <div class="col-12">
                <h6 class="small fw-semibold">Reference Letters</h6>
                <div
                  v-for="(ref, index) in referenceLetters"
                  :key="index"
                  class="mb-2"
                >
                  <div
                    v-if="uploadedDocuments.references[index]"
                    class="d-flex align-items-center"
                  >
                    <i
                      class="bi bi-file-earmark-pdf text-danger me-2"
                      style="font-size: 1.2em"
                    ></i>
                    <div>
                      <p class="mb-0 small">
                        <strong>Reference Letter {{ index + 1 }}:</strong>
                        {{ uploadedDocuments.references[index].name }}
                      </p>
                      <p class="mb-0 small text-success">
                        <i class="bi bi-check-circle-fill me-1"></i>Uploaded
                      </p>
                    </div>
                  </div>
                  <p v-else class="small text-warning">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i>
                    Reference Letter {{ index + 1 }}: Not uploaded
                  </p>
                </div>
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
                required
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
        type="button"
        :disabled="isSubmitting"
        @click="submitApplication"
      >
        <span v-if="isSubmitting">
          <i class="spinner-border spinner-border-sm me-2" role="status"></i>
          Submitting...
        </span>
        <span v-else>Submit</span>
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

input[type="date"]::-webkit-calendar-picker-indicator {
  cursor: pointer;
  opacity: 1;
  display: block;
  color: transparent;
  background: url("https://cdn.jsdelivr.net/npm/bootstrap-icons/icons/calendar-date.svg")
    no-repeat center;
  background-size: 1rem 1rem;
}

/* Vue Select Custom Styling */
.vue-select-custom {
  font-size: 1rem;
}

.vue-select-custom :deep(.vs__dropdown-toggle) {
  border: 1px solid #ced4da;
  border-radius: 0.375rem;
  padding: 0.375rem 0.75rem;
  min-height: calc(1.5em + 0.75rem + 2px);
  background-color: #fff;
}

.vue-select-custom :deep(.vs__dropdown-toggle):hover {
  border-color: #86b7fe;
}

.vue-select-custom :deep(.vs__dropdown-toggle):focus-within {
  border-color: #86b7fe;
  outline: 0;
  box-shadow: 0 0 0 0.25rem rgba(13, 110, 253, 0.25);
}

.vue-select-custom.is-invalid :deep(.vs__dropdown-toggle) {
  border-color: #dc3545;
}

.vue-select-custom.is-invalid :deep(.vs__dropdown-toggle):focus-within {
  border-color: #dc3545;
  box-shadow: 0 0 0 0.25rem rgba(220, 53, 69, 0.25);
}

.vue-select-custom :deep(.vs__selected-options) {
  padding: 0;
  margin: 0;
}

.vue-select-custom :deep(.vs__selected) {
  margin: 0;
  padding: 0;
  color: #212529;
  font-size: 1rem;
}

.vue-select-custom :deep(.vs__search) {
  margin: 0;
  padding: 0;
  font-size: 0.875rem;
  color: #212529;
}

.vue-select-custom :deep(.vs__search::placeholder) {
  color: #6c757d;
}

.vue-select-custom :deep(.vs__dropdown-menu) {
  border: 1px solid #ced4da;
  border-radius: 0.375rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  font-size: 0.875rem;
  z-index: 1050;
}

.vue-select-custom :deep(.vs__dropdown-option) {
  padding: 0.5rem 0.75rem;
  color: #212529;
}

.vue-select-custom :deep(.vs__dropdown-option--highlight) {
  background-color: #0d6efd;
  color: white;
}

.vue-select-custom :deep(.vs__no-options) {
  padding: 0.5rem 0.75rem;
  color: #6c757d;
  font-style: italic;
}

.vue-select-custom :deep(.vs__spinner) {
  border-color: #0d6efd transparent transparent;
}

/* Disabled state */
.vue-select-custom :deep(.vs--disabled .vs__dropdown-toggle) {
  background-color: #6c757d !important;
  opacity: 1;
  cursor: not-allowed;
}

.vue-select-custom :deep(.vs--disabled .vs__selected) {
  color: #6c757d;
}

.vue-select-custom :deep(.vs--disabled .vs__search) {
  background-color: transparent;
  cursor: not-allowed;
}

/* Clear button styling */
.vue-select-custom :deep(.vs__clear) {
  margin-right: 8px;
}

.vue-select-custom :deep(.vs__open-indicator) {
  fill: #6c757d;
  margin-right: 4px;
}
</style>

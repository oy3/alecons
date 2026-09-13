<script setup>
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import Swal from "sweetalert2";
import { accommodationService } from "../services/accommodation.js";
import { residentConditions } from "../data/accommodationResources.js";

const router = useRouter();
const loading = ref(true);
const saving = ref(false);
const submitting = ref(false);
const error = ref("");
const overview = ref(null);
const step = ref(1);
const furthestAccessibleStep = ref(1);
const errors = reactive({});

const steps = [
  {
    number: 1,
    title: "Review Agreement",
    description: "Read the key terms and conditions.",
  },
  {
    number: 2,
    title: "Fill Details",
    description: "Provide student and guarantor information.",
  },
  {
    number: 3,
    title: "Sign & Submit",
    description: "Review and sign your agreement.",
  },
];

const form = reactive({
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
  agreeToTerms: false,
});

const relationships = [
  ["father", "Father"],
  ["mother", "Mother"],
  ["uncle", "Uncle"],
  ["aunt", "Aunt"],
  ["brother", "Brother"],
  ["sister", "Sister"],
  ["grandfather", "Grandfather"],
  ["grandmother", "Grandmother"],
  ["other_blood_relative", "Other blood relative"],
];

const detailRequirements = {
  tenantName: "Full name is required",
  courseOfStudy: "Course of study is required",
  residentialAddress: "Residential address is required",
  phoneNumber: "Phone number is required",
  parentName: "Parent or guardian name is required",
  parentPhone: "Parent or guardian phone is required",
  guarantorName: "Guarantor name is required",
  guarantorPhone: "Guarantor phone is required",
  guarantorAddress: "Guarantor address is required",
  guarantorOccupation: "Guarantor occupation is required",
  guarantorRelationship: "Select the guarantor relationship",
};

const formattedStart = computed(() =>
  formatDate(overview.value?.configuration?.tenancyStartDate),
);
const formattedEnd = computed(() =>
  formatDate(overview.value?.configuration?.tenancyEndDate),
);

function formatDate(value) {
  if (!value) return "Not configured";
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function hydrate(data) {
  const draft = data.draft || {};
  Object.assign(form, {
    tenantName: draft.personalInfo?.tenantName || data.student.fullName || "",
    courseOfStudy:
      draft.personalInfo?.courseOfStudy || data.student.program || "",
    residentialAddress:
      draft.personalInfo?.residentialAddress ||
      data.student.residentialAddress ||
      "",
    phoneNumber:
      draft.personalInfo?.phoneNumber || data.student.phoneNumber || "",
    parentName: draft.parentInfo?.name || "",
    parentPhone: draft.parentInfo?.phoneNumber || "",
    guarantorName: draft.guarantorInfo?.name || "",
    guarantorPhone: draft.guarantorInfo?.phoneNumber || "",
    guarantorAddress: draft.guarantorInfo?.address || "",
    guarantorOccupation: draft.guarantorInfo?.occupation || "",
    guarantorRelationship: draft.guarantorInfo?.relationship || "",
  });

  if (data.agreement?.hasDraft || data.draft) {
    const draftIsComplete = Object.keys(detailRequirements).every((key) =>
      String(form[key] || "").trim(),
    );
    furthestAccessibleStep.value = draftIsComplete ? 3 : 2;
    step.value = furthestAccessibleStep.value;
  }
}

async function load() {
  const response = await accommodationService.getOverview();
  if (!response.success) {
    error.value = response.error || "Could not load the agreement.";
  } else if (response.data.agreement?.status !== "not_started") {
    router.replace("/accommodation");
  } else {
    overview.value = response.data;
    hydrate(response.data);
  }
  loading.value = false;
}

function validateDetails() {
  Object.keys(errors).forEach((key) => delete errors[key]);
  Object.entries(detailRequirements).forEach(([key, message]) => {
    if (!String(form[key] || "").trim()) errors[key] = message;
  });
  return Object.keys(errors).length === 0;
}

function next() {
  if (step.value === 1) {
    furthestAccessibleStep.value = Math.max(furthestAccessibleStep.value, 2);
    step.value = 2;
  } else if (step.value === 2 && validateDetails()) {
    furthestAccessibleStep.value = 3;
    step.value = 3;
  }
}

function navigateToStep(targetStep) {
  if (targetStep <= furthestAccessibleStep.value) step.value = targetStep;
}

function stepIsComplete(stepNumber) {
  return stepNumber < furthestAccessibleStep.value;
}

async function saveDraft() {
  saving.value = true;
  const response = await accommodationService.saveAgreementDraft(form);
  saving.value = false;
  if (response.success) {
    const draftIsComplete = Object.keys(detailRequirements).every((key) =>
      String(form[key] || "").trim(),
    );
    furthestAccessibleStep.value = Math.max(
      furthestAccessibleStep.value,
      draftIsComplete ? 3 : 2,
    );
    Swal.fire({
      icon: "success",
      title: "Draft saved",
      text: "You can return and continue this agreement later.",
      timer: 1800,
      showConfirmButton: false,
    });
  } else {
    Swal.fire({
      icon: "error",
      title: "Could not save draft",
      text: response.error,
    });
  }
}

async function submit() {
  if (!validateDetails()) {
    step.value = 2;
    return;
  }
  if (!form.agreeToTerms) {
    errors.agreeToTerms = "You must accept the tenancy terms before signing.";
    return;
  }

  submitting.value = true;
  const response = await accommodationService.submitAgreement(form);
  submitting.value = false;
  if (response.success) {
    await Swal.fire({
      icon: "success",
      title: "Agreement signed",
      text: "You can now proceed to pay your accommodation fee.",
      confirmButtonColor: "#d3262d",
    });
    router.push("/accommodation");
  } else {
    Swal.fire({
      icon: "error",
      title: "Submission failed",
      text: response.error || response.message,
    });
  }
}

onMounted(load);
</script>

<template>
  <main class="container-fluid portal-page px-3 px-lg-4 py-4">
    <header
      class="d-flex flex-column flex-md-row align-items-md-start justify-content-between gap-2 mb-4"
    >
      <div>
        <h1 class="h2 fw-bold text-dark mb-1">
          <i class="bi bi-building text-primary me-2"></i>Accommodation
          Agreement
        </h1>
        <p class="text-muted mb-0">
          Review, complete and sign your hostel agreement.
        </p>
      </div>
      <nav class="small text-muted d-none d-md-block" aria-label="Breadcrumb">
        Accommodation <i class="bi bi-chevron-right mx-2"></i> Agreement
      </nav>
    </header>

    <section v-if="loading" class="card portal-card" aria-live="polite">
      <div
        class="card-body d-flex align-items-center justify-content-center gap-2 py-5 text-muted"
      >
        <span
          class="spinner-border spinner-border-sm"
          aria-hidden="true"
        ></span>
        Loading agreement...
      </div>
    </section>

    <section v-else-if="error" class="alert alert-danger">
      <div
        class="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3"
      >
        <span>{{ error }}</span>
        <button
          class="btn btn-outline-danger"
          type="button"
          @click="router.push('/accommodation')"
        >
          Back to Accommodation
        </button>
      </div>
    </section>

    <template v-else-if="overview">
      <section class="card portal-card mb-3" aria-label="Agreement progress">
        <div class="card-body p-3 p-lg-4">
          <div class="row row-cols-1 row-cols-lg-3 g-3">
            <div v-for="item in steps" :key="item.number" class="col">
              <button
                class="btn border-0 text-start d-flex align-items-center gap-3 w-100 h-100 p-2"
                :class="{ 'bg-light': step === item.number }"
                type="button"
                :disabled="item.number > furthestAccessibleStep"
                @click="navigateToStep(item.number)"
              >
                <span
                  class="portal-step-indicator"
                  :class="{
                    'is-complete': stepIsComplete(item.number),
                    'is-active':
                      step === item.number && !stepIsComplete(item.number),
                  }"
                >
                  <i
                    v-if="stepIsComplete(item.number)"
                    class="bi bi-check-lg"
                  ></i>
                  <template v-else>{{ item.number }}</template>
                </span>
                <span>
                  <strong class="d-block text-dark">{{ item.title }}</strong>
                  <small class="d-block text-muted">{{
                    item.description
                  }}</small>
                </span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <div class="row g-3 align-items-start">
        <aside class="col-xl-4">
          <section class="card portal-card">
            <div class="card-body p-3 p-lg-4">
              <h2 class="h5 fw-bold text-dark mb-3">
                <i class="bi bi-file-earmark-text text-primary me-2"></i
                >Agreement Summary
              </h2>
              <dl class="row small bg-light rounded-2 p-3 mb-3">
                <dt class="col-5 text-muted fw-normal py-2 border-bottom">
                  Landlord
                </dt>
                <dd class="col-7 text-dark py-2 mb-0 border-bottom">
                  Alebiosu College of Nursing Sciences
                </dd>
                <dt class="col-5 text-muted fw-normal py-2 border-bottom">
                  Tenant
                </dt>
                <dd class="col-7 text-dark py-2 mb-0 border-bottom">
                  <strong class="d-block text-capitalize">{{
                    form.tenantName
                  }}</strong>
                  <span class="text-muted">
                    {{ overview.student.matriculationNumber }}
                  </span>
                </dd>
                <dt class="col-5 text-muted fw-normal py-2 border-bottom">
                  Programme
                </dt>
                <dd class="col-7 text-dark py-2 mb-0 border-bottom">
                  {{ overview.student.program }}
                </dd>
                <dt class="col-5 text-muted fw-normal py-2 border-bottom">
                  Hostel address
                </dt>
                <dd class="col-7 text-dark py-2 mb-0 border-bottom">
                  {{ overview.configuration.hostelAddress }}
                </dd>
                <dt class="col-5 text-muted fw-normal py-2 border-bottom">
                  Room allocation
                </dt>
                <dd class="col-7 text-dark py-2 mb-0 border-bottom">
                  To be assigned after payment
                </dd>
                <dt class="col-5 text-muted fw-normal py-2 border-bottom">
                  Academic session
                </dt>
                <dd class="col-7 text-dark py-2 mb-0 border-bottom">
                  {{ overview.student.session }}
                </dd>
                <dt class="col-5 text-muted fw-normal pt-2">Tenancy period</dt>
                <dd class="col-7 text-dark pt-2 mb-0">
                  {{ formattedStart }} to {{ formattedEnd }}
                </dd>
              </dl>
              <p class="small text-muted">
                This agreement sets out the conditions for your hostel
                accommodation, including resident responsibilities, payment and
                hostel rules.
              </p>
              <button
                class="btn btn-outline-primary w-100 d-flex align-items-center justify-content-between"
                type="button"
                :disabled="step === 1"
                @click="navigateToStep(1)"
              >
                <span>
                  <i class="bi bi-file-earmark-text me-1"></i>View full
                  agreement
                </span>
                <i class="bi bi-chevron-right"></i>
              </button>
              <div class="alert alert-danger d-flex gap-2 mt-3 mb-0">
                <i class="bi bi-info-circle-fill"></i>
                <span>
                  <strong class="d-block small">Not signed</strong>
                  <small class="d-block text-muted">
                    Your tenancy agreement has not been signed.
                  </small>
                </span>
              </div>
            </div>
          </section>
        </aside>

        <div class="col-xl-8">
          <section class="card portal-card">
            <div class="card-body p-3 p-lg-4">
              <template v-if="step === 1">
                <h2 class="h5 fw-bold text-dark mb-3">
                  <i class="bi bi-journal-check text-primary me-2"></i>Tenancy
                  Agreement Terms
                </h2>
                <div
                  class="portal-scroll-panel bg-light border rounded-2 p-3 p-lg-4"
                >
                  <p>
                    This agreement is between the hostel landlord and
                    <strong class="text-capitalize">{{
                      form.tenantName || "the student resident"
                    }}</strong>
                    for one bed space during the
                    {{ overview.student.session }} academic session.
                  </p>
                  <p>
                    The tenancy runs from
                    <strong>{{ formattedStart }}</strong> to
                    <strong>{{ formattedEnd }}</strong> at
                    {{ overview.configuration.hostelAddress }}. Room and bed
                    allocation will be confirmed only after the required
                    accommodation payment is verified.
                  </p>
                  <h3 class="h6 fw-bold text-dark mt-4">Resident conditions</h3>
                  <ol class="ps-4 mb-3">
                    <li
                      v-for="condition in residentConditions"
                      :key="condition"
                      class="mb-2"
                    >
                      {{ condition }}
                    </li>
                  </ol>
                  <p class="mb-0">
                    Signing confirms that the resident has read, understood and
                    agreed to comply with these terms for the stated academic
                    session.
                  </p>
                </div>
                <div class="d-flex justify-content-end mt-3">
                  <button class="btn btn-primary" type="button" @click="next">
                    Continue to Details <i class="bi bi-arrow-right ms-1"></i>
                  </button>
                </div>
              </template>

              <template v-else-if="step === 2">
                <h2 class="h5 fw-bold text-dark mb-3">
                  <i class="bi bi-people text-primary me-2"></i>Student &amp;
                  Guarantor Details
                </h2>

                <fieldset class="mb-4">
                  <legend class="h6 fw-bold text-dark bg-light rounded-2 p-2">
                    Student Information
                  </legend>
                  <div class="row g-3">
                    <div class="col-md-6">
                      <label class="form-label" for="tenant-name">
                        Full Name
                      </label>
                      <input
                        id="tenant-name"
                        v-model.trim="form.tenantName"
                        class="form-control text-capitalize"
                        :class="{ 'is-invalid': errors.tenantName }"
                        readonly
                      />
                      <div class="invalid-feedback">
                        {{ errors.tenantName }}
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="course-of-study">
                        Course of Study
                      </label>
                      <input
                        id="course-of-study"
                        v-model.trim="form.courseOfStudy"
                        class="form-control"
                        :class="{ 'is-invalid': errors.courseOfStudy }"
                        readonly
                      />
                      <div class="invalid-feedback">
                        {{ errors.courseOfStudy }}
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="phone-number">
                        Phone Number
                      </label>
                      <input
                        id="phone-number"
                        v-model.trim="form.phoneNumber"
                        class="form-control"
                        :class="{ 'is-invalid': errors.phoneNumber }"
                      />
                      <div class="invalid-feedback">
                        {{ errors.phoneNumber }}
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="residential-address">
                        Residential Address
                      </label>
                      <input
                        id="residential-address"
                        v-model.trim="form.residentialAddress"
                        class="form-control"
                        :class="{ 'is-invalid': errors.residentialAddress }"
                      />
                      <div class="invalid-feedback">
                        {{ errors.residentialAddress }}
                      </div>
                    </div>
                  </div>
                </fieldset>

                <fieldset class="mb-4">
                  <legend class="h6 fw-bold text-dark bg-light rounded-2 p-2">
                    Parent / Guardian Information
                  </legend>
                  <div class="row g-3">
                    <div class="col-md-6">
                      <label class="form-label" for="parent-name">
                        Parent/Guardian Name
                      </label>
                      <input
                        id="parent-name"
                        v-model.trim="form.parentName"
                        class="form-control"
                        :class="{ 'is-invalid': errors.parentName }"
                        placeholder="Enter full name"
                      />
                      <div class="invalid-feedback">
                        {{ errors.parentName }}
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="parent-phone">
                        Parent/Guardian Phone
                      </label>
                      <input
                        id="parent-phone"
                        v-model.trim="form.parentPhone"
                        class="form-control"
                        :class="{ 'is-invalid': errors.parentPhone }"
                        placeholder="e.g. 0803 123 4567"
                      />
                      <div class="invalid-feedback">
                        {{ errors.parentPhone }}
                      </div>
                    </div>
                  </div>
                </fieldset>

                <fieldset>
                  <legend class="h6 fw-bold text-dark bg-light rounded-2 p-2">
                    Guarantor Information
                  </legend>
                  <div class="row g-3">
                    <div class="col-md-6">
                      <label class="form-label" for="guarantor-name">
                        Guarantor Name
                      </label>
                      <input
                        id="guarantor-name"
                        v-model.trim="form.guarantorName"
                        class="form-control"
                        :class="{ 'is-invalid': errors.guarantorName }"
                        placeholder="Enter full name"
                      />
                      <div class="invalid-feedback">
                        {{ errors.guarantorName }}
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="guarantor-phone">
                        Guarantor Phone
                      </label>
                      <input
                        id="guarantor-phone"
                        v-model.trim="form.guarantorPhone"
                        class="form-control"
                        :class="{ 'is-invalid': errors.guarantorPhone }"
                        placeholder="e.g. 0803 123 4567"
                      />
                      <div class="invalid-feedback">
                        {{ errors.guarantorPhone }}
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="guarantor-occupation">
                        Guarantor Occupation
                      </label>
                      <input
                        id="guarantor-occupation"
                        v-model.trim="form.guarantorOccupation"
                        class="form-control"
                        :class="{ 'is-invalid': errors.guarantorOccupation }"
                        placeholder="e.g. Civil Servant"
                      />
                      <div class="invalid-feedback">
                        {{ errors.guarantorOccupation }}
                      </div>
                    </div>
                    <div class="col-md-6">
                      <label class="form-label" for="guarantor-relationship">
                        Relationship to Student
                      </label>
                      <select
                        id="guarantor-relationship"
                        v-model="form.guarantorRelationship"
                        class="form-select"
                        :class="{ 'is-invalid': errors.guarantorRelationship }"
                      >
                        <option value="">Select relationship</option>
                        <option
                          v-for="item in relationships"
                          :key="item[0]"
                          :value="item[0]"
                        >
                          {{ item[1] }}
                        </option>
                      </select>
                      <div class="invalid-feedback">
                        {{ errors.guarantorRelationship }}
                      </div>
                    </div>
                    <div class="col-12">
                      <label class="form-label" for="guarantor-address">
                        Guarantor Address
                      </label>
                      <textarea
                        id="guarantor-address"
                        v-model.trim="form.guarantorAddress"
                        class="form-control"
                        :class="{ 'is-invalid': errors.guarantorAddress }"
                        rows="3"
                        placeholder="Enter complete address"
                      ></textarea>
                      <div class="invalid-feedback">
                        {{ errors.guarantorAddress }}
                      </div>
                    </div>
                  </div>
                </fieldset>

                <div
                  class="d-flex flex-column-reverse flex-sm-row justify-content-end gap-2 mt-4"
                >
                  <button
                    class="btn btn-secondary"
                    type="button"
                    :disabled="saving"
                    @click="saveDraft"
                  >
                    <i class="bi bi-floppy me-1"></i>
                    {{ saving ? "Saving..." : "Save Draft" }}
                  </button>
                  <button class="btn btn-primary" type="button" @click="next">
                    Review &amp; Sign <i class="bi bi-arrow-right ms-1"></i>
                  </button>
                </div>
              </template>

              <template v-else>
                <h2 class="h5 fw-bold text-dark mb-3">
                  <i class="bi bi-pen text-primary me-2"></i>Review &amp; Sign
                </h2>
                <div class="row row-cols-1 row-cols-md-2 g-0 border rounded-2">
                  <div class="col p-3 border-bottom">
                    <span class="d-block small text-muted">Student</span>
                    <strong class="d-block text-dark text-capitalize">
                      {{ form.tenantName }}
                    </strong>
                    <small class="text-muted">{{ form.courseOfStudy }}</small>
                  </div>
                  <div class="col p-3 border-bottom">
                    <span class="d-block small text-muted"
                      >Parent / Guardian</span
                    >
                    <strong class="d-block text-dark">{{
                      form.parentName
                    }}</strong>
                    <small class="text-muted">{{ form.parentPhone }}</small>
                  </div>
                  <div class="col p-3">
                    <span class="d-block small text-muted">Guarantor</span>
                    <strong class="d-block text-dark">{{
                      form.guarantorName
                    }}</strong>
                    <small class="text-muted">
                      {{
                        relationships.find(
                          (item) => item[0] === form.guarantorRelationship,
                        )?.[1]
                      }}
                      · {{ form.guarantorPhone }}
                    </small>
                  </div>
                  <div class="col p-3">
                    <span class="d-block small text-muted">Tenancy</span>
                    <strong class="d-block text-dark">
                      {{ overview.student.session }}
                    </strong>
                    <small class="text-muted">
                      {{ formattedStart }} to {{ formattedEnd }}
                    </small>
                  </div>
                </div>

                <div class="alert alert-warning d-flex gap-3 my-3">
                  <i class="bi bi-clock fs-5"></i>
                  <span>
                    <strong class="d-block">
                      Accommodation fee payment is the next step
                    </strong>
                    <small class="d-block text-muted">
                      After signing, go to Finance to pay. Your downloadable
                      documents become available after room allocation.
                    </small>
                  </span>
                </div>

                <div class="form-check">
                  <input
                    id="accept-terms"
                    v-model="form.agreeToTerms"
                    class="form-check-input"
                    :class="{ 'is-invalid': errors.agreeToTerms }"
                    type="checkbox"
                  />
                  <label
                    class="form-check-label fw-semibold"
                    for="accept-terms"
                  >
                    I have read and agree to the hostel tenancy terms.
                  </label>
                  <div class="invalid-feedback">{{ errors.agreeToTerms }}</div>
                </div>

                <div
                  class="d-flex flex-column-reverse flex-sm-row justify-content-end gap-2 mt-4"
                >
                  <button
                    class="btn btn-secondary"
                    type="button"
                    :disabled="saving"
                    @click="saveDraft"
                  >
                    <i class="bi bi-floppy me-1"></i>
                    {{ saving ? "Saving..." : "Save Draft" }}
                  </button>
                  <button
                    class="btn btn-primary"
                    type="button"
                    :disabled="submitting"
                    @click="submit"
                  >
                    <i class="bi bi-file-earmark-check me-1"></i>
                    {{ submitting ? "Submitting..." : "Sign & Submit" }}
                  </button>
                </div>
              </template>
            </div>
          </section>
        </div>
      </div>
    </template>
  </main>
</template>

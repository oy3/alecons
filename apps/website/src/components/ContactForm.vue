<script setup>
import { reactive, ref } from "vue";
import { submitContactEnquiry } from "../services/contactService";
import { trackEvent } from "../services/analytics";

const enquiryTypes = [
  { value: "admissions", label: "Admissions enquiry" },
  { value: "programmes", label: "Programme information" },
  { value: "student_services", label: "Student services" },
  { value: "finance", label: "Financial services" },
  { value: "general", label: "General enquiry" },
];
const form = reactive({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  category: "admissions",
  message: "",
  website: "",
});
const submitting = ref(false);
const status = ref(null);
const errors = reactive({});

const validate = () => {
  Object.keys(errors).forEach((key) => delete errors[key]);
  if (!form.firstName.trim()) errors.firstName = "Enter your first name.";
  if (!form.lastName.trim()) errors.lastName = "Enter your last name.";
  if (!/^\S+@\S+\.\S+$/.test(form.email))
    errors.email = "Enter a valid email address.";
  if (!form.category) errors.category = "Select an enquiry type.";
  if (form.message.trim().length < 20)
    errors.message = "Tell us a little more so we can direct your enquiry.";
  return Object.keys(errors).length === 0;
};

const submit = async () => {
  status.value = null;
  if (!validate()) return;
  if (form.website) return;
  submitting.value = true;
  try {
    const result = await submitContactEnquiry({ ...form });
    trackEvent("contact-submit");
    status.value = {
      type: "success",
      message: `Your enquiry has been received. Reference: ${result.reference}. Our team will respond as soon as possible.`,
    };
    Object.assign(form, {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      category: "admissions",
      message: "",
      website: "",
    });
  } catch (error) {
    status.value = { type: "error", message: error.message };
  } finally {
    submitting.value = false;
  }
};
</script>

<template>
  <form class="contact-form" novalidate @submit.prevent="submit">
    <div class="contact-form__row">
      <div class="field">
        <label for="contact-first-name">First name</label
        ><input
          id="contact-first-name"
          v-model="form.firstName"
          autocomplete="given-name"
          :aria-invalid="!!errors.firstName"
          :aria-describedby="errors.firstName ? 'first-name-error' : undefined"
        /><small
          v-if="errors.firstName"
          id="first-name-error"
          class="field-error"
          >{{ errors.firstName }}</small
        >
      </div>
      <div class="field">
        <label for="contact-last-name">Last name</label
        ><input
          id="contact-last-name"
          v-model="form.lastName"
          autocomplete="family-name"
          :aria-invalid="!!errors.lastName"
          :aria-describedby="errors.lastName ? 'last-name-error' : undefined"
        /><small
          v-if="errors.lastName"
          id="last-name-error"
          class="field-error"
          >{{ errors.lastName }}</small
        >
      </div>
    </div>
    <div class="contact-form__row">
      <div class="field">
        <label for="contact-email">Email address</label
        ><input
          id="contact-email"
          v-model="form.email"
          type="email"
          autocomplete="email"
          :aria-invalid="!!errors.email"
          :aria-describedby="errors.email ? 'email-error' : undefined"
        /><small v-if="errors.email" id="email-error" class="field-error">{{
          errors.email
        }}</small>
      </div>
      <div class="field">
        <label for="contact-phone">Phone number <span>(optional)</span></label
        ><input
          id="contact-phone"
          v-model="form.phone"
          type="tel"
          autocomplete="tel"
        />
      </div>
    </div>
    <div class="field">
      <label for="contact-category">Enquiry type</label
      ><select
        id="contact-category"
        v-model="form.category"
        :aria-invalid="!!errors.category"
      >
        <option
          v-for="type in enquiryTypes"
          :key="type.value"
          :value="type.value"
        >
          {{ type.label }}
        </option></select
      ><small v-if="errors.category" class="field-error">{{
        errors.category
      }}</small>
    </div>
    <div class="field">
      <label for="contact-message">How can we help?</label
      ><textarea
        id="contact-message"
        v-model="form.message"
        rows="6"
        :aria-invalid="!!errors.message"
        :aria-describedby="errors.message ? 'message-error' : undefined"
      ></textarea
      ><small v-if="errors.message" id="message-error" class="field-error">{{
        errors.message
      }}</small>
    </div>
    <div class="honeypot" aria-hidden="true">
      <label for="contact-website">Website</label
      ><input
        id="contact-website"
        v-model="form.website"
        tabindex="-1"
        autocomplete="off"
      />
    </div>
    <div
      v-if="status"
      class="form-status"
      :class="`form-status--${status.type}`"
      :role="status.type === 'error' ? 'alert' : 'status'"
    >
      {{ status.message }}
    </div>
    <button class="button button--primary" type="submit" :disabled="submitting">
      <span
        v-if="submitting"
        class="spinner-border spinner-border-sm"
        aria-hidden="true"
      ></span
      >{{ submitting ? "Sending enquiry" : "Send enquiry" }}
    </button>
  </form>
</template>

<style scoped>
.contact-form {
  display: grid;
  gap: 1.25rem;
}
.contact-form__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.25rem;
}
.field {
  display: grid;
  gap: 0.45rem;
}
.field label {
  font-size: 0.8rem;
  font-weight: 650;
}
.field label span {
  color: var(--color-muted);
  font-weight: 400;
}
.field input,
.field select,
.field textarea {
  width: 100%;
  min-height: 3rem;
  padding: 0.7rem 0.85rem;
  border: 1px solid var(--color-border);
  border-radius: 0.35rem;
  background: #fff;
  color: var(--color-ink);
}
.field textarea {
  resize: vertical;
}
.field input:focus,
.field select:focus,
.field textarea:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(201, 35, 43, 0.1);
  outline: 0;
}
.field [aria-invalid="true"] {
  border-color: var(--color-error);
}
.field-error {
  color: var(--color-error);
}
.honeypot {
  position: absolute;
  left: -10000px;
}
.form-status {
  padding: 1rem;
  border-radius: 0.35rem;
  font-size: 0.86rem;
}
.form-status--success {
  background: #e8f5ed;
  color: var(--color-success);
}
.form-status--info {
  background: #fff4df;
  color: var(--color-warning);
}
.form-status--error {
  background: #fbe9ea;
  color: var(--color-error);
}
.contact-form .button {
  justify-self: start;
  min-width: 10rem;
}
.contact-form .button:disabled {
  opacity: 0.65;
  transform: none;
}
@media (max-width: 575.98px) {
  .contact-form__row {
    grid-template-columns: 1fr;
  }
  .contact-form .button {
    width: 100%;
  }
}
</style>

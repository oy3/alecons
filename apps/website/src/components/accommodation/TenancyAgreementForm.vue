<script setup>
import { computed, reactive } from 'vue';
import { accommodationTerms } from '../../data/accommodationTerms';

const props = defineProps({ application: { type: Object, required: true }, config: { type: Object, required: true }, loading: Boolean });
const emit = defineEmits(['submit']);
const form = reactive({
  parentName: '', parentPhone: '', guarantorName: '', guarantorPhone: '',
  guarantorAddress: '', guarantorOccupation: '', guarantorRelationship: '', agreedToTerms: false,
});
const user = computed(() => props.application?.userId || {});
const resident = computed(() => props.application?.externalResidentId || {});
const tenantName = computed(() => [user.value.firstName, user.value.otherName, user.value.lastName].filter(Boolean).join(' '));
const categoryLabel = computed(() => props.config.categories?.find((item) => item.code === resident.value.category)?.label || resident.value.category || 'External resident');

function submit() { emit('submit', { ...form }); }
</script>

<template>
  <form class="agreement-form" @submit.prevent="submit">
    <div class="agreement-heading">
      <p class="eyebrow">Tenancy agreement</p>
      <h2>Review and sign your agreement</h2>
      <p>This agreement is between <strong>Mr Olusegun, trading as ACAS Hostel</strong>, and <strong>{{ tenantName }}</strong> for one bed space.</p>
    </div>

    <section aria-labelledby="resident-information">
      <h3 id="resident-information">Resident information</h3>
      <div class="field-grid">
        <div><label for="agreement-name">Full name</label><input id="agreement-name" :value="tenantName" class="form-control" readonly /></div>
        <div><label for="agreement-category">Category</label><input id="agreement-category" :value="categoryLabel" class="form-control" readonly /></div>
        <div><label for="agreement-phone">Phone</label><input id="agreement-phone" :value="user.phone" class="form-control" readonly /></div>
        <div><label for="agreement-address">Residential address</label><input id="agreement-address" :value="resident.homeAddress" class="form-control" readonly /></div>
      </div>
    </section>

    <section aria-labelledby="agreement-period">
      <h3 id="agreement-period">Hostel and tenancy period</h3>
      <div class="field-grid">
        <div class="field-wide"><label for="hostel-address">Hostel address</label><input id="hostel-address" :value="config.agreement?.hostelAddress" class="form-control" readonly /></div>
        <div><label for="tenancy-start">Start date</label><input id="tenancy-start" :value="config.agreement?.tenancyStartDate" class="form-control" readonly /></div>
        <div><label for="tenancy-end">End date</label><input id="tenancy-end" :value="config.agreement?.tenancyEndDate" class="form-control" readonly /></div>
      </div>
    </section>

    <section aria-labelledby="parent-information">
      <h3 id="parent-information">Parent or guardian</h3>
      <div class="field-grid">
        <div><label for="parent-name">Full name</label><input id="parent-name" v-model.trim="form.parentName" class="form-control" maxlength="150" required /></div>
        <div><label for="parent-phone">Phone</label><input id="parent-phone" v-model.trim="form.parentPhone" class="form-control" maxlength="30" required /></div>
      </div>
    </section>

    <section aria-labelledby="guarantor-information">
      <h3 id="guarantor-information">Guarantor information</h3>
      <div class="field-grid">
        <div><label for="guarantor-name">Full name</label><input id="guarantor-name" v-model.trim="form.guarantorName" class="form-control" maxlength="150" required /></div>
        <div><label for="guarantor-phone">Phone</label><input id="guarantor-phone" v-model.trim="form.guarantorPhone" class="form-control" maxlength="30" required /></div>
        <div><label for="guarantor-occupation">Occupation</label><input id="guarantor-occupation" v-model.trim="form.guarantorOccupation" class="form-control" maxlength="120" required /></div>
        <div><label for="guarantor-relationship">Relationship</label><select id="guarantor-relationship" v-model="form.guarantorRelationship" class="form-select" required><option value="" disabled>Select relationship</option><option value="father">Father</option><option value="mother">Mother</option><option value="uncle">Uncle</option><option value="aunt">Aunt</option><option value="brother">Brother</option><option value="sister">Sister</option><option value="grandfather">Grandfather</option><option value="grandmother">Grandmother</option><option value="other_blood_relative">Other blood relative</option></select></div>
        <div class="field-wide"><label for="guarantor-address">Address</label><textarea id="guarantor-address" v-model.trim="form.guarantorAddress" class="form-control" maxlength="500" rows="3" required></textarea></div>
      </div>
    </section>

    <section aria-labelledby="agreement-conditions">
      <h3 id="agreement-conditions">Terms and conditions</h3>
      <div class="terms" tabindex="0" aria-label="Tenancy agreement terms and conditions">
        <p><strong>The applicable accommodation fee must be paid in full before a bed space is allocated. Signing does not constitute proof of payment or allocation.</strong></p>
        <ol><li v-for="term in accommodationTerms" :key="term">{{ term }}</li></ol>
      </div>
      <label class="form-check agreement-consent">
        <input v-model="form.agreedToTerms" class="form-check-input" type="checkbox" required />
        <span class="form-check-label">I have read, understood, and agree to all tenancy terms. I understand this checkbox is my electronic signature.</span>
      </label>
    </section>

    <button class="btn btn-primary" :disabled="loading || !form.agreedToTerms">
      <span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>Sign agreement and continue
    </button>
  </form>
</template>

<style scoped>
.agreement-form section { margin-top:2.25rem; padding-top:1.5rem; border-top:1px solid var(--color-border); }
.agreement-form h3 { font-size:1.15rem; margin-bottom:1rem; }
.field-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:1.1rem; }
.field-wide { grid-column:1/-1; }
label:not(.form-check) { display:block; font-weight:600; margin-bottom:.45rem; }
.form-control[readonly] { background:var(--color-surface-muted, #f5f6f7); }
.terms { max-height:22rem; overflow-y:auto; padding:1.25rem 1.4rem; border:1px solid var(--color-border); background:#fff; line-height:1.65; }
.terms:focus { outline:3px solid color-mix(in srgb, var(--color-primary) 24%, transparent); outline-offset:2px; }
.terms ol { margin:1rem 0 0; padding-left:1.3rem; }
.terms li + li { margin-top:.65rem; }
.agreement-consent { margin:1.25rem 0 1.5rem; }
@media (max-width:767px) { .field-grid { grid-template-columns:1fr; } .field-wide { grid-column:auto; } }
</style>

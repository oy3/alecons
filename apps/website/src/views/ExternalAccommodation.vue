<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PageHero from '../components/PageHero.vue';
import TenancyAgreementForm from '../components/accommodation/TenancyAgreementForm.vue';
import { publicApiService } from '../services/publicApi';

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const error = ref('');
const message = ref('');
const application = ref(null);
const resumeToken = ref(typeof window !== 'undefined' ? (localStorage.getItem('aleconsAccommodationResumeToken') || '') : '');
const profile = ref(null);
const receipt = ref(null);
const paymentOptions = ref(null);
const verificationSentTo = ref(typeof window !== 'undefined' ? (sessionStorage.getItem('aleconsAccommodationVerificationSentTo') || '') : '');
const accommodationConfig = ref({ applicationsOpen: false, categories: [{ code: 'pre_degree', label: 'Pre-degree', isDefault: true }] });
const start = reactive({ email: '', firstName: '', otherName: '', lastName: '', phone: '' });
const details = reactive({ category: 'pre_degree', gender: '', dob: '', homeAddress: '' });
const stage = computed(() => {
  if (!resumeToken.value) return verificationSentTo.value ? 'email_sent' : 'start';
  if (!application.value?.externalResidentId) return 'details';
  if (application.value?.status === 'awaiting_agreement') return 'agreement';
  if (application.value?.status === 'allocated') return 'allocated';
  if (application.value?.status === 'paid_awaiting_allocation') return 'waiting';
  if (application.value?.status === 'payment_pending_review') return 'review';
  if (application.value?.status === 'awaiting_payment') return 'payment';
  if (['cancelled', 'expired'].includes(application.value?.status)) return 'closed';
  return 'closed';
});
const maskedVerificationEmail = computed(() => {
  const [name = '', domain = ''] = verificationSentTo.value.split('@');
  if (!domain) return verificationSentTo.value;
  return `${name.slice(0, 1)}${'*'.repeat(Math.max(2, Math.min(name.length - 1, 5)))}@${domain}`;
});

async function withRequest(action) {
  loading.value = true; error.value = ''; message.value = '';
  try { await action(); } catch (err) { error.value = err.message || 'Something went wrong'; }
  finally { loading.value = false; }
}

function storeResumeToken(value) {
  resumeToken.value = value;
  localStorage.setItem('aleconsAccommodationResumeToken', value);
}

function restartApplication() {
  resumeToken.value = '';
  application.value = null;
  paymentOptions.value = null;
  localStorage.removeItem('aleconsAccommodationResumeToken');
  verificationSentTo.value = '';
  sessionStorage.removeItem('aleconsAccommodationVerificationSentTo');
}

async function loadApplication() {
  if (!resumeToken.value) return;
  try {
    application.value = await publicApiService.resumeExternalAccommodation(resumeToken.value);
  } catch (requestError) {
    if (/invalid or has expired/i.test(requestError.message || '')) restartApplication();
    throw requestError;
  }
  if (application.value?.status === 'awaiting_payment') {
    paymentOptions.value = await publicApiService.getExternalAccommodationPaymentOptions(resumeToken.value);
  }
}

async function submitStart() {
  await withRequest(async () => {
    await publicApiService.startExternalAccommodation(start);
    verificationSentTo.value = start.email.trim().toLowerCase();
    sessionStorage.setItem('aleconsAccommodationVerificationSentTo', verificationSentTo.value);
    message.value = '';
  });
}

async function submitDetails() {
  await withRequest(async () => {
    const form = new FormData();
    Object.entries(details).forEach(([key, value]) => form.append(key, String(value)));
    if (profile.value) form.append('profile', profile.value);
    application.value = await publicApiService.completeExternalAccommodation(resumeToken.value, form);
  });
}

async function submitAgreement(payload) {
  await withRequest(async () => {
    application.value = await publicApiService.signExternalAccommodationAgreement(resumeToken.value, payload);
    paymentOptions.value = await publicApiService.getExternalAccommodationPaymentOptions(resumeToken.value);
    message.value = 'Your tenancy agreement has been signed. You may now complete payment.';
  });
}

async function pay() {
  await withRequest(async () => {
    const result = await publicApiService.initializeExternalAccommodationPayment(resumeToken.value);
    window.location.assign(result.authorization_url);
  });
}

async function submitReceipt() {
  if (!receipt.value) return;
  await withRequest(async () => {
    await publicApiService.submitExternalAccommodationManualTransfer(resumeToken.value, receipt.value);
    application.value = await publicApiService.resumeExternalAccommodation(resumeToken.value);
    message.value = 'Your transfer receipt has been submitted for verification.';
  });
}

async function downloadDocument(documentType) {
  await withRequest(async () => {
    const blob = await publicApiService.downloadExternalAccommodationDocument(resumeToken.value, documentType);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${documentType}-${application.value.applicationNumber}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
}

onMounted(() => withRequest(async () => {
  accommodationConfig.value = await publicApiService.getExternalAccommodationConfig();
  const configuredDefault = accommodationConfig.value.categories?.find((category) => category.isDefault)
    || accommodationConfig.value.categories?.[0];
  if (configuredDefault) details.category = configuredDefault.code;
  if (route.query.verificationToken) {
    const result = await publicApiService.verifyExternalAccommodation(String(route.query.verificationToken));
    storeResumeToken(result.resumeToken);
    application.value = result.application;
    verificationSentTo.value = '';
    sessionStorage.removeItem('aleconsAccommodationVerificationSentTo');
    await router.replace({ path: route.path });
    return;
  }
  if (route.query.resumeToken) {
    storeResumeToken(String(route.query.resumeToken));
    await router.replace({ path: route.path });
    await loadApplication();
    return;
  }
  if (route.query.paymentReference && resumeToken.value) {
    application.value = await publicApiService.verifyExternalAccommodationPayment(resumeToken.value, String(route.query.paymentReference));
    await router.replace({ path: route.path });
    return;
  }
  await loadApplication();
}));
</script>

<template>
  <PageHero eyebrow="Accommodation" title="External resident accommodation" description="A secure application and payment process for pre-degree residents." :breadcrumbs="[{ label: 'External accommodation' }]" />
  <section class="section accommodation-page">
    <div class="site-container accommodation-layout">
      <aside class="accommodation-steps" aria-label="Application progress">
        <p class="eyebrow">Application process</p>
        <ol>
          <li :class="{ active: ['start', 'email_sent'].includes(stage) }">Verify email</li>
          <li :class="{ active: stage === 'details' }">Resident details</li>
          <li :class="{ active: stage === 'agreement' }">Agreement</li>
          <li :class="{ active: ['payment', 'review'].includes(stage) }">Payment</li>
          <li :class="{ active: ['waiting', 'allocated'].includes(stage) }">Allocation</li>
        </ol>
      </aside>

      <div class="accommodation-form">
        <div v-if="error" class="alert alert-danger" role="alert">{{ error }}</div>
        <div v-if="message" class="alert alert-success" role="status">{{ message }}</div>
        <button v-if="resumeToken || stage === 'email_sent'" type="button" class="btn btn-link px-0 mb-3" @click="restartApplication"><i class="bi bi-arrow-left me-1"></i>Start a different application</button>

        <div v-if="stage === 'email_sent'" class="email-sent" role="status">
          <span class="email-sent-icon" aria-hidden="true"><i class="bi bi-envelope-check"></i></span>
          <p class="eyebrow">Verification link sent</p>
          <h2>Check your email</h2>
          <p>We sent a secure link to <strong>{{ maskedVerificationEmail }}</strong>. Open it to verify your email and continue your accommodation application.</p>
          <p class="email-note">The link expires in 30 minutes. Check your spam or junk folder if it does not appear in your inbox.</p>
        </div>

        <form v-else-if="stage === 'start'" @submit.prevent="submitStart">
          <h2>Start your application</h2>
          <p>We will send you a secure link so you can verify your email address and resume.</p>
          <div v-if="!accommodationConfig.applicationsOpen" class="alert alert-info">External accommodation applications are currently closed.</div>
          <div class="field-grid">
            <div><label for="firstName">First name</label><input id="firstName" v-model.trim="start.firstName" class="form-control" required /></div>
            <div><label for="otherName">Other name</label><input id="otherName" v-model.trim="start.otherName" class="form-control" /></div>
            <div><label for="lastName">Last name</label><input id="lastName" v-model.trim="start.lastName" class="form-control" required /></div>
            <div><label for="phone">Phone</label><input id="phone" v-model.trim="start.phone" class="form-control" required /></div>
            <div class="field-wide"><label for="email">Email address</label><input id="email" v-model.trim="start.email" type="email" class="form-control" required /></div>
          </div>
          <button class="btn btn-primary mt-4" :disabled="loading || !accommodationConfig.applicationsOpen"><span v-if="loading" class="spinner-border spinner-border-sm me-2"></span>Send verification link</button>
        </form>

        <form v-else-if="stage === 'details'" @submit.prevent="submitDetails">
          <h2>Resident details</h2>
          <div class="field-grid">
            <div><label for="category">Category</label><select id="category" v-model="details.category" class="form-select" required><option v-for="category in accommodationConfig.categories" :key="category.code" :value="category.code">{{ category.label }}</option></select></div>
            <div><label for="gender">Hostel</label><select id="gender" v-model="details.gender" class="form-select" required><option value="" disabled>Select hostel gender</option><option value="female">Female</option><option value="male">Male</option></select></div>
            <div><label for="dob">Date of birth</label><input id="dob" v-model="details.dob" type="date" :max="new Date().toISOString().slice(0, 10)" class="form-control" required /></div>
            <div><label for="profile">Profile photograph</label><input id="profile" type="file" accept="image/jpeg,image/png,image/webp" class="form-control" required @change="profile = $event.target.files?.[0] || null" /></div>
            <div class="field-wide"><label for="homeAddress">Home address</label><textarea id="homeAddress" v-model.trim="details.homeAddress" class="form-control" rows="4" required></textarea></div>
          </div>
          <button class="btn btn-primary mt-4" :disabled="loading">Continue to tenancy agreement</button>
        </form>

        <TenancyAgreementForm v-else-if="stage === 'agreement'" :application="application" :config="accommodationConfig" :loading="loading" @submit="submitAgreement" />

        <div v-else-if="stage === 'payment'">
          <h2>Complete accommodation payment</h2>
          <p>Your application <strong>{{ application?.applicationNumber }}</strong> is ready. The fee is <strong v-if="paymentOptions">₦{{ Number(paymentOptions.payment?.amount || 0).toLocaleString() }}</strong>.</p>
          <button v-if="paymentOptions?.paystackEnabled" class="btn btn-primary" :disabled="loading" @click="pay"><i class="bi bi-credit-card me-2"></i>Pay securely</button>
          <div v-if="paymentOptions?.manualTransfer?.enabled" class="manual-transfer mt-4">
            <h3>Manual bank transfer</h3>
            <dl><div><dt>Bank</dt><dd>{{ paymentOptions.manualTransfer.bankName }}</dd></div><div><dt>Account number</dt><dd>{{ paymentOptions.manualTransfer.accountNumber }}</dd></div><div><dt>Account name</dt><dd>{{ paymentOptions.manualTransfer.accountName }}</dd></div></dl>
            <label for="receipt">Upload transfer receipt</label><input id="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" class="form-control" @change="receipt = $event.target.files?.[0] || null">
            <button class="btn btn-outline-primary mt-3" :disabled="!receipt || loading" @click="submitReceipt">Submit receipt</button>
          </div>
        </div>
        <div v-else-if="stage === 'review'"><h2>Receipt under review</h2><p>Your transfer receipt has been received. Allocation starts after a staff member verifies the payment.</p></div>
        <div v-else-if="stage === 'waiting'">
          <h2>Payment received</h2><p>No matching bed space is currently available. Your application is safely queued for staff allocation.</p>
        </div>
        <div v-else-if="stage === 'allocated'">
          <h2>Accommodation allocated</h2>
          <p>Your bed space has been allocated. Keep your application number <strong>{{ application?.applicationNumber }}</strong> for check-in.</p>
          <dl v-if="application?.assignment" class="allocation-record">
            <div><dt>Hostel</dt><dd>{{ application.assignment.hostelId?.name }}</dd></div>
            <div><dt>Block</dt><dd>{{ application.assignment.blockId?.name }}</dd></div>
            <div><dt>Room</dt><dd>{{ application.assignment.roomId?.name }}</dd></div>
            <div><dt>Bed slot</dt><dd>{{ application.assignment.slotNumber }}</dd></div>
          </dl>
          <div v-if="application?.documentsReady" class="document-actions">
            <button type="button" class="btn btn-primary" :disabled="loading" @click="downloadDocument('allocation-slip')"><i class="bi bi-file-earmark-arrow-down me-2"></i>Download allocation slip</button>
            <button type="button" class="btn btn-outline-primary" :disabled="loading" @click="downloadDocument('tenancy-agreement')"><i class="bi bi-file-earmark-text me-2"></i>Download tenancy agreement</button>
          </div>
          <div v-else class="alert alert-info mt-4" role="status">Your allocation documents are being prepared. Refresh this page shortly if they do not appear.</div>
        </div>
        <div v-else><h2>Application unavailable</h2><p>This accommodation application is no longer active. Contact the college if you need assistance.</p></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.accommodation-layout { display:grid; grid-template-columns:minmax(190px, .35fr) minmax(0, 1fr); gap:clamp(2rem, 6vw, 6rem); align-items:start; }
.accommodation-steps { border-top:3px solid var(--color-primary); padding-top:1.25rem; }
.accommodation-steps ol { list-style:none; padding:0; margin:1rem 0 0; counter-reset:step; }
.accommodation-steps li { counter-increment:step; display:flex; gap:.75rem; align-items:center; padding:.65rem 0; color:var(--color-text-muted); }
.accommodation-steps li::before { content:counter(step); width:2rem; height:2rem; border:1px solid var(--color-border); display:grid; place-items:center; border-radius:50%; }
.accommodation-steps li.active { color:var(--color-primary); font-weight:600; }
.accommodation-form { max-width:780px; }
.accommodation-form h2 { font-family:var(--font-display); font-size:clamp(2rem, 4vw, 3rem); margin-bottom:.75rem; }
.field-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:1.25rem; margin-top:2rem; }
.field-wide { grid-column:1 / -1; }
.manual-transfer { border-top:1px solid var(--color-border); padding-top:1.5rem; }.manual-transfer h3{font-size:1.15rem}.manual-transfer dl{display:grid;grid-template-columns:repeat(3,1fr);gap:1rem}.manual-transfer dt{font-size:.8rem;color:var(--color-text-muted)}.manual-transfer dd{font-weight:600;margin:0}
.allocation-record{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1rem;margin-top:2rem;padding:1.25rem 0;border-block:1px solid var(--color-border)}.allocation-record dt{color:var(--color-text-muted);font-size:.85rem}.allocation-record dd{font-weight:700;margin:0}
.document-actions { display:flex; flex-wrap:wrap; gap:.75rem; margin-top:1.5rem; }
.email-sent { max-width:640px; padding:2rem 0; }
.email-sent-icon { width:3.5rem; height:3.5rem; display:grid; place-items:center; margin-bottom:1.5rem; border-radius:50%; background:#e8f5ee; color:#157347; font-size:1.5rem; }
.email-note { margin-top:1.25rem; padding-top:1.25rem; border-top:1px solid var(--color-border); color:var(--color-text-muted); font-size:.95rem; }
label:not(.form-check) { display:block; font-weight:600; margin-bottom:.45rem; }
@media (max-width:767px) { .accommodation-layout,.field-grid,.allocation-record { grid-template-columns:1fr; } .field-wide { grid-column:auto; } }
@media print { :global(.site-header),:global(.site-footer),.accommodation-steps,.btn { display:none!important; }.accommodation-layout{display:block}.accommodation-form{max-width:none} }
</style>

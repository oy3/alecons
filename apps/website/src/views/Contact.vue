<script setup>
import PageHero from "../components/PageHero.vue";
import SectionHeading from "../components/SectionHeading.vue";
import ContactForm from "../components/ContactForm.vue";
import { departments, site } from "../data/site";
</script>
<template>
  <PageHero
    eyebrow="Contact"
    title="Get in touch with ALECONS"
    description="Our offices are open through the week for enquiries about admissions, academics and student services."
    :breadcrumbs="[{ label: 'Contact' }]"
  />
  <section class="section">
    <div class="site-container contact-summary">
      <article>
        <h2>Campus address</h2>
        <div class="d-flex align-items-start gap-2">
          <i class="bi bi-geo-alt" aria-hidden="true"></i>
          <p>{{ site.address }}</p>
        </div>
      </article>
      <article>
        <h2>Phone & email</h2>
        <p>
          <a
            v-for="phone in site.phones"
            :key="phone"
            :href="`tel:${phone.replace(/\s/g, '')}`"
          >
            <i class="bi bi-telephone me-2" aria-hidden="true"></i> {{ phone }}
          </a>
          <a :href="`mailto:${site.email}`">
            <i class="bi bi-envelope me-2" aria-hidden="true"></i>
            {{ site.email }}
          </a>
        </p>
      </article>
      <article>
        <h2>Office hours</h2>
        <p>
          <span v-for="hours in site.officeHours" :key="hours">
                    <i class="bi bi-clock me-2" aria-hidden="true"></i>  {{ hours }}
          </span>
        </p>
      </article>
    </div>
  </section>
  <section class="section section--subtle">
    <div class="site-container enquiry-grid">
      <div>
        <SectionHeading
          eyebrow="Send an enquiry"
          title="How can we help?"
          description="Complete the form and our team will direct your message to the right office."
        />
        <div class="direct-contact">
          <p>Need a quicker response?</p>
          <a :href="`mailto:${site.admissionsEmail}`">
            <i class="bi bi-envelope" aria-hidden="true"> </i>
            {{ site.admissionsEmail }}
          </a>
          <a :href="`tel:${site.phones[1].replace(/\s/g, '')}`">
            <i class="bi bi-telephone" aria-hidden="true"></i>
            {{ site.phones[1] }}
          </a>
        </div>
      </div>
      <div class="contact-form-shell"><ContactForm /></div>
    </div>
  </section>
  <section class="section">
    <div class="site-container">
      <SectionHeading
        eyebrow="Departments"
        title="Reach the right office"
        description="Direct your enquiry to the office that can answer it fastest."
      />
      <div class="department-grid">
        <article
          v-for="department in departments"
          :key="department.name"
          class="info-card"
        >
          <h3>{{ department.name }}</h3>
          <dl>
            <div>
              <dt>Contact person</dt>
              <dd>{{ department.person }}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{{ department.phone }}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                <a :href="`mailto:${department.email}`">{{
                  department.email
                }}</a>
              </dd>
            </div>
            <div>
              <dt>Hours</dt>
              <dd>{{ site.officeHours[0] }}</dd>
            </div>
          </dl>
        </article>
      </div>
    </div>
  </section>
  <section class="section section--subtle">
    <div class="site-container">
      <SectionHeading
        eyebrow="Getting here"
        title="Finding the campus"
        description="ALECONS sits along the Iyamoye-Abuja Road in Omuoke, Ekiti State."
      />
      <div class="travel-grid">
        <article>
          <i class="bi bi-car-front" aria-hidden="true"></i>
          <h3>By car</h3>
          <p>
            Take the Lagos-Ado-Ekiti Expressway, then follow signs to Omuoke.
            The campus is well signposted from the main road.
          </p>
        </article>
        <article>
          <i class="bi bi-bus-front" aria-hidden="true"></i>
          <h3>By bus</h3>
          <p>
            Regular bus services run from major cities. Alight at Omuoke motor
            park, then take local transport to the campus.
          </p>
        </article>
        <article>
          <i class="bi bi-airplane" aria-hidden="true"></i>
          <h3>By air</h3>
          <p>
            Fly to Ado Airport, then travel by road to Omuoke. Alternatively,
            fly to Lagos and continue by road.
          </p>
        </article>
      </div>
    </div>
  </section>
</template>
<style scoped>
.contact-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3rem;
}
.contact-summary article i {
  color: var(--color-primary);
  font-size: 1rem;
}
.contact-summary h2 {
  margin: 1rem 0 0.6rem;
  font-size: 1.35rem;
}
.contact-summary p,
.contact-summary p a,
.contact-summary p span {
  display: block;
  color: var(--color-muted);
  text-decoration: none;
}
.enquiry-grid {
  display: grid;
  grid-template-columns: 0.75fr 1.25fr;
  gap: 6rem;
}
.direct-contact {
  display: grid;
  gap: 0.4rem;
}
.direct-contact p {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 650;
}
.direct-contact a {
  display: flex;
  gap: 0.6rem;
  color: var(--color-primary);
  font-size: 0.86rem;
  text-decoration: none;
}
.contact-form-shell {
  padding: 2rem;
  background: #fff;
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}
.department-grid,
.travel-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.25rem;
}
.department-grid article {
  padding: 1.5rem;
}
.department-grid dl {
  font-size: 0.8rem;
}
.department-grid dl div {
  padding: 0.55rem 0;
  border-bottom: 1px solid var(--color-border);
}
.department-grid dt {
  color: var(--color-muted);
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
}
.department-grid dd {
  margin: 0.2rem 0 0;
}
.department-grid a {
  color: var(--color-primary);
}
.travel-grid article {
  padding-top: 1.5rem;
  border-top: 1px solid var(--color-border);
}
.travel-grid i {
  color: var(--color-primary);
  font-size: 1.4rem;
}
.travel-grid h3 {
  margin: 1rem 0 0.5rem;
}
.travel-grid p {
  font-size: 0.86rem;
}
@media (max-width: 767.98px) {
  .contact-summary,
  .enquiry-grid,
  .department-grid,
  .travel-grid {
    grid-template-columns: 1fr;
    gap: 2.5rem;
  }
  .contact-form-shell {
    padding: 1.25rem;
  }
}
</style>

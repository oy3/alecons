<script setup>
defineProps({ member: { type: Object, required: true } });

const initials = (name) =>
  name
    .split(" ")
    .filter((part) => !part.endsWith("."))
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
</script>

<template>
  <article class="faculty-card h-100">
    <img
      v-if="member.image"
      :src="member.image"
      :alt="`${member.name}, ${member.role}`"
      width="480"
      height="320"
      loading="lazy"
    />
    <div v-else class="faculty-card__placeholder" aria-hidden="true">
      {{ initials(member.name) }}
    </div>
    <div class="faculty-card__body">
      <h3>{{ member.name }}</h3>
      <p class="faculty-card__role">{{ member.role }}</p>
      <dl>
        <div>
          <dt>Department</dt>
          <dd>{{ member.department }}</dd>
        </div>
        <div v-if="member.specialization">
          <dt>Specialisation</dt>
          <dd>{{ member.specialization }}</dd>
        </div>
        <div>
          <dt>Experience</dt>
          <dd>{{ member.experience }}</dd>
        </div>
      </dl>
      <p>{{ member.bio }}</p>
      <a :href="`mailto:${member.email}`" class="faculty-card__contact"
        ><i class="bi bi-envelope" aria-hidden="true"></i>{{ member.email }}</a
      >
      <a
        v-if="member.phone"
        :href="`tel:${member.phone.replace(/\s/g, '')}`"
        class="faculty-card__contact"
        ><i class="bi bi-telephone" aria-hidden="true"></i>{{ member.phone }}</a
      >
    </div>
  </article>
</template>

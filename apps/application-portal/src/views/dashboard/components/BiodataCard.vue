<script>
export default {
  name: "BiodataCard",
  props: {
    profileImage: String,
    name: String,
    appNo: String,
    email: String,
    phone: String,
    gender: String,
    location: String
  }
};
</script>


<template>
  <div class="card shadow border-0 px-0 py-3">
    <div class="card-body text-center">
      <img :src="profileImage" class="rounded-circle mb-3" width="100" height="100" />
      <h5 class="card-title fw-bold mb-1">{{ name }}</h5>
      <p class="text-muted mb-3">Application No: {{ appNo }}</p>
      <ul class="list-group list-group-flush text-start">
        <li class="list-group-item"><i class="bi bi-envelope me-2 acon-text-primary"></i> {{ email }}</li>
        <li class="list-group-item"><i class="bi bi-telephone me-2 acon-text-primary"></i> {{ phone }}</li>
        <li class="list-group-item"><i class="bi bi-person me-2 acon-text-primary"></i> {{ gender }}</li>
        <li class="list-group-item"><i class="bi bi-geo-alt me-2 acon-text-primary"></i> {{ location }}</li>
      </ul>
    </div>
  </div>
</template>
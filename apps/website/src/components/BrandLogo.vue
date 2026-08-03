<script setup>
import logo from "../assets/img/logo-256.png";

defineProps({ compact: Boolean, inverse: Boolean });
</script>

<template>
  <span
    class="brand"
    :class="{ 'brand--compact': compact, 'brand--inverse': inverse }"
  >
    <img :src="logo" width="52" height="52" alt="" />
    <span class="brand__copy">
      <strong class="text-uppercase">Alebiosu College</strong>
      <span class="text-uppercase">of Nursing Sciences</span>
    </span>
  </span>
</template>

<style scoped>
.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  color: var(--color-ink);
}
.brand img {
  width: 3.25rem;
  height: 3.25rem;
  object-fit: contain;
}
.brand__copy {
  display: grid;
  line-height: 1.08;
}
.brand__copy strong {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 600;
}
.brand__copy span {
  margin-top: 0.3rem;
  color: var(--color-primary);
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.26em;
  text-transform: uppercase;
}
.brand--inverse {
  color: #fff;
}
.brand--inverse .brand__copy span {
  color: var(--color-primary-soft);
}
.brand--compact img {
  width: 2.75rem;
  height: 2.75rem;
}
@media (max-width: 420px) {
  .brand__copy strong {
    font-size: 1rem;
  }
  .brand__copy span {
    font-size: 0.58rem;
  }
}
</style>

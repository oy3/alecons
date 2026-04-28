<script>
export default {
  name: "TodoItem",
  props: { item: Object },
};
</script>

<template>
  <div
    class="card flex-shrink-0 border-0 p-0"
    style="min-width: 220px; max-width: 220px"
    :class="{
      'completed-stage': item.status === 'completed',
      'active-stage text-primary-emphasis bg-primary-subtle shadow-sm':
        item.status === 'active',
      'inactive-stage text-muted': item.status === 'inactive',
      'payment-stage': item.paymentStage && item.status === 'active',
    }"
  >
    <div class="card-body">
      <!-- <h6 class="card-title mb-0" :class="{
          'text-decoration-line-through text-muted':
            item.status === 'completed',
        }">
          {{ item.title }}
        </h6> -->
      <div class="d-flex justify-content-between align-items-start mb-2">
        <h6
          class="card-title mb-0"
          :class="{
            'text-decoration-line-through text-muted':
              item.status === 'completed',
          }"
        >
          {{ item.title }}
        </h6>

        <div class="ms-2">
          <i
            v-if="item.status === 'completed'"
            class="bi bi-check-circle-fill text-success"
          ></i>
          <i
            v-else-if="item.status === 'active' && item.paymentStage"
            class="bi bi-credit-card text-primary-emphasis"
          ></i>
          <i
            v-else-if="item.status === 'active'"
            class="bi bi-play-circle-fill text-primary"
          ></i>
          <i v-else class="bi bi-circle text-muted"></i>
        </div>
      </div>

      <p
        class="card-text small mb-0"
        :class="{
          'text-decoration-line-through text-muted':
            item.status === 'completed',
        }"
      >
        {{ item.description }}
      </p>

      <!-- Stage indicator -->
      <!-- <div class="mt-2">
        <small class="badge bg-light text-dark">Stage {{ item.stage }}</small>
      </div> -->
    </div>
  </div>
</template>

<style scoped>
/* completed */
.completed-stage {
  background-color: #f8f9fa;
  /* Bootstrap light bg */
  opacity: 0.6;
  cursor: not-allowed;
}

/* active */
.active-stage {
  /* border-left: 4px solid #0d6efd; */
  background-color: rgba(13, 110, 253, 0.05);
}

/* Payment stage highlighting */
.payment-stage {
  /* border-left: 4px solid #ffc107; */
  background-color: rgba(255, 193, 7, 0.1);
}

/* inactive */
.inactive-stage {
  background-color: #e9ecef;
  cursor: pointer;
  transition: background-color 0.2s ease-in-out;
}

.inactive-stage:hover {
  background-color: #dee2e6;
}
</style>

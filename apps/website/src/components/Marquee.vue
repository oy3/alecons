<script lang="js">
export default {
  props: {
    announcement: {
      type: String,
      required: true,
    },
  },
  mounted() {
    const track = this.$refs.track;
    const item = track.children[0];

    // Clone until width exceeds container
    const containerWidth = track.parentElement.offsetWidth;
    let totalWidth = track.scrollWidth;

    while (totalWidth < containerWidth * 2) {
      const clone = item.cloneNode(true);
      track.appendChild(clone);
      totalWidth = track.scrollWidth;
    }

    // Double it once more for smooth loop
    track.innerHTML += track.innerHTML;
  },
};
</script>
<template>
  <div
    class="container-fluid acon-bg-primary-dark overflow-hidden px-0 py-2 position-relative"
  >
    <div class="marquee text-white">
      <div class="marquee-track d-flex" ref="track">
        <span class="marquee-item small">
          {{ announcement }} <i class="bi bi-stars small mx-2"></i>
        </span>
      </div>
    </div>
  </div>
</template>
<style scoped>
.marquee {
  overflow: hidden;
  white-space: nowrap;
  position: relative;
}

.marquee-track {
  display: flex;
  width: max-content;
  animation: scroll 40s linear infinite;
}

.marquee-item {
  flex-shrink: 0;
  white-space: nowrap;
}

.marquee:hover .marquee-track {
  animation-play-state: paused;
}

/* KEY FIX: move exact content width, not guesswork */
@keyframes scroll {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}
</style>

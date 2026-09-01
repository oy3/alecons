import { onBeforeUnmount, onMounted, ref } from "vue";

export function useCountUpStatistics(statistics, options = {}) {
  const { duration = 1400, threshold = 0.3 } = options;
  const target = ref(null);
  // Keep real values in prerendered HTML; animation begins only after hydration.
  const displayedValues = ref(statistics.map((stat) => stat.value));
  let observer;
  let animationFrame;

  const showFinalValues = () => {
    displayedValues.value = statistics.map((stat) => stat.value);
  };

  const animate = () => {
    const startedAt = performance.now();
    displayedValues.value = statistics.map(() => 0);

    const update = (now) => {
      const progress = Math.min((now - startedAt) / duration, 1);
      const easedProgress = 1 - (1 - progress) ** 3;
      displayedValues.value = statistics.map((stat) =>
        Math.round(stat.value * easedProgress),
      );

      if (progress < 1) animationFrame = requestAnimationFrame(update);
    };

    animationFrame = requestAnimationFrame(update);
  };

  onMounted(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion || !("IntersectionObserver" in window)) {
      showFinalValues();
      return;
    }

    observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        animate();
      },
      { threshold },
    );
    observer.observe(target.value);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    if (animationFrame) cancelAnimationFrame(animationFrame);
  });

  return { target, displayedValues };
}

<script setup>
import { computed } from "vue";
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "vue-chartjs";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

const props = defineProps({
  type: { type: String, default: "bar" },
  items: { type: Array, default: () => [] },
  labelKey: { type: String, default: "key" },
  valueKey: { type: String, default: "count" },
  datasetLabel: { type: String, default: "Total" },
  horizontal: { type: Boolean, default: false },
  currency: { type: Boolean, default: false },
});

const emit = defineEmits(["select"]);
const colors = ["#1f6f78", "#d62b2b", "#e8a317", "#258a5c", "#5975a4", "#8a5d9f", "#df7b55", "#6d7b84"];
const labels = computed(() => props.items.map((item) => String(item?.[props.labelKey] ?? "Not specified").replaceAll("_", " ")));
const values = computed(() => props.items.map((item) => Number(item?.[props.valueKey] || 0)));
const data = computed(() => ({
  labels: labels.value,
  datasets: [{
    label: props.datasetLabel,
    data: values.value,
    borderColor: props.type === "line" ? "#1f6f78" : colors,
    backgroundColor: props.type === "line" ? "rgba(31, 111, 120, 0.16)" : colors.map((color) => `${color}d9`),
    borderWidth: props.type === "line" ? 2 : 1,
    fill: props.type === "line",
    tension: 0.3,
    pointRadius: props.type === "line" ? 3 : 0,
    borderRadius: props.type === "bar" ? 3 : 0,
  }],
}));
const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: props.horizontal ? "y" : "x",
  onClick: (_event, elements) => {
    const index = elements?.[0]?.index;
    if (index !== undefined) emit("select", props.items[index]);
  },
  plugins: {
    legend: { display: props.type === "doughnut", position: "bottom", labels: { boxWidth: 12, usePointStyle: true, padding: 16 } },
    tooltip: { callbacks: { label: (context) => props.currency ? ` ${new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(context.raw)}` : ` ${context.raw.toLocaleString()}` } },
  },
  scales: props.type === "doughnut" ? undefined : {
    x: { beginAtZero: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } },
    y: { beginAtZero: true, grid: { color: "rgba(108,117,125,.12)" } },
  },
}));
</script>

<template>
  <div class="report-chart" role="img" :aria-label="`${datasetLabel} chart`">
    <Doughnut v-if="type === 'doughnut'" :data="data" :options="options" />
    <Line v-else-if="type === 'line'" :data="data" :options="options" />
    <Bar v-else :data="data" :options="options" />
  </div>
</template>

<style scoped>
.report-chart {
  width: 100%;
  height: 300px;
  min-width: 0;
}
@media (max-width: 575.98px) {
  .report-chart { height: 250px; }
}
</style>

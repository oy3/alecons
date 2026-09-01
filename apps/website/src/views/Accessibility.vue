<script setup>
import LegalPage from "../components/LegalPage.vue";
const sections = [
  { id: "commitment", title: "Our accessibility commitment", paragraphs: ["ALECONS aims to make public information and online services usable by applicants, students, families, staff and visitors with different access needs."], items: ["Clear navigation and consistent page structure", "Readable content and sufficient colour contrast", "Keyboard-operable navigation and forms", "Meaningful labels and alternatives for important images", "Reduced motion support where animation is used"] },
  { id: "limitations", title: "Where challenges can happen", paragraphs: ["Some historic documents, third-party payment services, maps, or linked portal content may not yet meet the same standard as this website. We continue to review and improve these experiences."] },
  { id: "assistance", title: "Request assistance", paragraphs: ["If you cannot access content, complete a form, read a document, or use a portal feature, contact us and describe the page, task and preferred format. We will provide a reasonable alternative where practical."] },
  { id: "improvement", title: "Continuous improvement", paragraphs: ["Accessibility is an ongoing responsibility. Feedback is reviewed as part of website maintenance and future service planning."] },
];
</script>
<template><LegalPage eyebrow="Accessibility" title="Accessibility" description="Our commitment to a website that is clear, navigable and usable by as many people as practical." :sections="sections" /></template>

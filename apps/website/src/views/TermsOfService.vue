<script setup>
import LegalPage from "../components/LegalPage.vue";
const sections = [
  { id: "accounts", title: "Accounts and portals", paragraphs: ["Users are responsible for providing accurate information, protecting account credentials and using ALECONS services only for legitimate purposes.", "The college may suspend access where misuse, security risks, or inaccurate records require investigation."] },
  { id: "payments", title: "Payments and verification", paragraphs: ["Payment status is subject to confirmation through the relevant payment channel and institutional records. Keep receipts and transaction references for verification.", "Published fees, deadlines and processes may be updated by authorised college officers."] },
  { id: "content", title: "Content and materials", paragraphs: ["Website content is provided for institutional information. College names, marks, documents and learning materials may not be misrepresented or republished in a way that harms ALECONS or its community."] },
  { id: "availability", title: "Availability and updates", paragraphs: ["We work to keep services available and accurate, but maintenance, network failures and third-party services may occasionally interrupt access.", "The current published version of these terms applies when you use the website or portals."] },
  { id: "notice", title: "Important notice", paragraphs: ["Website information does not replace a formal admission letter, payment confirmation, academic record, or other authorised institutional document."] },
];
</script>
<template><LegalPage eyebrow="Legal" title="Terms of Service" description="The conditions that support responsible use of ALECONS websites, portals and published information." :sections="sections" /></template>

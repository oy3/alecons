<script lang="js">
import { RouterView } from 'vue-router';
import Navbar from './components/Header.vue'
import Footer from './components/Footer.vue';
import campusImage from './assets/img/campus.jpg';

const siteName = import.meta.env.VITE_APP_FULL_NAME || 'Alecons College of Nursing Sciences'
const siteUrl = (import.meta.env.VITE_APP_SITE_URL || 'https://alecons.edu.ng').replace(/\/$/, '')
const siteNumber = import.meta.env.VITE_APP_PHONE || '+2349160008679'

export default {
   metaInfo: {
    meta: [
      {
        property: 'og:url',
        content: siteUrl,
      },
      {
        property: 'og:image',
        content: campusImage,
      },
    ],
    script: [
      {
        type: 'application/ld+json',
        json: {
          "@context": "https://schema.org",
          "@type": "CollegeOrPolytechnic",
          "name": siteName,
          "url": siteUrl,
          "logo": `${siteUrl}/assets/logo-DuXenZg8.png`,
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "Iyamoye-Abuja Road",
            "addressLocality": "Omuo Oke",
            "addressRegion": "Ekiti",
            "addressCountry": "NG"
          },
          "contactPoint": {
            "@type": "ContactPoint",
            "telephone": siteNumber,
            "contactType": "Admissions Office"
          }
        }
      }
    ]
  },
  name: 'App',
  computed: {},
  components: { RouterView, Navbar, Footer }
}
</script>

<template>
  <Navbar />
  <RouterView />
  <Footer />
</template>

<style scoped></style>

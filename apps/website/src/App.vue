<script lang="js">
import { RouterView } from 'vue-router';
import Navbar from './components/Header.vue'
import Footer from './components/Footer.vue';

export default {
   metaInfo: {
    script: [
      {
        type: 'application/ld+json',
        json: {
          "@context": "https://schema.org",
          "@type": "CollegeOrPolytechnic",
          "name": "Alecons College of Nursing Sciences",
          "url": "https://alecons.com.ng",
          "logo": "https://alecons.com.ng/assets/logo-DuXenZg8.png",
          "address": {
            "@type": "PostalAddress",
            "streetAddress": "Omuo Oke, Ekiti State",
            "addressLocality": "Omuo Oke",
            "addressRegion": "Ekiti",
            "addressCountry": "NG"
          },
          "contactPoint": {
            "@type": "ContactPoint",
            "telephone": "+2347084601610",
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

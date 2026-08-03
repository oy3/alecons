<script setup>
import BrandLogo from "./BrandLogo.vue";
import { navigation, portalLinks, site, socialLinks } from "../data/site";
import { programmes } from "../data/programmes";
import rootLabLogo from "../assets/img/rootlab.svg";
</script>

<template>
  <footer class="site-footer">
    <div class="site-container site-footer__grid">
      <div class="site-footer__brand">
        <RouterLink to="/" aria-label="ALECONS home"><BrandLogo compact inverse /></RouterLink>
        <p>
          Empowering the next generation of healthcare professionals through
          excellence in nursing education, compassionate care and clinical
          expertise.
        </p>
        <div class="social-links">
          <a
            v-for="social in socialLinks"
            :key="social.label"
            :href="social.href"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="social.label"
            ><i :class="`bi ${social.icon}`" aria-hidden="true"></i></a>
        </div>
      </div>
      <nav aria-label="Footer quick links">
        <h2>Quick links</h2>
        <RouterLink
          v-for="item in navigation.slice(1)"
          :key="item.to"
          :to="item.to"
          >{{ item.label }}</RouterLink>
      </nav>
      <nav aria-label="Footer programmes and portals">
        <h2>Programmes</h2>
        <RouterLink
          v-for="programme in programmes"
          :key="programme.slug"
          :to="`/programs/${programme.slug}`"
          >{{ programme.name }}</RouterLink>
        <h2 class="mt-4">Portals</h2>
        <a
          v-for="portal in portalLinks"
          :key="portal.label"
          :href="portal.href"
          target="_blank"
          rel="noopener noreferrer"
          >{{ portal.label }}</a>
      </nav>
      <div class="site-footer__contact">
        <h2>Contact</h2>
        <p>
          <i class="bi bi-geo-alt" aria-hidden="true"></i>{{ site.address }}
        </p>
        <p>
          <i class="bi bi-telephone" aria-hidden="true"></i><span><a
              v-for="phone in site.phones"
              :key="phone"
              :href="`tel:${phone.replace(/\s/g, '')}`"
              >{{ phone }}</a></span>
        </p>
        <p>
          <i class="bi bi-envelope" aria-hidden="true"></i><a :href="`mailto:${site.admissionsEmail}`">{{
            site.admissionsEmail
          }}</a>
        </p>
        <p>
          <i class="bi bi-clock" aria-hidden="true"></i><span>{{ site.officeHours[0] }}<br />{{ site.officeHours[1] }}</span>
        </p>
      </div>
    </div>
    <div class="site-container site-footer__bottom">
      <span>&copy; {{ new Date().getFullYear() }} ALECONS. All rights
        reserved.</span>

      <div class="site-footer__credit">
        <span>Powered by</span>
        <a
          class="site-footer__powered"
          href="https://rootlab.africa/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            :src="rootLabLogo"
            alt=""
            width="22"
            height="22"
            loading="lazy"
            aria-hidden="true"
          />
          <span>RootLab</span>
        </a>
      </div>

      <nav aria-label="Legal">
        <RouterLink to="/privacy-policy">Privacy Policy</RouterLink>
        <RouterLink to="/terms-of-service">Terms of Service</RouterLink>
        <RouterLink to="/accessibility">Accessibility</RouterLink>
      </nav>
    </div>
  </footer>
</template>

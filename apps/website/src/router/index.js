import { createRouter, createWebHistory } from "vue-router";
import Home from "../views/Home.vue";
import About from "../views/About.vue";
import Programs from "../views/Programs.vue";
import Contact from "../views/Contact.vue";
import Admissions from "../views/Admissions.vue";
import Faculty from "../views/Faculty.vue";
import PrivacyPolicy from "../views/PrivacyPolicy.vue";
import TermsOfService from "../views/TermsOfService.vue";
import Accessibility from "../views/Accessibility.vue";

const routes = [
  {
    path: "/",
    name: "Home",
    component: Home,
  },
  {
    path: "/about",
    name: "About",
    component: About,
  },
  {
    path: "/programs",
    name: "Programs",
    component: Programs,
  },
  {
    path: "/admissions",
    name: "Admissions",
    component: Admissions,
  },
  {
    path: "/faculty",
    name: "Faculty",
    component: Faculty,
  },
  {
    path: "/contact",
    name: "Contact",
    component: Contact,
  },
  {
    path: "/privacy-policy",
    name: "PrivacyPolicy",
    component: PrivacyPolicy,
  },
  {
    path: "/terms-of-service",
    name: "TermsOfService",
    component: TermsOfService,
  },
  {
    path: "/accessibility",
    name: "Accessibility",
    component: Accessibility,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, savedPosition) {
    return { top: 0 };
  },
});

export default router;

import { createRouter } from "vue-router";
import { admissionsConfig } from "../data/admissions";
import { getProgramme, programmes } from "../data/programmes";
import { applyRouteMeta } from "../utils/head";

export const routes = [
  {
    path: "/",
    name: "Home",
    component: () => import("../views/Home.vue"),
    meta: {
      title: "ALECONS - Alebiosu College of Nursing Sciences, Ekiti State",
      description:
        "Alebiosu College of Nursing Sciences trains skilled, compassionate nurses in Omuoke, Ekiti State. Explore programmes and apply online.",
      overlayHeader: true,
    },
  },
  {
    path: "/about",
    name: "About",
    component: () => import("../views/About.vue"),
    meta: {
      title: "About ALECONS - History, Mission & Leadership",
      description:
        "Learn about the history, mission, values, facilities and leadership of Alebiosu College of Nursing Sciences.",
      overlayHeader: true,
    },
  },
  {
    path: "/programs",
    name: "Programs",
    component: () => import("../views/Programs.vue"),
    meta: {
      title: "Nursing Programmes at ALECONS",
      description:
        "Explore ALECONS nursing programmes, qualifications, duration and current enrolment status in Omuoke, Ekiti State.",
      overlayHeader: true,
    },
  },
  {
    path: "/programs/:slug",
    name: "ProgrammeDetail",
    component: () => import("../views/ProgrammeDetail.vue"),
    beforeEnter: (to) => {
      const programme = getProgramme(to.params.slug);
      if (!programme) {
        return {
          name: "NotFound",
          params: { pathMatch: to.path.substring(1).split("/") },
        };
      }
      to.meta.title = `${programme.name} Programme - ALECONS`;
      to.meta.description = programme.description;
      return true;
    },
    meta: {
      title: "Programme Details - ALECONS",
      description:
        "Programme details, highlights and application status at Alebiosu College of Nursing Sciences.",
      overlayHeader: true,
    },
  },
  {
    path: "/admissions",
    name: "Admissions",
    component: () => import("../views/Admissions.vue"),
    meta: {
      title: `Admissions ${admissionsConfig.academicSession} - Apply to ALECONS`,
      description: `Review ALECONS admission requirements, application steps, dates and published fees for the ${admissionsConfig.academicSession} academic session.`,
      overlayHeader: true,
    },
  },
  {
    path: "/faculty",
    name: "Faculty",
    component: () => import("../views/Faculty.vue"),
    meta: {
      title: "Faculty & Staff - ALECONS",
      description:
        "Meet the academic leaders, lecturers and administrative staff supporting students at ALECONS.",
      overlayHeader: true,
    },
  },
  {
    path: "/contact",
    name: "Contact",
    component: () => import("../views/Contact.vue"),
    meta: {
      title: "Contact ALECONS - Address, Phone & Email",
      description:
        "Contact ALECONS admissions, academic, student and financial services in Omuoke, Ekiti State.",
      overlayHeader: true,
    },
  },
  {
    path: "/privacy-policy",
    name: "PrivacyPolicy",
    component: () => import("../views/PrivacyPolicy.vue"),
    meta: {
      title: "Privacy Policy - ALECONS",
      description:
        "How ALECONS collects, uses, stores and protects information across its website and portals.",
      overlayHeader: true,
    },
  },
  {
    path: "/terms-of-service",
    name: "TermsOfService",
    component: () => import("../views/TermsOfService.vue"),
    meta: {
      title: "Terms of Service - ALECONS",
      description:
        "Terms supporting responsible use of ALECONS websites, portals and institutional information.",
      overlayHeader: true,
    },
  },
  {
    path: "/accessibility",
    name: "Accessibility",
    component: () => import("../views/Accessibility.vue"),
    meta: {
      title: "Accessibility - ALECONS",
      description:
        "ALECONS accessibility commitment and how to request assistance using our website and portals.",
      overlayHeader: true,
    },
  },
  {
    path: "/verify/v1/:token",
    name: "VerifyIdentity",
    component: () => import("../views/VerifyIdentity.vue"),
    meta: {
      title: "Verify Identity - ALECONS",
      description: "Verify an ALECONS identity record.",
      noindex: true,
    },
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("../views/NotFound.vue"),
    meta: {
      title: "Page Not Found - ALECONS",
      description: "The requested ALECONS page could not be found.",
      noindex: true,
    },
  },
];

export const prerenderPaths = [
  "/",
  "/about",
  "/programs",
  ...programmes.map(({ slug }) => `/programs/${slug}`),
  "/admissions",
  "/faculty",
  "/contact",
  "/privacy-policy",
  "/terms-of-service",
  "/accessibility",
];

export function createWebsiteRouter(history) {
  return createRouter({
    history,
    routes,
    scrollBehavior(to, from, savedPosition) {
      if (savedPosition) return savedPosition;
      if (to.hash) return { el: to.hash, behavior: "smooth" };
      return { top: 0 };
    },
  });
}

export function installBrowserRouterHooks(router) {
  router.afterEach((to) => {
    applyRouteMeta(to);
    requestAnimationFrame(() =>
      document
        .querySelector("#main-content")
        ?.focus({ preventScroll: true }),
    );
  });
}

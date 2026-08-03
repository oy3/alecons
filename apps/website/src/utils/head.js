import { getProgramme } from "../data/programmes";
import { site } from "../data/site";

const DEFAULT_TITLE = "ALECONS - Alebiosu College of Nursing Sciences";
const DEFAULT_DESCRIPTION =
  "Alebiosu College of Nursing Sciences provides nursing education in Omuoke, Ekiti State.";
const SOCIAL_IMAGE_PATH = "/social-card.jpg";

const pageTypes = {
  About: "AboutPage",
  Admissions: "WebPage",
  Contact: "ContactPage",
  Faculty: "CollectionPage",
  Programs: "CollectionPage",
};

const pageLabels = {
  About: "About",
  Accessibility: "Accessibility",
  Admissions: "Admissions",
  Contact: "Contact",
  Faculty: "Faculty",
  PrivacyPolicy: "Privacy Policy",
  Programs: "Programmes",
  TermsOfService: "Terms of Service",
};

function getSiteUrl() {
  return (import.meta.env.VITE_APP_SITE_URL || "https://alecons.edu.ng").replace(
    /\/$/,
    "",
  );
}

function absoluteUrl(path) {
  return `${getSiteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

function getCanonicalPath(route) {
  if (route.meta.noindex) return null;
  return route.meta.canonical || route.path || "/";
}

function getBreadcrumbs(route) {
  if (route.name === "Home" || route.meta.noindex) return [];

  const breadcrumbs = [{ name: "Home", path: "/" }];
  if (route.name === "ProgrammeDetail") {
    const programme = getProgramme(route.params.slug);
    return [
      ...breadcrumbs,
      { name: "Programmes", path: "/programs" },
      { name: programme?.name || "Programme", path: route.path },
    ];
  }

  return [
    ...breadcrumbs,
    {
      name: pageLabels[route.name] || route.meta.title || "Page",
      path: route.path,
    },
  ];
}

function organizationSchema() {
  const siteUrl = getSiteUrl();
  return {
    "@type": "CollegeOrUniversity",
    "@id": `${siteUrl}/#organization`,
    name: site.name,
    alternateName: site.shortName,
    description: site.description,
    url: siteUrl,
    logo: {
      "@type": "ImageObject",
      url: `${siteUrl}/favicon.png`,
      width: 192,
      height: 192,
    },
    address: {
      "@type": "PostalAddress",
      streetAddress: "Iyamoye-Abuja Road",
      addressLocality: "Omuoke",
      addressRegion: "Ekiti State",
      addressCountry: "NG",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: site.phones[0],
        email: site.admissionsEmail,
        contactType: "admissions",
        areaServed: "NG",
        availableLanguage: "English",
      },
    ],
    telephone: site.phones[0],
    email: site.email,
  };
}

export function buildStructuredData(route) {
  const siteUrl = getSiteUrl();
  const canonicalPath = getCanonicalPath(route);
  if (!canonicalPath) return null;

  const canonicalUrl = absoluteUrl(canonicalPath);
  const websiteSchema = {
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    url: siteUrl,
    name: site.name,
    alternateName: site.shortName,
    description: site.description,
    publisher: { "@id": `${siteUrl}/#organization` },
    inLanguage: "en-NG",
  };
  const graph = [organizationSchema(), websiteSchema];

  if (route.name !== "Home") {
    graph.push({
      "@type": pageTypes[route.name] || "WebPage",
      "@id": `${canonicalUrl}#webpage`,
      url: canonicalUrl,
      name: route.meta.title || DEFAULT_TITLE,
      description: route.meta.description || DEFAULT_DESCRIPTION,
      isPartOf: { "@id": `${siteUrl}/#website` },
      about: { "@id": `${siteUrl}/#organization` },
      inLanguage: "en-NG",
    });
  }

  const breadcrumbs = getBreadcrumbs(route);
  if (breadcrumbs.length) {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${canonicalUrl}#breadcrumb`,
      itemListElement: breadcrumbs.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.name,
        item: absoluteUrl(item.path),
      })),
    });
  }

  if (route.name === "ProgrammeDetail") {
    const programme = getProgramme(route.params.slug);
    if (programme) {
      graph.push({
        "@type": "EducationalOccupationalProgram",
        "@id": `${canonicalUrl}#programme`,
        name: programme.name,
        description: programme.description,
        url: canonicalUrl,
        provider: { "@id": `${siteUrl}/#organization` },
        educationalCredentialAwarded: programme.award,
        occupationalCategory: "Nursing and healthcare",
      });
    }
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

export function resolveRouteMeta(route) {
  const title = route.meta.title || DEFAULT_TITLE;
  const description = route.meta.description || DEFAULT_DESCRIPTION;
  const canonicalPath = getCanonicalPath(route);
  const canonicalUrl = canonicalPath ? absoluteUrl(canonicalPath) : null;
  const socialImage = absoluteUrl(SOCIAL_IMAGE_PATH);

  return {
    title,
    description,
    canonicalUrl,
    robots: route.meta.noindex
      ? "noindex, nofollow, noarchive"
      : "index, follow, max-image-preview:large",
    socialImage,
    structuredData: buildStructuredData(route),
  };
}

function upsertMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.setAttribute("content", content);
}

export function applyRouteMeta(route) {
  const meta = resolveRouteMeta(route);
  document.title = meta.title;
  upsertMeta("name", "description", meta.description);
  upsertMeta("name", "robots", meta.robots);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:locale", "en_NG");
  upsertMeta("property", "og:site_name", site.name);
  upsertMeta("property", "og:title", meta.title);
  upsertMeta("property", "og:description", meta.description);
  upsertMeta("property", "og:image", meta.socialImage);
  upsertMeta("property", "og:image:width", "1280");
  upsertMeta("property", "og:image:height", "720");
  upsertMeta(
    "property",
    "og:image:alt",
    "Alebiosu College of Nursing Sciences campus and identity",
  );
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", meta.title);
  upsertMeta("name", "twitter:description", meta.description);
  upsertMeta("name", "twitter:image", meta.socialImage);
  upsertMeta(
    "name",
    "twitter:image:alt",
    "Alebiosu College of Nursing Sciences campus and identity",
  );
  if (meta.canonicalUrl) upsertMeta("property", "og:url", meta.canonicalUrl);

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (meta.canonicalUrl) {
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.append(canonical);
    }
    canonical.setAttribute("href", meta.canonicalUrl);
  } else {
    canonical?.remove();
    document.head.querySelector('meta[property="og:url"]')?.remove();
  }

  let structuredData = document.head.querySelector(
    "#alecons-structured-data",
  );
  if (meta.structuredData) {
    if (!structuredData) {
      structuredData = document.createElement("script");
      structuredData.id = "alecons-structured-data";
      structuredData.type = "application/ld+json";
      document.head.append(structuredData);
    }
    structuredData.textContent = JSON.stringify(meta.structuredData);
  } else structuredData?.remove();
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function renderRouteHead(route) {
  const meta = resolveRouteMeta(route);
  const tags = [
    `<title>${escapeAttribute(meta.title)}</title>`,
    `<meta name="description" content="${escapeAttribute(meta.description)}">`,
    `<meta name="robots" content="${escapeAttribute(meta.robots)}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:locale" content="en_NG">',
    `<meta property="og:site_name" content="${escapeAttribute(site.name)}">`,
    `<meta property="og:title" content="${escapeAttribute(meta.title)}">`,
    `<meta property="og:description" content="${escapeAttribute(meta.description)}">`,
    `<meta property="og:image" content="${escapeAttribute(meta.socialImage)}">`,
    '<meta property="og:image:width" content="1280">',
    '<meta property="og:image:height" content="720">',
    '<meta property="og:image:alt" content="Alebiosu College of Nursing Sciences campus and identity">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeAttribute(meta.title)}">`,
    `<meta name="twitter:description" content="${escapeAttribute(meta.description)}">`,
    `<meta name="twitter:image" content="${escapeAttribute(meta.socialImage)}">`,
    '<meta name="twitter:image:alt" content="Alebiosu College of Nursing Sciences campus and identity">',
  ];

  if (meta.canonicalUrl) {
    tags.push(
      `<meta property="og:url" content="${escapeAttribute(meta.canonicalUrl)}">`,
      `<link rel="canonical" href="${escapeAttribute(meta.canonicalUrl)}">`,
    );
  }

  const verification = import.meta.env.VITE_GOOGLE_SITE_VERIFICATION?.trim();
  if (verification) {
    tags.push(
      `<meta name="google-site-verification" content="${escapeAttribute(verification)}">`,
    );
  }

  if (meta.structuredData) {
    const json = JSON.stringify(meta.structuredData).replaceAll("<", "\\u003c");
    tags.push(
      `<script id="alecons-structured-data" type="application/ld+json">${json}</script>`,
    );
  }

  return tags.join("\n    ");
}

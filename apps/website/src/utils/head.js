import { site } from "../data/site";

const DEFAULT_TITLE = "ALECONS - Alebiosu College of Nursing Sciences";
const DEFAULT_DESCRIPTION = "Alebiosu College of Nursing Sciences provides nursing education in Omuoke, Ekiti State.";

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
  const siteUrl = (import.meta.env.VITE_APP_SITE_URL || "https://alecons.edu.ng").replace(/\/$/, "");
  const title = route.meta.title || DEFAULT_TITLE;
  const description = route.meta.description || DEFAULT_DESCRIPTION;
  const canonicalUrl = `${siteUrl}${route.meta.canonical || route.path}`;
  const socialImage = `${siteUrl}/social-card.jpg`;

  document.title = title;
  upsertMeta("name", "description", description);
  upsertMeta("name", "robots", route.meta.noindex ? "noindex, follow" : "index, follow");
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:url", canonicalUrl);
  upsertMeta("property", "og:image", socialImage);
  upsertMeta("name", "twitter:card", "summary_large_image");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);

  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.setAttribute("rel", "canonical");
    document.head.append(canonical);
  }
  canonical.setAttribute("href", canonicalUrl);

  let structuredData = document.head.querySelector("#alecons-structured-data");
  if (!structuredData) {
    structuredData = document.createElement("script");
    structuredData.id = "alecons-structured-data";
    structuredData.type = "application/ld+json";
    document.head.append(structuredData);
  }
  structuredData.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollegeOrUniversity",
    name: site.name,
    url: siteUrl,
    logo: `${siteUrl}/favicon.png`,
    address: {
      "@type": "PostalAddress",
      streetAddress: "Iyamoye-Abuja Road",
      addressLocality: "Omuoke",
      addressRegion: "Ekiti",
      addressCountry: "NG",
    },
    telephone: site.phones[0],
    email: site.email,
  });
}

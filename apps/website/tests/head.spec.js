import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyRouteMeta,
  buildStructuredData,
  renderRouteHead,
} from "../src/utils/head";

describe("route metadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    document.head.querySelectorAll('meta, link[rel="canonical"], #alecons-structured-data').forEach((element) => element.remove());
  });

  it("applies page metadata and canonical URLs", () => {
    applyRouteMeta({ path: "/about", meta: { title: "About ALECONS", description: "About the college" } });

    expect(document.title).toBe("About ALECONS");
    expect(document.head.querySelector('meta[name="description"]')?.content).toBe("About the college");
    expect(document.head.querySelector('link[rel="canonical"]')?.href).toContain("/about");
    expect(document.head.querySelector("#alecons-structured-data")?.textContent).toContain("CollegeOrUniversity");
    expect(document.head.querySelector('meta[property="og:site_name"]')?.content).toContain("Alebiosu College");
  });

  it("marks non-public routes as noindex", () => {
    applyRouteMeta({ path: "/missing", meta: { noindex: true } });

    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe("noindex, nofollow, noarchive");
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
  });

  it("creates page-specific structured data and prerender head markup", () => {
    const route = {
      name: "About",
      path: "/about",
      params: {},
      meta: { title: "About ALECONS", description: "About the college" },
    };
    const structuredData = buildStructuredData(route);
    const head = renderRouteHead(route);

    expect(structuredData["@graph"].some((item) => item["@type"] === "AboutPage")).toBe(true);
    expect(structuredData["@graph"].some((item) => item["@type"] === "BreadcrumbList")).toBe(true);
    expect(head).toContain('<link rel="canonical" href="https://alecons.edu.ng/about">');
  });

  it("keeps production canonicals while making staging globally non-indexable", () => {
    vi.stubEnv("VITE_SITE_NOINDEX", "true");
    const route = {
      name: "About",
      path: "/about",
      params: {},
      meta: { title: "About ALECONS", description: "About the college" },
    };
    const head = renderRouteHead(route);

    expect(head).toContain('content="noindex, nofollow, noarchive"');
    expect(head).toContain('<link rel="canonical" href="https://alecons.edu.ng/about">');
    expect(head).toContain("alecons-structured-data");
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { applyRouteMeta } from "../src/utils/head";

describe("route metadata", () => {
  afterEach(() => {
    document.head.querySelectorAll('meta, link[rel="canonical"], #alecons-structured-data').forEach((element) => element.remove());
  });

  it("applies page metadata and canonical URLs", () => {
    applyRouteMeta({ path: "/about", meta: { title: "About ALECONS", description: "About the college" } });

    expect(document.title).toBe("About ALECONS");
    expect(document.head.querySelector('meta[name="description"]')?.content).toBe("About the college");
    expect(document.head.querySelector('link[rel="canonical"]')?.href).toContain("/about");
    expect(document.head.querySelector("#alecons-structured-data")?.textContent).toContain("CollegeOrUniversity");
  });

  it("marks non-public routes as noindex", () => {
    applyRouteMeta({ path: "/missing", meta: { noindex: true } });

    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe("noindex, follow");
  });
});

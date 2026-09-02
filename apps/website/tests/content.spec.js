import { describe, expect, it } from "vitest";
import { programmes } from "../src/data/programmes";
import { admissionDates, fees } from "../src/data/admissions";
import { portalLinks, statistics } from "../src/data/site";

describe("public website content", () => {
  it("keeps programme routes unique and distinguishes enrolment status", () => {
    expect(new Set(programmes.map(({ slug }) => slug)).size).toBe(programmes.length);
    expect(programmes.filter(({ status }) => status === "enrolling").map(({ name }) => name)).toEqual(["Basic Nursing"]);
    expect(programmes.every(({ status }) => ["enrolling", "coming-soon"].includes(status))).toBe(true);
  });

  it("retains the approved institutional statistics", () => {
    expect(statistics.map(({ value, suffix }) => `${value}${suffix}`)).toEqual(["11+", "60+", "15+", "100%"]);
  });

  it("keeps admissions configuration complete", () => {
    expect(admissionDates).toHaveLength(8);
    expect(fees).toHaveLength(5);
    expect(portalLinks.every(({ href }) => href.startsWith("https://"))).toBe(true);
  });
});

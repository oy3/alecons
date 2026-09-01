import { afterEach, describe, expect, it, vi } from "vitest";
import {
  initializeAnalytics,
  trackEvent,
} from "../src/services/analytics";

describe("website analytics", () => {
  afterEach(() => {
    document
      .querySelectorAll("script[data-alecons-analytics]")
      .forEach((element) => element.remove());
    delete window.aleconsAnalyticsBeforeSend;
    delete window.umami;
    vi.unstubAllEnvs();
  });

  it("stays disabled until a website ID is configured", () => {
    vi.stubEnv("VITE_UMAMI_WEBSITE_ID", "");
    expect(initializeAnalytics()).toBe(false);
    expect(document.querySelector("script[data-alecons-analytics]")).toBeNull();
  });

  it("loads a privacy-conscious tracker and blocks verification paths", () => {
    vi.stubEnv("VITE_UMAMI_WEBSITE_ID", "website-id");
    vi.stubEnv("VITE_UMAMI_DOMAINS", "alecons.edu.ng");

    expect(initializeAnalytics()).toBe(true);
    const script = document.querySelector("script[data-alecons-analytics]");
    expect(script?.dataset.websiteId).toBe("website-id");
    expect(script?.dataset.excludeSearch).toBe("true");
    expect(script?.dataset.doNotTrack).toBe("true");
    expect(
      window.aleconsAnalyticsBeforeSend("event", {
        url: "/verify/v1/private-token?source=email",
      }),
    ).toBe(false);
    expect(
      window.aleconsAnalyticsBeforeSend("event", {
        url: "/admissions?utm_source=test",
      }).url,
    ).toBe("/admissions");
  });

  it("records only named custom events when the tracker is ready", () => {
    const track = vi.fn();
    window.umami = { track };

    expect(trackEvent("apply-click")).toBe(true);
    expect(track).toHaveBeenCalledWith("apply-click");
  });
});

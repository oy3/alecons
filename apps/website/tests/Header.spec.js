import { mount, flushPromises } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { publicApiService } from "../src/services/publicApi";
import Header from "../src/components/Header.vue";

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: "/", component: { template: "<div />" } }],
});

describe("Header mobile navigation", () => {
  let wrapper;
  beforeEach(async () => {
    vi.spyOn(publicApiService, "getWebsiteAnnouncement").mockResolvedValue({
      success: true,
      data: null,
    });
    sessionStorage.clear();
    await router.push("/");
    await router.isReady();
    wrapper = mount(Header, {
      attachTo: document.body,
      global: { plugins: [router] },
    });
  });
  afterEach(() => wrapper?.unmount());

  it("opens as a modal drawer, locks scroll and closes with Escape", async () => {
    const toggle = wrapper.get(".menu-toggle");
    await toggle.trigger("click");
    expect(toggle.attributes("aria-expanded")).toBe("true");
    expect(wrapper.get("[role=dialog]").attributes("aria-modal")).toBe("true");
    expect(document.body.style.overflow).toBe("hidden");
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await wrapper.vm.$nextTick();
    expect(wrapper.find("[role=dialog]").exists()).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps a dismissed publication hidden but displays a new content version", async () => {
    publicApiService.getWebsiteAnnouncement.mockResolvedValue({
      data: {
        id: "notice",
        version: 1,
        message: "Admissions open",
        linkUrl: "/admissions",
        linkLabel: "Apply now",
      },
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    // Initial mount may still be finishing its first request.
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(wrapper.get(".announcement").text()).toContain("Admissions open");
    await wrapper.get('[aria-label="Dismiss announcement"]').trigger("click");
    expect(wrapper.find(".announcement").exists()).toBe(false);
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(wrapper.find(".announcement").exists()).toBe(false);
    publicApiService.getWebsiteAnnouncement.mockResolvedValue({
      data: { id: "notice", version: 2, message: "Admissions extended" },
    });
    document.dispatchEvent(new Event("visibilitychange"));
    await flushPromises();
    expect(wrapper.get(".announcement").text()).toContain(
      "Admissions extended",
    );
  });
});

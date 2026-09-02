import { mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import Header from "../src/components/Header.vue";

const router = createRouter({ history: createMemoryHistory(), routes: [{ path: "/", component: { template: "<div />" } }] });

describe("Header mobile navigation", () => {
  let wrapper;
  beforeEach(async () => {
    sessionStorage.clear();
    await router.push("/");
    await router.isReady();
    wrapper = mount(Header, { attachTo: document.body, global: { plugins: [router] } });
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
});

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import ContactForm from "../src/components/ContactForm.vue";

describe("ContactForm", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows field-level errors for an incomplete enquiry", async () => {
    const wrapper = mount(ContactForm);
    await wrapper.get("form").trigger("submit");
    expect(wrapper.findAll(".field-error")).toHaveLength(4);
    expect(wrapper.get("#contact-first-name").attributes("aria-invalid")).toBe("true");
  });

  it("submits to the public API and displays the enquiry reference", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { reference: "ENQ-2026-ABC12345", received: true } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const wrapper = mount(ContactForm);
    await wrapper.get("#contact-first-name").setValue("Temitope");
    await wrapper.get("#contact-last-name").setValue("Oyeyinka");
    await wrapper.get("#contact-email").setValue("temitope@example.com");
    await wrapper.get("#contact-message").setValue("I would like more information about Basic Nursing admissions.");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get(".form-status--success").text()).toContain("ENQ-2026-ABC12345");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/public/contact-enquiries"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("keeps the form populated when the API rejects a submission", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Please try again later" }),
    }));
    const wrapper = mount(ContactForm);
    await wrapper.get("#contact-first-name").setValue("Temitope");
    await wrapper.get("#contact-last-name").setValue("Oyeyinka");
    await wrapper.get("#contact-email").setValue("temitope@example.com");
    await wrapper.get("#contact-message").setValue("I would like more information about Basic Nursing admissions.");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get(".form-status--error").text()).toContain("Please try again later");
    expect(wrapper.get("#contact-first-name").element.value).toBe("Temitope");
  });
});

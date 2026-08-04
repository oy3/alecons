import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import ContactForm from "../src/components/ContactForm.vue";

describe("ContactForm", () => {
  it("shows field-level errors for an incomplete enquiry", async () => {
    const wrapper = mount(ContactForm);
    await wrapper.get("form").trigger("submit");
    expect(wrapper.findAll(".field-error")).toHaveLength(4);
    expect(wrapper.get("#contact-first-name").attributes("aria-invalid")).toBe("true");
  });

  it("provides an honest fallback until an endpoint is configured", async () => {
    const wrapper = mount(ContactForm);
    await wrapper.get("#contact-first-name").setValue("Temitope");
    await wrapper.get("#contact-last-name").setValue("Oyeyinka");
    await wrapper.get("#contact-email").setValue("temitope@example.com");
    await wrapper.get("#contact-message").setValue("I would like more information about Basic Nursing admissions.");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(wrapper.get(".form-status--info").text()).toContain("Online form delivery is being configured");
  });
});

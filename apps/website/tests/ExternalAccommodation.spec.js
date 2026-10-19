import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ExternalAccommodation from "../src/views/ExternalAccommodation.vue";
import { publicApiService } from "../src/services/publicApi";
import { prepareAccommodationCheckout } from "../src/services/accommodationPayment";

vi.mock("../src/services/accommodationPayment", () => ({
  prepareAccommodationCheckout: vi.fn(),
}));
const unpaid = {
  _id: "application-id",
  applicationNumber: "ACC-TEST",
  externalResidentId: { externalResidentNumber: "EXT-TEST" },
  status: "awaiting_payment",
};
const allocated = { ...unpaid, status: "allocated", documentsReady: true };
const pending = {
  reference: "ALC-test",
  status: "pending",
  canRetry: false,
  canResume: false,
};
const button = (wrapper, text) =>
  wrapper.findAll("button").find((item) => item.text().includes(text));

describe("external accommodation popup payment", () => {
  let wrapper;
  let checkout;
  beforeEach(() => {
    vi.clearAllMocks();
    const storage = () => {
      const values = new Map();
      return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: (key) => values.delete(key),
        clear: () => values.clear(),
      };
    };
    vi.stubGlobal("localStorage", storage());
    vi.stubGlobal("sessionStorage", storage());
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem("aleconsAccommodationResumeToken", "resident-token");
    vi.spyOn(
      publicApiService,
      "getExternalAccommodationConfig",
    ).mockResolvedValue({ applicationsOpen: true, categories: [] });
    vi.spyOn(publicApiService, "resumeExternalAccommodation").mockResolvedValue(
      unpaid,
    );
    vi.spyOn(
      publicApiService,
      "getExternalAccommodationPaymentOptions",
    ).mockResolvedValue({
      payment: { amount: 100000 },
      paystackEnabled: true,
      manualTransfer: { enabled: true },
    });
    vi.spyOn(
      publicApiService,
      "initializeExternalAccommodationPayment",
    ).mockResolvedValue({ reference: "ALC-test", access_code: "server-code" });
    vi.spyOn(
      publicApiService,
      "verifyExternalAccommodationPayment",
    ).mockResolvedValue({
      ...allocated,
      paymentAttempt: { reference: "ALC-test", status: "successful" },
    });
    checkout = vi.fn().mockResolvedValue({ status: "success" });
    prepareAccommodationCheckout.mockResolvedValue(checkout);
  });
  afterEach(() => {
    wrapper?.unmount();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function render(query = {}) {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/accommodation/external", component: { template: "<div />" } },
      ],
    });
    await router.push({ path: "/accommodation/external", query });
    await router.isReady();
    wrapper = mount(ExternalAccommodation, {
      global: {
        plugins: [router],
        stubs: { PageHero: true, TenancyAgreementForm: true },
      },
    });
    await flushPromises();
    return router;
  }

  it("opens the initialized access code and advances only after server confirmation", async () => {
    let verify;
    publicApiService.verifyExternalAccommodationPayment.mockImplementation(
      () =>
        new Promise((resolve) => {
          verify = resolve;
        }),
    );
    await render();
    await button(wrapper, "Pay securely").trigger("click");
    await flushPromises();
    expect(checkout).toHaveBeenCalledWith(
      "server-code",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(wrapper.text()).toContain("Confirming payment");
    expect(wrapper.text()).not.toContain("Accommodation allocated");
    expect(
      publicApiService.verifyExternalAccommodationPayment,
    ).toHaveBeenCalledWith("resident-token", "ALC-test", expect.any(Object));
    verify({ ...allocated, paymentAttempt: { status: "successful" } });
    await flushPromises();
    expect(wrapper.text()).toContain("Accommodation allocated");
  });

  it("prevents repeated clicks from initializing multiple charges", async () => {
    let close;
    checkout.mockImplementation(
      () =>
        new Promise((resolve) => {
          close = resolve;
        }),
    );
    await render();
    await button(wrapper, "Pay securely").trigger("click");
    await button(wrapper, "Pay securely").trigger("click");
    await flushPromises();
    expect(
      publicApiService.initializeExternalAccommodationPayment,
    ).toHaveBeenCalledTimes(1);
    close({ status: "success" });
    await flushPromises();
  });

  it("checks a cancelled checkout and offers the same unfinished checkout", async () => {
    checkout.mockResolvedValue({ status: "cancelled" });
    publicApiService.verifyExternalAccommodationPayment.mockResolvedValue({
      ...unpaid,
      paymentAttempt: { ...pending, canResume: true },
    });
    await render();
    await button(wrapper, "Pay securely").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Checkout closed");
    expect(
      button(wrapper, "Continue payment").attributes("disabled"),
    ).toBeUndefined();
    expect(wrapper.get("#receipt").attributes("disabled")).toBeDefined();
    expect(
      publicApiService.initializeExternalAccommodationPayment,
    ).toHaveBeenCalledTimes(1);
    expect(wrapper.text()).not.toContain("Accommodation allocated");
  });

  it("does not open a popup or offer another payment for an unresolved attempt", async () => {
    publicApiService.initializeExternalAccommodationPayment.mockResolvedValue({
      reference: "ALC-test",
      pending: true,
    });
    publicApiService.verifyExternalAccommodationPayment.mockResolvedValue({
      ...unpaid,
      paymentAttempt: pending,
    });
    await render();
    await button(wrapper, "Pay securely").trigger("click");
    await flushPromises();
    expect(checkout).not.toHaveBeenCalled();
    expect(
      button(wrapper, "Pay securely").attributes("disabled"),
    ).toBeDefined();
    expect(wrapper.get("#receipt").attributes("disabled")).toBeDefined();
    publicApiService.verifyExternalAccommodationPayment.mockResolvedValue({
      ...unpaid,
      paymentAttempt: { ...pending, status: "failed", canRetry: true },
    });
    await button(wrapper, "Check payment status").trigger("click");
    await flushPromises();
    expect(
      button(wrapper, "Pay securely").attributes("disabled"),
    ).toBeUndefined();
    expect(wrapper.get("#receipt").attributes("disabled")).toBeUndefined();
  });

  it("restores an existing payment reference after refreshing the page", async () => {
    publicApiService.getExternalAccommodationPaymentOptions.mockResolvedValue({
      paystackEnabled: true,
      paymentAttempt: pending,
    });
    await render();
    expect(
      button(wrapper, "Pay securely").attributes("disabled"),
    ).toBeDefined();
    await button(wrapper, "Check payment status").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Accommodation allocated");
    expect(
      publicApiService.initializeExternalAccommodationPayment,
    ).not.toHaveBeenCalled();
  });

  it("retains the reference and blocks another charge when bounded verification retries fail", async () => {
    publicApiService.getExternalAccommodationPaymentOptions.mockResolvedValue({
      paystackEnabled: true,
      paymentAttempt: pending,
    });
    await render();
    // Start with a new checkout, then simulate a verification outage and a reload finding its record.
    wrapper.unmount();
    publicApiService.getExternalAccommodationPaymentOptions
      .mockResolvedValueOnce({ paystackEnabled: true })
      .mockResolvedValue({ paystackEnabled: true, paymentAttempt: pending });
    await render();
    publicApiService.verifyExternalAccommodationPayment.mockRejectedValue(
      new Error("Provider unavailable"),
    );
    vi.useFakeTimers();
    await button(wrapper, "Pay securely").trigger("click");
    await flushPromises();
    await vi.advanceTimersByTimeAsync(3000);
    await flushPromises();
    expect(
      publicApiService.verifyExternalAccommodationPayment,
    ).toHaveBeenCalledTimes(3);
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Check payment status again",
    );
    expect(
      button(wrapper, "Pay securely").attributes("disabled"),
    ).toBeDefined();
    expect(wrapper.text()).toContain("ALC-test");
  });

  it("keeps the redirect callback working without launching a popup", async () => {
    const router = await render({ paymentReference: "ALC-test" });
    await flushPromises();
    expect(wrapper.text()).toContain("Accommodation allocated");
    expect(router.currentRoute.value.query.paymentReference).toBeUndefined();
    expect(prepareAccommodationCheckout).not.toHaveBeenCalled();
  });

  it("does not create a payment if the checkout SDK cannot load", async () => {
    prepareAccommodationCheckout.mockRejectedValue(
      new Error("Checkout unavailable"),
    );
    await render();
    await button(wrapper, "Pay securely").trigger("click");
    await flushPromises();
    expect(
      publicApiService.initializeExternalAccommodationPayment,
    ).not.toHaveBeenCalled();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "Checkout unavailable",
    );
  });

  it('does not reopen a completed checkout while provider confirmation is delayed, including after refresh', async () => {
    publicApiService.verifyExternalAccommodationPayment.mockResolvedValue({ ...unpaid, paymentAttempt: { ...pending, canResume: true } });
    await render();
    vi.useFakeTimers();
    await button(wrapper, 'Pay securely').trigger('click'); await flushPromises();
    await vi.advanceTimersByTimeAsync(3000); await flushPromises();
    expect(button(wrapper, 'Pay securely').attributes('disabled')).toBeDefined();
    expect(button(wrapper, 'Continue payment')).toBeUndefined();
    wrapper.unmount(); vi.useRealTimers();
    publicApiService.getExternalAccommodationPaymentOptions.mockResolvedValue({ paystackEnabled: true, paymentAttempt: { ...pending, canResume: true } });
    await render();
    expect(button(wrapper, 'Pay securely').attributes('disabled')).toBeDefined();
    expect(button(wrapper, 'Check payment status')).toBeDefined();
  });

  it("keeps a quarantined provider success on the payment step for review", async () => {
    publicApiService.verifyExternalAccommodationPayment.mockResolvedValue({
      ...unpaid,
      paymentAttempt: { ...pending, status: "successful", needsReview: true },
    });
    await render();
    await button(wrapper, "Pay securely").trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("This payment needs review");
    expect(
      button(wrapper, "Pay securely").attributes("disabled"),
    ).toBeDefined();
    expect(wrapper.text()).not.toContain("Accommodation allocated");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareAccommodationCheckout } from "../src/services/accommodationPayment";

const sdk = vi.hoisted(() => ({
  resume: vi.fn(),
  cancel: vi.fn(),
  construct: vi.fn(),
}));
vi.mock("@paystack/inline-js", () => ({
  default: class {
    constructor() {
      sdk.construct();
    }
    resumeTransaction(...args) {
      sdk.resume(...args);
    }
    cancelTransaction(...args) {
      sdk.cancel(...args);
    }
  },
}));

describe("accommodation checkout adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sdk.resume.mockReset();
  });

  it("resumes the server access code and ignores cancellation after success", async () => {
    const open = await prepareAccommodationCheckout();
    expect(sdk.construct).not.toHaveBeenCalled();
    const pending = open("server-access-code");
    const [code, callbacks] = sdk.resume.mock.calls[0];
    expect(code).toBe("server-access-code");
    callbacks.onSuccess({ reference: "untrusted-popup-reference" });
    callbacks.onCancel();
    await expect(pending).resolves.toEqual({ status: "success" });
  });

  it("reports cancellation and loading errors without declaring payment failed", async () => {
    const open = await prepareAccommodationCheckout();
    const cancelled = open("code");
    sdk.resume.mock.calls[0][1].onCancel();
    await expect(cancelled).resolves.toEqual({ status: "cancelled" });
    const failed = open("another-code");
    sdk.resume.mock.calls[1][1].onError({ message: "Checkout unavailable" });
    await expect(failed).resolves.toEqual({
      status: "error",
      message: "Checkout unavailable",
    });
  });

  it("settles and closes a loaded checkout when its page is unmounted", async () => {
    const open = await prepareAccommodationCheckout();
    const controller = new AbortController();
    const pending = open("code", { signal: controller.signal });
    sdk.resume.mock.calls[0][1].onLoad({ id: "checkout-id" });
    controller.abort();
    await expect(pending).resolves.toEqual({ status: "cancelled" });
    expect(sdk.cancel).toHaveBeenCalledWith("checkout-id");
  });

  it("does not open a checkout without an access code or after navigation", async () => {
    const open = await prepareAccommodationCheckout();
    await expect(open(undefined)).rejects.toThrow("Check payment status");
    const controller = new AbortController();
    controller.abort();
    await expect(open("code", { signal: controller.signal })).resolves.toEqual({
      status: "cancelled",
    });
    expect(sdk.resume).not.toHaveBeenCalled();
  });
});

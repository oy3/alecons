// Import only after a browser action: the website also renders on the server.
export async function prepareAccommodationCheckout() {
  if (typeof window === "undefined")
    throw new Error("Checkout is only available in your browser.");
  const { default: PaystackPop } = await import("@paystack/inline-js");

  return (accessCode, { signal, onLoad } = {}) =>
    new Promise((resolve, reject) => {
      if (!accessCode)
        return reject(
          new Error(
            "Payment checkout is unavailable. Check payment status before retrying.",
          ),
        );
      if (signal?.aborted) return resolve({ status: "cancelled" });
      const popup = new PaystackPop();
      let settled = false;
      let transactionId;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener("abort", abort);
        resolve(result);
      };
      const abort = () => {
        finish({ status: "cancelled" });
        if (transactionId) {
          try {
            popup.cancelTransaction(transactionId);
          } catch {
            /* Verification remains server-side. */
          }
        }
      };
      signal?.addEventListener("abort", abort, { once: true });
      try {
        popup.resumeTransaction(accessCode, {
          onLoad: (transaction) => {
            transactionId = transaction?.id;
            if (!settled) onLoad?.();
          },
          onSuccess: () => finish({ status: "success" }),
          onCancel: () => finish({ status: "cancelled" }),
          onError: (failure) =>
            finish({
              status: "error",
              message: failure?.message || "Checkout could not be opened.",
            }),
        });
      } catch (failure) {
        finish({
          status: "error",
          message: failure?.message || "Checkout could not be opened.",
        });
      }
    });
}

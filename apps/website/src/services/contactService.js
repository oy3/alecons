const CONTACT_ENDPOINT = import.meta.env.VITE_CONTACT_FORM_ENDPOINT?.trim();

export class ContactEndpointUnavailableError extends Error {
  constructor() {
    super("Online form delivery is being configured. Please email admissions@alecons.edu.ng or call the admissions office.");
    this.name = "ContactEndpointUnavailableError";
  }
}

export async function submitContactEnquiry(payload) {
  if (!CONTACT_ENDPOINT) throw new ContactEndpointUnavailableError();

  const response = await fetch(CONTACT_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "We could not send your enquiry. Please try again or contact Admissions directly.");
  return data;
}

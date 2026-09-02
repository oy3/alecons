import { publicApiService } from "./publicApi";

export async function submitContactEnquiry(payload) {
  return publicApiService.submitContactEnquiry(payload);
}

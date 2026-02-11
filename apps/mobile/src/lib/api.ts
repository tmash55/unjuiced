import { createApiClient } from "@unjuiced/api";
import { mobileEnv } from "@/src/config/env";

export const api = createApiClient({
  baseUrl: mobileEnv.apiBaseUrl
});

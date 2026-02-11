import Constants from "expo-constants";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
const apiBaseUrlRaw = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

if (!supabaseUrl) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY");
}

if (!apiBaseUrlRaw) {
  throw new Error("Missing EXPO_PUBLIC_API_BASE_URL");
}

function resolveApiBaseUrl(baseUrl: string): string {
  if (Platform.OS === "web") return baseUrl;

  try {
    const parsed = new URL(baseUrl);
    const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";

    if (!isLocalhost) return baseUrl;

    const hostUri =
      Constants.expoConfig?.hostUri ||
      (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ||
      (Constants as any).manifest?.debuggerHost;

    const host = typeof hostUri === "string" ? hostUri.split(":")[0] : "";
    if (!host) return baseUrl;

    parsed.hostname = host;
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return baseUrl;
  }
}

export const mobileEnv = {
  supabaseUrl,
  supabaseAnonKey,
  apiBaseUrl: resolveApiBaseUrl(apiBaseUrlRaw)
};

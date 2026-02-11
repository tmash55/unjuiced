import "react-native-url-polyfill/auto";
import "react-native-get-random-values";
import * as SecureStore from "expo-secure-store";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import { mobileEnv } from "@/src/config/env";

const webStorage = {
  getItem: async (key: string) => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  }
};

const nativeStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key)
};

const secureStore = {
  getItem: async (key: string) => {
    if (Platform.OS === "web") return webStorage.getItem(key);
    return nativeStorage.getItem(key);
  },
  setItem: async (key: string, value: string) => {
    if (Platform.OS === "web") return webStorage.setItem(key, value);
    return nativeStorage.setItem(key, value);
  },
  removeItem: async (key: string) => {
    if (Platform.OS === "web") return webStorage.removeItem(key);
    return nativeStorage.removeItem(key);
  }
};

export const supabase = createClient(mobileEnv.supabaseUrl, mobileEnv.supabaseAnonKey, {
  auth: {
    storage: secureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
});

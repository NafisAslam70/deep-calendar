// lib/config.js
import AsyncStorage from "@react-native-async-storage/async-storage";

export const DEFAULT_API_BASE = "https://deep-calendar.vercel.app";
const KEY_BASE = "dc_base";

export async function getApiBase() {
  try {
    const raw = (await AsyncStorage.getItem(KEY_BASE)) || DEFAULT_API_BASE;
    const trimmed = raw.trim().replace(/\/+$/, "");
    // if someone types just "deep-calendar.vercel.app", fix it:
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  } catch {
    return DEFAULT_API_BASE;
  }
}

export async function setApiBase(v) {
  try {
    const cleaned = (v || "").trim().replace(/\/+$/, "");
    await AsyncStorage.setItem(KEY_BASE, cleaned || DEFAULT_API_BASE);
  } catch {
    // ignore
  }
}

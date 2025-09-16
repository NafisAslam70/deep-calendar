// lib/config.js
export const DEFAULT_API_BASE =
  process.env.EXPO_PUBLIC_API_BASE || "https://deep-calendar.vercel.app";

// Keep API_BASE as a simple alias so existing imports work
export const API_BASE = DEFAULT_API_BASE;

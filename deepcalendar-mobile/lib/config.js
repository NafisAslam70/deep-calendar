// Single place to point the mobile app at your web API.
// Set EXPO_PUBLIC_API_BASE in app.json or .env for device testing.
// Fallback keeps dev happy on iOS simulator.
// export const API_BASE =
//   (process.env.EXPO_PUBLIC_API_BASE || "http://localhost:3001").replace(/\/$/, "");

// lib/config.js
export const DEFAULT_API_BASE =
  "https://deep-calendar-aoly14e7i-nafisaslam70-gmailcoms-projects.vercel.app";

export const StorageKeys = {
  token: "dc_token",
  apiBase: "dc_api_base",
};

export function withBase(base, path) {
  const b = (base || DEFAULT_API_BASE).replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}



  
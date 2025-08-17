// lib/baseUrl.ts
export const baseUrl =
  (typeof window !== "undefined" && window.location.origin) ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "https://deep-calendar-aoly14e7i-nafisaslam70-gmailcoms-projects.vercel.app";

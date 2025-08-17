// Single place to point the mobile app at your web API.
// Set EXPO_PUBLIC_API_BASE in app.json or .env for device testing.
// Fallback keeps dev happy on iOS simulator.
export const API_BASE =
  (process.env.EXPO_PUBLIC_API_BASE || "http://localhost:3001").replace(/\/$/, "");




  
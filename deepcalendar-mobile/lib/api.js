// lib/api.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBase } from "./config";

const KEY_TOKEN = "dc_token";

export async function getToken() {
  try { return (await AsyncStorage.getItem(KEY_TOKEN)) || null; } catch { return null; }
}
export async function setToken(t) {
  try { await AsyncStorage.setItem(KEY_TOKEN, t || ""); } catch {}
}

export async function request(path, opts = {}) {
  const { method = "GET", body, headers, token } = opts;
  const base = await getApiBase();
  const t = token ?? (await getToken());
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(headers || {}),
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: "include", // ensure cookies (Next.js sets dc_token cookie)
    });

    const ct = res.headers.get("content-type") || "";
    const json = ct.includes("application/json") ? await res.json().catch(() => ({})) : {};

    if (!res.ok) {
      const msg = json?.error || `${res.status} ${res.statusText}`;
      const err = new Error(msg);
      err.status = res.status;
      err.json = json;
      throw err;
    }
    return json;
  } catch (e) {
    // 🔎 temporary debug: see exactly what we tried to call
    console.log("request() network error ->", url, String(e?.message || e));
    throw e;
  }
}

export const api = {
  get: (p, o) => request(p, { ...(o || {}), method: "GET" }),
  post: (p, b, o) => request(p, { ...(o || {}), method: "POST", body: b }),
  patch: (p, b, o) => request(p, { ...(o || {}), method: "PATCH", body: b }),
  del: (p, o) => request(p, { ...(o || {}), method: "DELETE" }),
};

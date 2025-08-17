// Super-thin API client used across screens.

const DEFAULT_BASE = "http://localhost:3001";

let state = {
  base: DEFAULT_BASE,
  token: null,
};

export function setBase(url) {
  state.base = (url || DEFAULT_BASE).replace(/\/+$/, "");
  try { if (typeof localStorage !== "undefined") localStorage.setItem("dc_base", state.base); } catch {}
}

export function getBase() {
  if (state.base) return state.base;
  try { const v = localStorage.getItem("dc_base"); if (v) state.base = v; } catch {}
  return state.base || DEFAULT_BASE;
}

export function setToken(tok) {
  state.token = tok || null;
  try { if (typeof localStorage !== "undefined") localStorage.setItem("dc_token", state.token || ""); } catch {}
}
export function getToken() {
  if (state.token) return state.token;
  try {
    if (typeof localStorage !== "undefined") {
      const v = localStorage.getItem("dc_token");
      if (v) state.token = v;
    }
  } catch {}
  return state.token;
}

async function req(method, path, body) {
  const base = getBase();
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const isJson = r.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await r.json().catch(() => ({})) : {};
  if (!r.ok) {
    const msg = data?.error || `${r.status} ${r.statusText}`;
    throw new Error(msg);
  }
  return data;
}

export const api = {
  get: (p) => req("GET", p),
  post: (p, b) => req("POST", p, b),
  patch: (p, b) => req("PATCH", p, b),
  del: (p) => req("DELETE", p),
};

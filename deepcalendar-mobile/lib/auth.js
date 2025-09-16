// lib/auth.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_API_BASE } from "./config";

const KEY_TOKEN = "dc_token";
const KEY_BASE  = "dc_base";

const AuthCtx = createContext({
  user: null,
  token: null,
  loading: true,
  signIn: async (_email, _password) => {},
  signOut: async () => {},
});

export async function getApiBase() {
  try {
    const raw = (await AsyncStorage.getItem(KEY_BASE)) || DEFAULT_API_BASE;
    const trimmed = String(raw).trim().replace(/\/+$/, "");
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  } catch {
    return DEFAULT_API_BASE;
  }
}

export async function setApiBase(v) {
  try {
    const cleaned = String(v || "").trim().replace(/\/+$/, "");
    await AsyncStorage.setItem(KEY_BASE, cleaned || DEFAULT_API_BASE);
  } catch {}
}

/** Token-aware JSON fetch */
export async function fetchJson(path, { method = "GET", body, token, headers } = {}) {
  const base = await getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  // Auto-read token if not provided
  let tok = token;
  if (!tok) {
    try { tok = await AsyncStorage.getItem(KEY_TOKEN); } catch {}
  }

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const json = isJson ? await res.json().catch(() => ({})) : {};
  return { ok: res.ok, status: res.status, json };
}

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken]     = useState(null);
  const [user, setUser]       = useState(null);

  useEffect(() => {
    (async () => {
      try {
        await getApiBase(); // normalize base
        const t = await AsyncStorage.getItem(KEY_TOKEN);
        setToken(t || null);
        if (t) {
          const me = await fetchJson("/api/auth/me");
          if (me.ok) setUser(me.json.user || { id: me.json.id, email: me.json.email });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function signIn(email, password) {
    const r = await fetchJson("/api/auth/signin", { method: "POST", body: { email, password } });
    if (!r.ok) throw new Error(r.json?.error || "Invalid credentials");

    const tok = r.json?.token;
    if (!tok) throw new Error("No token returned");
    await AsyncStorage.setItem(KEY_TOKEN, tok);
    setToken(tok);

    const me = await fetchJson("/api/auth/me");
    if (me.ok) setUser(me.json.user || { id: me.json.id, email: me.json.email });
    return true;
  }

  async function signOut() {
    await AsyncStorage.removeItem(KEY_TOKEN);
    setToken(null);
    setUser(null);
  }

  const value = useMemo(() => ({ loading, user, token, signIn, signOut }), [loading, user, token]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

export { DEFAULT_API_BASE };

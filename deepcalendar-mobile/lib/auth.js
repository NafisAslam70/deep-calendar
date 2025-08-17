// lib/auth.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiBase, setApiBase as persistBase, DEFAULT_API_BASE } from "./config";


const KEY_TOKEN = "dc_token";

const AuthCtx = createContext({
  user: null,
  token: null,
  loading: true,
  signIn: async (_email, _password) => {},
  signOut: async () => {},
});

/** Safe JSON fetch that respects the dynamic API base + bearer token */
async function fetchJson(path, { method = "GET", body, token, headers } = {}) {
  const base = await getApiBase();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const json = isJson ? await res.json().catch(() => ({})) : {};
  return { ok: res.ok, status: res.status, json };
}

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [token, setToken]   = useState(null);
  const [user, setUser]     = useState(null);

  // bootstrap: read token, validate, load /me
  useEffect(() => {
    (async () => {
      try {
        await getApiBase(); // ensures base exists (and normalizes it)
        const t = await AsyncStorage.getItem(KEY_TOKEN);
        setToken(t || null);

        if (t) {
          const me = await fetchJson("/api/auth/me", { token: t });
          if (me.ok) setUser(me.json.user || { id: me.json.id, email: me.json.email });
          else setUser(null);
        } else {
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function signIn(email, password) {
    const r = await fetchJson("/api/auth/signin", {
      method: "POST",
      body: { email, password },
    });
    if (!r.ok) throw new Error(r.json?.error || "Invalid credentials");

    const tok = r.json?.token;
    if (!tok) throw new Error("No token returned by server");

    await AsyncStorage.setItem(KEY_TOKEN, tok);
    setToken(tok);

    const me = await fetchJson("/api/auth/me", { token: tok });
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

// (optional) re-export if other screens import it from here
export { fetchJson };

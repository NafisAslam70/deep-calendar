// lib/auth.js
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DEFAULT_API_BASE, StorageKeys, withBase } from "./config";

/** tiny fetch helper that auto-attaches Authorization if token present */
async function fetchJson(path, { method = "GET", headers = {}, body, token, base } = {}) {
  const url = withBase(base, path);
  const h = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };
  const res = await fetch(url, { method, headers: h, body });
  const isJson = res.headers.get("content-type")?.includes("application/json");
  const json = isJson ? await res.json().catch(() => ({})) : {};
  return { ok: res.ok, status: res.status, json };
}

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [base, setBase] = useState(DEFAULT_API_BASE); // default to Vercel prod
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // boot: load saved base + token
  useEffect(() => {
    (async () => {
      try {
        const [savedBase, savedToken] = await Promise.all([
          AsyncStorage.getItem(StorageKeys.apiBase),
          AsyncStorage.getItem(StorageKeys.token),
        ]);
        if (savedBase) setBase(savedBase);
        if (savedToken) setToken(savedToken);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // whoami when token changes
  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    (async () => {
      const r = await fetchJson("/api/auth/me", { token, base });
      if (r.ok) setUser(r.json.user || null);
      else setUser(null);
    })();
  }, [token, base]);

  const signIn = useCallback(
    async (email, password) => {
      const r = await fetchJson("/api/auth/signin", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        base,
      });
      if (!r.ok) throw new Error(r.json?.error || "Sign-in failed");
      const tok = r.json?.token;
      const u = r.json?.user || null;
      if (!tok) throw new Error("No token returned");
      setToken(tok);
      setUser(u);
      await AsyncStorage.setItem(StorageKeys.token, tok);
      return u;
    },
    [base]
  );

  const signOut = useCallback(async () => {
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(StorageKeys.token);
  }, []);

  const updateBase = useCallback(async (nextBase) => {
    const clean = (nextBase || DEFAULT_API_BASE).replace(/\/+$/, "");
    setBase(clean);
    await AsyncStorage.setItem(StorageKeys.apiBase, clean);
  }, []);

  const value = useMemo(
    () => ({
      user,
      token,
      base,
      loading,
      signIn,
      signOut,
      setBase: updateBase,
      fetchJson: (path, opts = {}) => fetchJson(path, { ...opts, token, base }),
    }),
    [user, token, base, loading, signIn, signOut, updateBase]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

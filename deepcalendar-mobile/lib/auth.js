import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, setToken, setBase, getBase, getToken } from "./api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [token, _setTok] = useState(getToken());
  const [user, setUser] = useState(null);
  const [base, _setBase] = useState(getBase());

  useEffect(() => {
    (async () => {
      try {
        if (!token) return;
        const me = await api.get("/api/auth/me");
        setUser(me?.user || null);
      } catch {
        _setTok(null); setToken(null); setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  function setTok(t) { _setTok(t); setToken(t); }
  function setSrv(b) { _setBase(b); setBase(b); }

  const value = useMemo(() => ({
    loading, user, token, base,
    setBase: setSrv,
    async signIn(email, password) {
      const res = await api.post("/api/auth/signin", { email, password });
      const tok = res?.token;
      if (!tok) throw new Error("No token returned");
      setTok(tok);
      setUser(res?.user || null);
      return true;
    },
    async signOut() {
      try { await api.post("/api/auth/signout"); } catch {}
      setTok(null); setUser(null);
      return true;
    },
  }), [loading, user, token, base]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

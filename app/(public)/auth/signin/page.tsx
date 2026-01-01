"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signinError, setSigninError] = useState<string | null>(null);
  const [signinBusy, setSigninBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetStage, setResetStage] = useState<"request" | "confirm">("request");
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const search = useSearchParams();
  const next = search.get("next") || "/";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSigninError(null);
    setSigninBusy(true);
    const r = await fetch("/api/auth/signin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (r.ok) location.href = next;
    else setSigninError("Invalid credentials. You can reset your password below.");
    setSigninBusy(false);
  }

  async function requestReset(e: React.FormEvent) {
    e.preventDefault();
    setResetBusy(true);
    setResetError(null);
    setResetMessage(null);
    const r = await fetch("/api/auth/reset/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetEmail || email }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setResetError(j?.error || "Could not start reset");
    } else {
      const devTok = (j as { devToken?: string })?.devToken;
      if (devTok) setResetToken(devTok);
      setResetStage("confirm");
      setResetMessage("If that email exists, a reset link was sent. For local dev, use the token below.");
    }
    setResetBusy(false);
  }

  async function confirmReset(e: React.FormEvent) {
    e.preventDefault();
    setResetBusy(true);
    setResetError(null);
    setResetMessage(null);
    const r = await fetch("/api/auth/reset/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: resetToken, password: resetPassword }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setResetMessage("Password updated. Redirecting…");
      setTimeout(() => { location.href = next; }, 400);
    } else {
      setResetError(j?.error || "Reset failed. Check token and try again.");
    }
    setResetBusy(false);
  }

  return (
    <div className="mx-auto max-w-sm p-6">
      <h1 className="mb-4 text-2xl font-bold">Sign in</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {signinError && <p className="text-sm text-red-600">{signinError}</p>}
        <button className="w-full rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60" disabled={signinBusy}>
          {signinBusy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-3 text-sm text-gray-600">
        No account?{" "}
        <a className="underline" href={`/auth/signup?next=${encodeURIComponent(next)}`}>
          Sign up
        </a>
      </p>
      <div className="mt-6 rounded-2xl border p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Forgot password?</h2>
          <button className="text-sm underline" onClick={() => setResetOpen((v) => !v)}>
            {resetOpen ? "Hide" : "Reset"}
          </button>
        </div>
        {resetOpen && (
          <div className="mt-3 space-y-3">
            {resetStage === "request" ? (
              <form className="space-y-3" onSubmit={requestReset}>
                <input
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="Email"
                  value={resetEmail || email}
                  onChange={(e) => setResetEmail(e.target.value)}
                />
                <button
                  className="w-full rounded-lg border px-4 py-2 text-sm"
                  disabled={resetBusy}
                >
                  {resetBusy ? "Sending…" : "Send reset link"}
                </button>
              </form>
            ) : (
              <form className="space-y-3" onSubmit={confirmReset}>
                <input
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="Reset token"
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                />
                <input
                  className="w-full rounded-lg border px-3 py-2"
                  placeholder="New password"
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <button type="button" className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => { setResetStage("request"); setResetToken(""); setResetPassword(""); setResetMessage(null); }}>
                    Start over
                  </button>
                  <button className="flex-1 rounded-lg bg-black px-4 py-2 text-white disabled:opacity-60" disabled={resetBusy}>
                    {resetBusy ? "Resetting…" : "Reset password"}
                  </button>
                </div>
              </form>
            )}
            {resetMessage && <p className="text-sm text-emerald-700">{resetMessage}</p>}
            {resetError && <p className="text-sm text-red-600">{resetError}</p>}
            {resetStage === "confirm" && !resetToken && (
              <p className="text-xs text-gray-500">Check your email for a reset link. In dev, the token is returned in the response.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignInPage() {
  // Fix: wrap useSearchParams in Suspense for CSR bailout
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm p-6">Loading…</div>}>
      <SignInForm />
    </Suspense>
  );
}

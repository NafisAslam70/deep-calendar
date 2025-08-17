"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";

/* helpers */
async function apiJson(input: RequestInfo, init?: RequestInit) {
  const r = await fetch(input, init);
  const j = r.headers.get("content-type")?.includes("application/json")
    ? await r.json().catch(() => ({}))
    : {};
  return { ok: r.ok, status: r.status, json: j };
}
function fmt(dt?: string | null) {
  if (!dt) return "—";
  try { return new Date(dt).toLocaleString(); } catch { return dt; }
}

/* Confirm dialog (simple, consistent with app) */
function ConfirmDialog({
  open, title, body, confirmText = "Confirm", destructive = false, onCancel, onConfirm,
}:{
  open: boolean; title: string; body?: React.ReactNode; confirmText?: string; destructive?: boolean;
  onCancel: () => void; onConfirm: () => void | Promise<void>;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="text-lg font-semibold">{title}</div>
        {body && <div className="mt-2 text-sm text-gray-700">{body}</div>}
        <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button className="rounded-lg border px-4 py-2" onClick={onCancel}>Cancel</button>
          <button
            className={`rounded-lg px-4 py-2 text-white ${destructive ? "bg-red-600" : "bg-black"}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* Small copy button with feedback */
function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [ok, setOk] = useState<null | boolean>(null);
  return (
    <button
      className="rounded-lg border px-2 py-1 text-xs"
      onClick={() => {
        navigator.clipboard.writeText(text).then(
          () => { setOk(true); setTimeout(() => setOk(null), 1200); },
          () => { setOk(false); setTimeout(() => setOk(null), 1200); },
        );
      }}
      aria-live="polite"
    >
      {ok === true ? "Copied ✓" : ok === false ? "Failed" : label}
    </button>
  );
}

export default function AccountPage() {
  const router = useRouter();

  const [auth, setAuth] = useState<"loading" | "authed" | "anon">("loading");
  const [user, setUser] = useState<{id: number; email: string; name?: string | null} | null>(null);

  const [pk, setPk] = useState<string | null>(null);
  const [pkCreated, setPkCreated] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState(false);

  // confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmCb = useRef<() => void>(() => {});
  const [confirmTitle, setConfirmTitle] = useState("Confirm?");
  const [confirmBody, setConfirmBody] = useState<React.ReactNode>(null);
  const [confirmText, setConfirmText] = useState("Confirm");
  const [confirmDestructive, setConfirmDestructive] = useState(false);

  function askConfirm(opts: {
    title: string; body?: React.ReactNode; confirmText?: string; destructive?: boolean; onConfirm: () => void | Promise<void>;
  }) {
    setConfirmTitle(opts.title);
    setConfirmBody(opts.body ?? null);
    setConfirmText(opts.confirmText ?? "Confirm");
    setConfirmDestructive(!!opts.destructive);
    confirmCb.current = () => void opts.onConfirm();
    setConfirmOpen(true);
  }

  /* load me */
  useEffect(() => {
    (async () => {
      const { ok, status, json } = await apiJson("/api/auth/me");
      if (ok) { setAuth("authed"); setUser(json.user); }
      else if (status === 401) { setAuth("anon"); }
      else { setAuth("anon"); }
    })();
  }, []);

  /* redirect anon */
  useEffect(() => {
    if (auth === "anon") {
      const next = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/account";
      router.replace(`/auth/signin?next=${encodeURIComponent(next)}`);
    }
  }, [auth, router]);

  /* load token */
  async function loadToken() {
    const { ok, json } = await apiJson("/api/public/token");
    if (ok) { setPk(json.publicKey ?? null); setPkCreated(json.createdAt ?? null); }
  }
  useEffect(() => {
    if (auth === "authed") loadToken();
  }, [auth]);

  const origin = useMemo(() => (typeof window !== "undefined" ? window.location.origin : ""), []);
  const token = pk || "<YOUR_TOKEN>";
  const base = `${origin || "https://your-domain.com"}/api/public/${token}`;

  async function genOrRotate() {
    askConfirm({
      title: pk ? "Rotate API token?" : "Generate API token?",
      body: pk ? "Old token will stop working immediately." : "This enables public, read-only endpoints.",
      confirmText: pk ? "Rotate" : "Generate",
      destructive: !!pk,
      onConfirm: async () => {
        setBusy(true);
        const { ok, json } = await apiJson("/api/public/token", { method: "POST" });
        setBusy(false);
        setConfirmOpen(false);
        if (ok) { setPk(json.publicKey); setPkCreated(json.createdAt ?? null); setReveal(true); }
        else alert("Failed to generate or rotate token.");
      }
    });
  }

  async function disable() {
    if (!pk) return;
    askConfirm({
      title: "Disable API token?",
      body: "Public endpoints will stop working.",
      confirmText: "Disable",
      destructive: true,
      onConfirm: async () => {
        setBusy(true);
        const { ok } = await apiJson("/api/public/token", { method: "DELETE" });
        setBusy(false);
        setConfirmOpen(false);
        if (ok) { setPk(null); setPkCreated(null); setReveal(false); }
        else alert("Failed to disable token.");
      }
    });
  }

  if (auth !== "authed") {
    return <div className="mx-auto max-w-3xl p-5"><div className="text-sm text-gray-500">Loading…</div></div>;
  }

  return (
    <div className="mx-auto max-w-3xl p-5 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="text-sm text-gray-600">Profile & public API token for DeepCalendar embeds.</p>
      </header>

      {/* Profile */}
      <section className="rounded-2xl border p-4">
        <h2 className="mb-3 text-lg font-semibold">Profile</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Name</div>
            <div className="font-medium truncate">{user?.name || "—"}</div>
          </div>
          <div className="rounded-lg bg-gray-50 p-3">
            <div className="text-xs text-gray-500">Email</div>
            <div className="font-medium truncate">{user?.email}</div>
          </div>
        </div>
      </section>

      {/* API token — compact, mobile-first */}
      <section className="rounded-2xl border p-4">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Public API Token</h2>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              disabled={busy}
              onClick={genOrRotate}
              className="rounded-lg bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {pk ? "Rotate token" : "Generate token"}
            </button>
            {pk && (
              <button
                disabled={busy}
                onClick={disable}
                className="rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Disable
              </button>
            )}
          </div>
        </div>

        {!pk ? (
          <p className="text-sm text-gray-600">
            No token yet. Generate one to expose read-only endpoints (routine, goals, stats).
          </p>
        ) : (
          <>
            {/* Token line */}
            <div className="rounded-xl border p-3">
              <div className="text-xs text-gray-500">Token</div>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="font-mono text-sm truncate">
                  {reveal ? pk : "•".repeat(Math.min(pk.length, 16)) + "…"}
                </div>
                <div className="flex items-center gap-2">
                  <button className="rounded-lg border px-2 py-1 text-xs" onClick={() => setReveal(s => !s)}>
                    {reveal ? "Hide" : "Reveal"}
                  </button>
                  <CopyButton text={pk!} />
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-600">Created / Rotated: {fmt(pkCreated)}</div>
            </div>

            {/* Endpoints — concise, responsive 1→2 columns */}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <EndpointCard
                title="Summary (30d)"
                url={`${base}/summary?range=30d`}
              />
              <EndpointCard
                title="Routine (all days)"
                url={`${base}/routine`}
              />
              <EndpointCard
                title="Goals (active)"
                url={`${base}/goals`}
              />
              <EndpointCard
                title="Stats (7d)"
                url={`${base}/stats?range=7d`}
              />
            </div>

            {/* Advanced (collapsed) */}
            <details className="mt-4 rounded-xl border p-3">
              <summary className="cursor-pointer text-sm font-semibold">Advanced: cURL examples</summary>
              <pre className="mt-2 overflow-auto rounded bg-black p-3 text-[11px] leading-relaxed text-white">
{`# Summary (last 30 days)
curl -s ${base}/summary?range=30d | jq .

# Routine for Wednesday
curl -s ${base}/routine?weekday=3 | jq .

# Goals
curl -s ${base}/goals | jq .

# Stats for custom range
curl -s '${base}/stats?from=2025-08-01&to=2025-08-31' | jq .`}
              </pre>
            </details>
          </>
        )}
      </section>

      {/* Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        body={confirmBody}
        confirmText={confirmText}
        destructive={confirmDestructive}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => confirmCb.current()}
      />
    </div>
  );
}

/* Small endpoint card */
function EndpointCard({ title, url }: { title: string; url: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <div className="text-xs font-semibold">{title}</div>
      <div className="mt-1 truncate font-mono text-xs">{url}</div>
      <div className="mt-2 flex flex-wrap gap-2">
        <CopyButton text={url} label="Copy URL" />
        <a className="rounded-lg border px-2 py-1 text-xs" href={url} target="_blank" rel="noreferrer">Open</a>
      </div>
    </div>
  );
}

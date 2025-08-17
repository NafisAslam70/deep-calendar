"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Footer from "./_components/Footer";

/* tiny helper */
async function apiJson(input: RequestInfo, init?: RequestInit) {
  const r = await fetch(input, init);
  const j = r.headers.get("content-type")?.includes("application/json")
    ? await r.json().catch(() => ({}))
    : {};
  return { ok: r.ok, status: r.status, json: j };
}

/* confirm dialog */
function ConfirmDialog({
  open, title, body, confirmText = "Confirm", destructive = false, onCancel, onConfirm,
}:{
  open: boolean; title: string; body?: React.ReactNode; confirmText?: string; destructive?: boolean;
  onCancel: () => void; onConfirm: () => void | Promise<void>;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="text-lg font-semibold">{title}</div>
        {body && <div className="mt-2 text-sm text-gray-700">{body}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg border px-4 py-2" onClick={onCancel}>Cancel</button>
          <button className={`rounded-lg px-4 py-2 text-white ${destructive ? "bg-red-600" : "bg-black"}`} onClick={onConfirm}>
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const triedRef = useRef(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    (async () => {
      if (triedRef.current) return;
      triedRef.current = true;
      const { ok, json } = await apiJson("/api/auth/me");
      if (ok) {
        setIsAuthed(true);
        setUserName(json?.user?.name || json?.user?.email || null);
      } else {
        setIsAuthed(false);
      }
    })();
  }, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  async function doSignOut() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } finally {
      const next = encodeURIComponent("/");
      window.location.href = `/auth/signin?next=${next}`;
    }
  }

  return (
    <section className="min-h-screen flex flex-col">
      <nav className="sticky top-0 z-10 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="font-semibold">DeepCalendar</Link>

          {/* scrollable tab row on mobile */}
          <div className="max-w-[60%] sm:max-w-none overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none]"
               style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="flex items-center gap-1 sm:gap-2">
              <Link href="/" className={`whitespace-nowrap rounded-lg px-3 py-1.5 hover:bg-gray-100 ${isActive("/") ? "bg-black text-white hover:bg-black" : ""}`}>Dashboard</Link>
              <Link href="/deep-calendar" className={`whitespace-nowrap rounded-lg px-3 py-1.5 hover:bg-gray-100 ${isActive("/deep-calendar") ? "bg-black text-white hover:bg-black" : ""}`}>Your Deep Calendar</Link>
              <Link href="/routine" className={`whitespace-nowrap rounded-lg px-3 py-1.5 hover:bg-gray-100 ${isActive("/routine") ? "bg-black text-white hover:bg-black" : ""}`}>Your Deep Routine</Link>
              <Link href="/goals" className={`whitespace-nowrap rounded-lg px-3 py-1.5 hover:bg-gray-100 ${isActive("/goals") ? "bg-black text-white hover:bg-black" : ""}`}>Goals</Link>
            </div>
          </div>

          {/* auth */}
          <div className="ml-2 flex items-center gap-2">
            {isAuthed === null ? (
              <span className="text-sm text-gray-500">…</span>
            ) : isAuthed ? (
              <>
                <span className="hidden sm:inline text-sm text-gray-700">Hello{userName ? `, ${userName}` : ""}</span>
                <Link className="rounded-lg border px-3 py-1.5 text-sm" href="/account">Account</Link>
                <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => setConfirmOpen(true)}>Sign out</button>
              </>
            ) : (
              <>
                <Link className="rounded-lg border px-3 py-1.5 text-sm" href={`/auth/signin?next=${encodeURIComponent(pathname || "/")}`}>Sign in</Link>
                <Link className="rounded-lg bg-black px-3 py-1.5 text-sm text-white" href="/auth/signup">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl w-full flex-1 px-4 py-6">{children}</main>

      <Footer />

      {/* sign out confirm */}
      <ConfirmDialog
        open={confirmOpen}
        title="Sign out?"
        body="You will be redirected to the sign-in page."
        destructive
        confirmText="Sign out"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={async () => {
          setConfirmOpen(false);
          await doSignOut();
        }}
      />
    </section>
  );
}

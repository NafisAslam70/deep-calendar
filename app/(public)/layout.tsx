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
  const [theme, setTheme] = useState<"day" | "night">("day");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const Moon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />
    </svg>
  );
  const Sun = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2m0 18v2m11-11h-2M5 12H3m15.364 6.364-1.414-1.414M6.05 6.05 4.636 4.636m12.728 0L16.95 6.05M6.05 17.95l-1.414 1.414" />
    </svg>
  );
  const UserIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Z" />
      <path d="M4 20c0-2.667 3.333-4 8-4s8 1.333 8 4" />
    </svg>
  );

  useEffect(() => {
    const stored = (typeof window !== "undefined" && localStorage.getItem("dc_theme")) as "day" | "night" | null;
    if (stored === "day" || stored === "night") {
      setTheme(stored);
      document.documentElement.dataset.theme = stored;
      return;
    }
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const initial = prefersDark ? "night" : "day";
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (typeof window !== "undefined") {
      localStorage.setItem("dc_theme", theme);
    }
  }, [theme]);

  // close user menu on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }
  }, [menuOpen]);

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
    <section
      data-theme={theme}
      className="min-h-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300"
    >
      <nav className="sticky top-0 z-10 border-b surface-blur text-[var(--foreground)]">
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
              <Link href="/community" className={`whitespace-nowrap rounded-lg px-3 py-1.5 hover:bg-gray-100 ${isActive("/community") ? "bg-black text-white hover:bg-black" : ""}`}>Community</Link>
            </div>
          </div>

          {/* auth */}
          <div className="ml-2 flex items-center gap-2">
            <button
              className="flex h-10 w-10 items-center justify-center rounded-xl border bg-[var(--card)] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
              onClick={() => setTheme((t) => (t === "day" ? "night" : "day"))}
              title="Toggle day/night mode"
              aria-label="Toggle theme"
            >
              {theme === "day" ? <Moon /> : <Sun />}
            </button>
            {isAuthed === null ? (
              <span className="text-sm text-gray-500">…</span>
            ) : isAuthed ? (
              <div className="relative" ref={menuRef}>
                <button
                  aria-label="Open user menu"
                  onClick={() => setMenuOpen((v) => !v)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border bg-[var(--card)] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                >
                  <UserIcon />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border bg-white text-sm shadow-lg ring-1 ring-black/5">
                    <div className="px-3 py-2 text-xs text-gray-500">
                      Hello{userName ? `, ${userName}` : ""}
                    </div>
                    <Link
                      href="/account"
                      className="block px-3 py-2 hover:bg-gray-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      My account
                    </Link>
                    <Link
                      href="/community"
                      className="block px-3 py-2 hover:bg-gray-50"
                      onClick={() => setMenuOpen(false)}
                    >
                      Community
                    </Link>
                    <button
                      className="block w-full px-3 py-2 text-left hover:bg-gray-50"
                      onClick={() => { setMenuOpen(false); setConfirmOpen(true); }}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link className="rounded-lg border px-3 py-1.5 text-sm" href={`/auth/signin?next=${encodeURIComponent(pathname || "/")}`}>Sign in</Link>
                <Link className="rounded-lg bg-black px-3 py-1.5 text-sm text-white" href="/auth/signup">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-6xl w-full flex-1 px-4 py-6">
        <div className="space-y-6">{children}</div>
      </main>

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

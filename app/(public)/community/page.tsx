"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Profile = {
  id: number;
  displayName: string | null;
  contactEmail: string | null;
  contactWhatsApp: string | null;
  optedIn: boolean;
  userName?: string | null;
};

const ShareIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path d="M12 16V4" />
    <path d="m8 8 4-4 4 4" />
  </svg>
);

const WhatsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 12a8 8 0 1 1-3.3-6.4L20 4l-.6 3.7A7.96 7.96 0 0 1 20 12Z" />
    <path d="M8 9c.5 1 1.5 2 2.5 2.5 1 .5 1.5 1 2.5.5l1.5 1.5" />
  </svg>
);

const MailIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

export default function CommunityPage() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [shareOrigin, setShareOrigin] = useState("");

  const [optedIn, setOptedIn] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactWhatsApp, setContactWhatsApp] = useState("");
  const [savingProfile, setSavingProfile] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [profileOpen, setProfileOpen] = useState(false);
  const shareLinks = publicToken && shareOrigin
    ? [
        { label: "Goals", href: `${shareOrigin}/share/${publicToken}?view=goals`, desc: "Share your current goals." },
        { label: "Deep Routine", href: `${shareOrigin}/share/${publicToken}?view=routine`, desc: "Share your weekly deep work routine." },
        { label: "Shutdown report", href: `${shareOrigin}/share/${publicToken}?view=shutdown`, desc: "Share a shutdown/end-of-day view." },
      ]
    : [];
  const [creatingToken, setCreatingToken] = useState(false);

  const shareViaWebAPI = async (href: string, title: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: href, text: `Check this out: ${href}` });
      } catch {
        /* ignore */
      }
    }
  };

  async function loadData() {
    setLoading(true);
    try {
    const [membersRes, profileRes] = await Promise.all([
      fetch("/api/community/members"),
      fetch("/api/community/profile"),
      fetch("/api/public/token"),
    ]);
      if (membersRes.ok) {
        const memJson = (await membersRes.json()) as { members?: Profile[] };
        setMembers(memJson.members ?? []);
      }
      if (profileRes.ok) {
        const pJson = (await profileRes.json()) as { profile?: Profile | null };
        setProfile(pJson.profile ?? null);
      }
      // token handled separately because of tuple length
      const tokenRes = await fetch("/api/public/token");
      if (tokenRes.ok) {
        const { publicKey } = (await tokenRes.json()) as { publicKey: string | null };
        setPublicToken(publicKey);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareOrigin(window.location.origin);
    }
    if (profile) {
      setOptedIn(profile.optedIn);
      setDisplayName(profile.displayName ?? "");
      setContactEmail(profile.contactEmail ?? "");
      setContactWhatsApp(profile.contactWhatsApp ?? "");
    }
  }, [profile]);

  async function ensureToken() {
    if (publicToken || creatingToken) return;
    setCreatingToken(true);
    try {
      const res = await fetch("/api/public/token", { method: "POST" });
      if (res.ok) {
        const { publicKey } = (await res.json()) as { publicKey: string | null };
        setPublicToken(publicKey);
      }
    } finally {
      setCreatingToken(false);
    }
  }

  async function saveProfile() {
    setSavingProfile("saving");
    try {
      const res = await fetch("/api/community/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          optedIn,
          displayName: displayName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          contactWhatsApp: contactWhatsApp.trim() || null,
        }),
      });
      if (!res.ok) {
        setSavingProfile("error");
        return;
      }
      const { profile: p } = (await res.json()) as { profile: Profile };
      setProfile(p);
      setSavingProfile("saved");
      setTimeout(() => setSavingProfile("idle"), 1500);
    } catch {
      setSavingProfile("error");
    }
  }

  return (
    <div className="mx-auto max-w-6xl p-5 space-y-6 text-slate-900">
      <section className="relative overflow-hidden rounded-3xl border border-gray-200/80 bg-gradient-to-r from-sky-500/10 via-fuchsia-500/10 to-amber-500/10 p-6 shadow-lg">
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">DeepWork Community</p>
            <h1 className="text-3xl font-semibold text-gray-900">Share and stay accountable</h1>
            <p className="text-sm text-gray-700">
              Opt in to the roster and find accountability partners.
            </p>
          </div>
          <Link
            href="/goals"
            className="rounded-full border px-4 py-2 text-sm font-semibold bg-white/80 shadow hover:shadow-md transition"
          >
            Back to goals
          </Link>
        </div>
      </section>

      <section className="rounded-3xl border border-gray-200/80 bg-white/90 p-5 shadow-lg backdrop-blur">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Accountability</p>
            <p className="text-sm text-gray-600">Opt in, set contact info, and appear for partners.</p>
          </div>
          <span className={`rounded-full px-3 py-1 text-[11px] uppercase tracking-[0.18em] ${optedIn ? "border border-emerald-500/50 bg-emerald-100 text-emerald-800" : "border border-gray-200 bg-gray-50 text-gray-600"}`}>
            {optedIn ? "Opted in" : "Not joined"}
          </span>
        </div>
        {!profileOpen ? (
          <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <div className="text-sm text-gray-700">
              {optedIn
                ? "You’re visible to partners. Click to edit contact details."
                : "Hidden from partners. Click to join and share contact info."}
            </div>
            <button
              className="rounded-full border px-3 py-1.5 text-sm font-semibold hover:border-gray-400"
              onClick={() => setProfileOpen(true)}
            >
              Edit profile
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1">
                <span className="text-sm text-gray-600">Display name</span>
                <input
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="What others see"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-600">Contact email (optional)</span>
                <input
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-600">WhatsApp / phone (optional)</span>
                <input
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-900 placeholder:text-gray-400"
                  value={contactWhatsApp}
                  onChange={(e) => setContactWhatsApp(e.target.value)}
                  placeholder="+1 555 123 4567"
                />
              </label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={optedIn}
                    onChange={(e) => setOptedIn(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  Join community roster
                </label>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={saveProfile}
                disabled={savingProfile === "saving"}
                className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white shadow disabled:opacity-50"
              >
                {savingProfile === "saving" ? "Saving..." : savingProfile === "saved" ? "Saved" : "Save profile"}
              </button>
              <button
                className="rounded-full border px-3 py-1.5 text-sm hover:border-gray-400"
                onClick={() => setProfileOpen(false)}
              >
                Close
              </button>
              {savingProfile === "error" && <span className="text-sm text-amber-600">Could not save</span>}
            </div>
          </>
        )}
      </section>

      <section className="rounded-3xl border border-gray-200/80 bg-white/90 p-5 shadow-lg backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Find an accountability partner</h2>
          <span className="text-xs text-gray-600">{members.length} people opted in</span>
        </div>
        <div className="text-xs text-gray-500 mb-3">
          Invite them to join DeepWork Community at <span className="font-semibold">https://deep-calendar.vercel.app/</span>
          {!publicToken && " (Generate a public key below to share your data cards.)"}
        </div>
        {members.length === 0 ? (
          <p className="text-gray-600">No members visible yet. Opt in above to appear here.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {members.map((m) => (
              <div key={m.id} className="rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      {m.displayName || m.userName || "Deep worker"}
                    </div>
                    <div className="text-xs text-gray-600">Focus: goals, routine, shutdown</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.contactEmail && (
                    <a
                      className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-900 transition hover:border-gray-400"
                      href={`mailto:${encodeURIComponent(m.contactEmail)}?subject=DeepWork%20accountability`}
                    >
                      Email
                    </a>
                  )}
                  {m.contactWhatsApp && (
                    <a
                      className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-900 transition hover:border-gray-400"
                      href={`https://wa.me/${encodeURIComponent(m.contactWhatsApp)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                  )}
                  {!m.contactEmail && !m.contactWhatsApp && (
                    <span className="text-xs text-gray-500">No contact info shared</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-gray-200/80 bg-white/90 p-5 shadow-lg backdrop-blur">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Share accountability links</h2>
          <span className="text-xs text-gray-600">Send a link to a partner</span>
        </div>
        {!shareLinks.length ? (
          <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
            <span>Create a public share key to generate cards.</span>
            <button
              className="rounded-full border px-3 py-1.5 text-sm font-semibold hover:border-gray-400"
              onClick={ensureToken}
              disabled={creatingToken}
            >
              {creatingToken ? "Creating…" : "Generate key"}
            </button>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {shareLinks.map((s) => (
              <div key={s.href} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{s.label}</div>
                    <div className="text-xs text-gray-600 mt-1">{s.desc}</div>
                  </div>
                  <ShareIcon />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    className="rounded-full border px-3 py-1 text-xs font-semibold hover:border-gray-400"
                    href={s.href}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open
                  </a>
                  <button
                    className="rounded-full border px-3 py-1 text-xs font-semibold hover:border-gray-400"
                    onClick={() => navigator.clipboard?.writeText(s.href).catch(() => {})}
                  >
                    Copy link
                  </button>
                  <button
                    className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold hover:border-gray-400"
                    onClick={() => {
                      const text = encodeURIComponent(`Check this: ${s.href}`);
                      window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <WhatsIcon /> WhatsApp
                  </button>
                  <a
                    className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold hover:border-gray-400"
                    href={`mailto:?subject=DeepWork accountability&body=${encodeURIComponent(`Take a look: ${s.href}`)}`}
                  >
                    <MailIcon /> Email
                  </a>
                  <button
                    className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold hover:border-gray-400"
                    onClick={() => shareViaWebAPI(s.href, s.label)}
                  >
                    <ShareIcon /> Share
                  </button>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  Invite them to join DeepWork Community at <span className="font-semibold">https://deep-calendar.vercel.app/</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

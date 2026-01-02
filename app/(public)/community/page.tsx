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

export default function CommunityPage() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [optedIn, setOptedIn] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactWhatsApp, setContactWhatsApp] = useState("");
  const [savingProfile, setSavingProfile] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [profileOpen, setProfileOpen] = useState(false);

  async function loadData() {
    setLoading(true);
    try {
    const [membersRes, profileRes] = await Promise.all([
      fetch("/api/community/members"),
      fetch("/api/community/profile"),
    ]);
      if (membersRes.ok) {
        const memJson = (await membersRes.json()) as { members?: Profile[] };
        setMembers(memJson.members ?? []);
      }
      if (profileRes.ok) {
        const pJson = (await profileRes.json()) as { profile?: Profile | null };
        setProfile(pJson.profile ?? null);
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
    if (profile) {
      setOptedIn(profile.optedIn);
      setDisplayName(profile.displayName ?? "");
      setContactEmail(profile.contactEmail ?? "");
      setContactWhatsApp(profile.contactWhatsApp ?? "");
    }
  }, [profile]);

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
    </div>
  );
}

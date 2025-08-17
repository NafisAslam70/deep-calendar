"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* Types */
type AuthState = "loading" | "authed" | "anon";
type Goal = { id: number; label: string; color: string; deadlineISO?: string | null };

/* Utils */
const COLORS = ["bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-fuchsia-500"] as const;
async function apiJson(input: RequestInfo, init?: RequestInit) {
  const r = await fetch(input, init);
  const j = r.headers.get("content-type")?.includes("application/json") ? await r.json().catch(() => ({})) : {};
  return { ok: r.ok, status: r.status, json: j };
}

/* Confirm dialog */
function ConfirmDialog({ open, title, body, confirmText = "Confirm", destructive = false, onCancel, onConfirm }:{
  open: boolean; title: string; body?: React.ReactNode; confirmText?: string; destructive?: boolean; onCancel: () => void; onConfirm: () => void | Promise<void>;
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

export default function GoalsPage() {
  const router = useRouter();

  const [authState, setAuthState] = useState<AuthState>("loading");
  const triedRef = useRef(false);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [gLabel, setGLabel] = useState(""); const [gColor, setGColor] = useState(COLORS[0]); const [gDeadline, setGDeadline] = useState("");

  const [editingGoalId, setEditingGoalId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState(""); const [editColor, setEditColor] = useState(COLORS[0]); const [editDeadline, setEditDeadline] = useState("");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState(""); const [confirmBody, setConfirmBody] = useState<React.ReactNode>(null);
  const [confirmText, setConfirmText] = useState("Confirm"); const [confirmDestructive, setConfirmDestructive] = useState(false);
  const confirmActionRef = useRef<null | (() => void | Promise<void>)>(null);
  function askConfirm(opts: { title: string; body?: React.ReactNode; confirmText?: string; destructive?: boolean; onConfirm: () => void | Promise<void>; }) {
    setConfirmTitle(opts.title); setConfirmBody(opts.body ?? null); setConfirmText(opts.confirmText ?? "Confirm");
    setConfirmDestructive(!!opts.destructive); confirmActionRef.current = opts.onConfirm; setConfirmOpen(true);
  }

  async function loadMe() {
    if (triedRef.current) return; triedRef.current = true;
    const { ok, status } = await apiJson("/api/auth/me");
    if (ok) setAuthState("authed"); else if (status === 401) setAuthState("anon");
  }
  async function loadGoals() {
    const { ok, status, json } = await apiJson("/api/deepcal/goals");
    if (ok) { setGoals(json.goals ?? []); if (authState !== "authed") setAuthState("authed"); }
    else if (status === 401) setAuthState("anon");
  }

  useEffect(() => { if (authState === "anon") router.replace(`/auth/signin?next=${encodeURIComponent("/goals")}`); }, [authState, router]);
  useEffect(() => { loadMe(); loadGoals(); }, []);

  async function createGoal() {
    if (!gLabel.trim()) return;
    if (goals.length >= 3) { askConfirm({ title: "Goal limit", body: "Max 3 goals allowed.", onConfirm: () => setConfirmOpen(false) }); return; }
    const { ok } = await apiJson("/api/deepcal/goals", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: gLabel.trim(), color: gColor, deadlineISO: gDeadline || undefined }),
    });
    if (ok) { setGLabel(""); setGDeadline(""); await loadGoals(); }
  }
  function beginEdit(g: Goal) { setEditingGoalId(g.id); setEditLabel(g.label); setEditColor((COLORS as readonly string[]).includes(g.color) ? (g.color as any) : COLORS[0]); setEditDeadline(g.deadlineISO || ""); }
  function cancelEdit() { setEditingGoalId(null); }
  function saveEditModal() {
    askConfirm({
      title: "Save goal changes?",
      confirmText: "Save",
      onConfirm: async () => {
        if (!editingGoalId) return;
        const { ok } = await apiJson(`/api/deepcal/goals?id=${editingGoalId}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: editLabel.trim(), color: editColor, deadlineISO: editDeadline || null }),
        });
        if (ok) { setEditingGoalId(null); await loadGoals(); }
        setConfirmOpen(false);
      },
    });
  }
  function deleteGoalModal(id: number, label: string) {
    askConfirm({
      title: "Delete goal?",
      body: <span>This removes <b>{label}</b>.</span>,
      confirmText: "Delete", destructive: true,
      onConfirm: async () => { await apiJson(`/api/deepcal/goals?id=${id}`, { method: "DELETE" }); await loadGoals(); setConfirmOpen(false); },
    });
  }

  return (
    <div className="mx-auto max-w-5xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Goals</h1>
          <p className="text-sm text-gray-600">Pick up to three, edit anytime.</p>
        </div>
        <a className="rounded-lg border px-3 py-1.5 text-sm" href="/routine">Build Routine</a>
      </div>

      {/* Create */}
      <section className="rounded-2xl border p-4">
        <h2 className="mb-3 text-lg font-semibold">Add a goal</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm text-gray-500">Goal title</span>
            <input className="w-full rounded-lg border px-3 py-2" value={gLabel} onChange={(e) => setGLabel(e.target.value)} placeholder="e.g. DeepWork AI" />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-500">Deadline</span>
            <input type="date" className="w-full rounded-lg border px-3 py-2" value={gDeadline} onChange={(e) => setGDeadline(e.target.value)} />
          </label>
          <div className="sm:col-span-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Color</span>
              {COLORS.map((c) => (
                <button key={c} onClick={() => setGColor(c)} className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ${c} ${gColor === c ? "ring-gray-800" : "ring-gray-200"}`} />
              ))}
            </div>
          </div>
        </div>
        <div className="pt-3">
          <button onClick={createGoal} disabled={!gLabel.trim() || goals.length >= 3} className="rounded-lg bg-black px-4 py-2 text-white disabled:opacity-50">Add Goal</button>
        </div>
      </section>

      {/* List & Edit */}
      <section className="mt-6 rounded-2xl border p-4">
        <h2 className="mb-3 text-lg font-semibold">Your goals</h2>
        <div className="grid gap-3">
          {goals.length === 0 ? <p className="text-gray-500">No goals yet.</p> : goals.map((g) => {
            const isEditing = editingGoalId === g.id;
            return (
              <div key={g.id} className="rounded-xl border p-3">
                {!isEditing ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`inline-block h-3 w-3 rounded-full ${g.color || "bg-gray-400"}`} />
                      <div>
                        <div className="font-medium">{g.label}</div>
                        {g.deadlineISO && <div className="text-xs text-gray-500">Due: {g.deadlineISO}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => beginEdit(g)}>Edit</button>
                      <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={() => deleteGoalModal(g.id, g.label)}>Delete</button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-5">
                    <label className="space-y-1 sm:col-span-2">
                      <span className="text-sm text-gray-500">Title</span>
                      <input className="w-full rounded-lg border px-3 py-2" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                    </label>
                    <label className="space-y-1">
                      <span className="text-sm text-gray-500">Deadline</span>
                      <input type="date" className="w-full rounded-lg border px-3 py-2" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
                    </label>
                    <div className="space-y-1 sm:col-span-2">
                      <span className="text-sm text-gray-500">Color</span>
                      <div className="flex items-center gap-2">
                        {COLORS.map((c) => (
                          <button key={c} onClick={() => setEditColor(c)} className={`h-7 w-7 rounded-full ring-2 ring-offset-2 ${c} ${editColor === c ? "ring-gray-800" : "ring-gray-200"}`} />
                        ))}
                      </div>
                    </div>
                    <div className="sm:col-span-5 flex gap-2">
                      <button className="rounded-lg border px-3 py-1.5 text-sm" onClick={cancelEdit}>Cancel</button>
                      <button className="rounded-lg bg-black px-3 py-1.5 text-sm text-white" onClick={saveEditModal}>Save</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        body={confirmBody}
        confirmText={confirmText}
        destructive={confirmDestructive}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { confirmActionRef.current?.(); }}
      />
    </div>
  );
}

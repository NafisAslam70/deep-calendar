"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import WalkthroughTour from "./_components/WalkthroughTour";

/* ---------- Types ---------- */
type AuthState = "loading" | "authed" | "anon";
type Depth = 1 | 2 | 3;
type Goal = { id: number; label: string; color: string; parentGoalId?: number | null };
type RoutineWindow = { openMin: number; closeMin: number } | null;
type Block = {
  id: number;
  startMin: number;
  endMin: number;
  depthLevel: Depth;
  goalId?: number;
  /** single-day tasks may carry a label */
  label?: string | null;
  /** NEW: origin source (returned by API) */
  source?: "standing" | "single-day";
  status: "planned" | "active" | "done" | "skipped";
  actualSec: number;
};
type DayPack = {
  dateISO: string;
  openedAt?: number;
  shutdownAt?: number;
  journal?: string;
  blocks: Block[];
};

/* ---------- Utils ---------- */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const pad = (n: number) => String(n).padStart(2, "0");
const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}-${m}-${day}`;
};
const nowMinutes = () => {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
};
const fromMinutes = (m: number) =>
  `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const fmtHM = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

type ApiResp<T> = { ok: boolean; status: number; json: T };
async function apiJson<T>(input: RequestInfo, init?: RequestInit): Promise<ApiResp<T>> {
  const r = await fetch(input, init);
  const isJson = r.headers.get("content-type")?.includes("application/json");
  const j = (isJson ? await r.json().catch(() => ({})) : {}) as T;
  return { ok: r.ok, status: r.status, json: j };
}

/* small pills */
function DepthPill({ d }: { d: Depth }) {
  const label = d === 1 ? "L1 (Light)" : d === 2 ? "L2 (Medium)" : "L3 (Deep)";
  const cls =
    d === 1 ? "bg-emerald-600" : d === 2 ? "bg-blue-600" : "bg-fuchsia-600";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs text-white ${cls}`}
    >
      {label}
    </span>
  );
}
function SourcePill({ s }: { s: Block["source"] }) {
  const label = s === "single-day" ? "Single-Day" : "Standing";
  const cls =
    s === "single-day" ? "bg-amber-600" : "bg-slate-700";
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs text-white ${cls}`}>
      {label}
    </span>
  );
}

/* confirm dialog */
function ConfirmDialog({
  open,
  title,
  body,
  confirmText = "Confirm",
  destructive = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmText?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="text-lg font-semibold">{title}</div>
        {body && <div className="mt-2 text-sm text-gray-700">{body}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button className="rounded-lg border px-4 py-2" onClick={onCancel}>
            Cancel
          </button>
          <button
            className={`rounded-lg px-4 py-2 text-white ${
              destructive ? "bg-red-600" : "bg-black"
            }`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */
export default function DashboardPage() {
  const router = useRouter();

  // Walkthrough
  const [tourOpen, setTourOpen] = useState(false);

  // Auth
  const [auth, setAuth] = useState<AuthState>("loading");
  useEffect(() => {
    (async () => {
      const r = await apiJson<Record<string, unknown>>("/api/auth/me");
      if (r.ok) setAuth("authed");
      else setAuth("anon");
    })();
  }, []);
  useEffect(() => {
    if (auth === "anon") {
      const next =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/";
      router.replace(`/auth/signin?next=${encodeURIComponent(next)}`);
    }
  }, [auth, router]);

  // Data
  const [goals, setGoals] = useState<Goal[]>([]);
  const [windowToday, setWindowToday] = useState<RoutineWindow>(null);
  const [pack, setPack] = useState<DayPack | null>(null);
  const [loading, setLoading] = useState(false);

  // Time ticker (to update "active now")
  const [nowMin, setNowMin] = useState<number>(nowMinutes());
  useEffect(() => {
    const t = setInterval(() => setNowMin(nowMinutes()), 30_000);
    return () => clearInterval(t);
  }, []);

  const date = todayISO();
  const weekday = new Date().getDay(); // 0..6

  const loadGoals = useCallback(async () => {
    const r = await apiJson<{ goals: Goal[] }>("/api/deepcal/goals");
    if (r.ok) setGoals(r.json.goals ?? []);
  }, []);

  const loadWindow = useCallback(async () => {
    const r = await apiJson<{ window: RoutineWindow }>(
      `/api/deepcal/routine?weekday=${weekday}`
    );
    if (r.ok) setWindowToday(r.json.window ?? null);
  }, [weekday]);

  const loadDay = useCallback(async () => {
    const r = await apiJson<{ pack: DayPack | null }>(
      `/api/deepcal/day?date=${encodeURIComponent(date)}`
    );
    setPack(r.ok ? r.json.pack ?? null : null);
  }, [date]);

  useEffect(() => {
    if (auth === "authed") {
      void loadGoals();
      void loadWindow();
      void loadDay();
    }
  }, [auth, loadGoals, loadWindow, loadDay]);

  /** Gate settings (UI only; keep bypass enabled for testing) */
  const OPEN_GRACE_BEFORE = 10;
  const OPEN_GRACE_AFTER = 10;
  const CLOSE_GRACE_BEFORE = 15;
  const CLOSE_GRACE_AFTER = 5;

  // Bypass toggles
  const [bypassOpen, setBypassOpen] = useState(true);
  const [bypassClose, setBypassClose] = useState(true);

  const canOpenNow = useMemo(() => {
    if (!windowToday) return true; // if no window, allow (or ask to set routine)
    const start = windowToday.openMin;
    return nowMin >= start - OPEN_GRACE_BEFORE && nowMin <= start + OPEN_GRACE_AFTER;
  }, [windowToday, nowMin]);

  const inCloseWindow = useMemo(() => {
    if (!windowToday) return false;
    const end = windowToday.closeMin;
    return nowMin >= end - CLOSE_GRACE_BEFORE && nowMin <= end + CLOSE_GRACE_AFTER;
  }, [windowToday, nowMin]);

  const goalMap = useMemo(
    () => Object.fromEntries(goals.map((g) => [g.id, g] as const)),
    [goals]
  );

  const activeBlock = useMemo(() => {
    if (!pack || !pack.blocks?.length) return null;
    const b = pack.blocks.find((b) => b.startMin <= nowMin && nowMin < b.endMin);
    return b ?? null;
  }, [pack, nowMin]);

  // Helpers to display task/goal
  const renderTaskOrGoal = (b: Block) => {
    if (b.label && b.label.trim()) return b.label.trim();
    if (b.goalId) return goalMap[b.goalId]?.label ?? `Goal #${b.goalId}`;
    return "No task/goal";
  };

  // Plan summary (Standing vs Single-Day vs Mixed)
  const planSummary = useMemo(() => {
    if (!pack?.blocks?.length) return null;
    let single = 0, standing = 0;
    for (const b of pack.blocks) {
      if (b.source === "single-day") single++;
      else standing++;
    }
    if (single && !standing) return { label: "Single-Day Plan (today only)", badge: "bg-amber-100 text-amber-800" };
    if (standing && !single) return { label: "Standing Routine", badge: "bg-slate-100 text-slate-800" };
    return { label: "Mixed: Standing + Single-Day", badge: "bg-indigo-100 text-indigo-800" };
  }, [pack?.blocks]);

  // Open Day
  async function openDay() {
    setLoading(true);
    const r = await apiJson<{ pack: DayPack | null }>(
      `/api/deepcal/day?date=${encodeURIComponent(date)}&autocreate=true`
    );
    setLoading(false);
    if (r.ok) setPack(r.json.pack ?? null);
  }

  // Update block status
  async function updateStatus(b: Block, status: Block["status"]) {
    const r = await apiJson<Record<string, unknown>>(
      `/api/deepcal/blocks?id=${b.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }
    );
    if (r.ok && pack) {
      setPack({
        ...pack,
        blocks: pack.blocks.map((x) =>
          x.id === b.id ? { ...x, status } : x
        ),
      });
    }
  }

  // Shutdown logs (per-block notes) + journal
  const [logNote, setLogNote] = useState<Record<number, string>>({});
  const [journal, setJournal] = useState("");
  async function shutdownDay() {
    if (!pack) return;
    const summary = {
      date: pack.dateISO,
      closedAtClient: new Date().toISOString(),
      blocks: pack.blocks.map((b) => ({
        id: b.id,
        time: `${fromMinutes(b.startMin)}–${fromMinutes(b.endMin)}`,
        depth: b.depthLevel,
        taskOrGoal: renderTaskOrGoal(b),
        source: b.source ?? "standing",
        status: b.status,
        note: logNote[b.id]?.trim() || null,
      })),
      journal: journal.trim() || null,
    };
    const body = JSON.stringify(summary, null, 2);

    const ok = await new Promise<boolean>((resolve) => {
      setConfirm({
        title: "Close your day?",
        body: <div className="text-sm">This will store today’s report.</div>,
        confirmText: "Close day",
        onConfirm: async () => {
          const r = await apiJson<Record<string, unknown>>(
            "/api/deepcal/day/shutdown",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                dateISO: pack.dateISO,
                journal: body,
              }),
            }
          );
          resolve(r.ok);
          setConfirmOpen(false);
        },
      });
    });

    if (ok) await loadDay();
  }

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmBody, setConfirmBody] = useState<React.ReactNode>(null);
  const [confirmText, setConfirmText] = useState("Confirm");
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const confirmAction = useRef<null | (() => void | Promise<void>)>(null);
  function setConfirm(opts: {
    title: string;
    body?: React.ReactNode;
    confirmText?: string;
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
  }) {
    setConfirmTitle(opts.title);
    setConfirmBody(opts.body ?? null);
    setConfirmText(opts.confirmText ?? "Confirm");
    setConfirmDestructive(!!opts.destructive);
    confirmAction.current = opts.onConfirm;
    setConfirmOpen(true);
  }

  // Early exit while gating auth
  if (auth !== "authed") {
    return (
      <div className="mx-auto max-w-6xl p-5">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  const showOpenPanel = !pack?.openedAt;
  const showShutdownPanel = !!pack?.openedAt && !pack?.shutdownAt;

  // Walkthrough steps
  const tourSteps = [
    {
      selector: "#dash-header",
      title: "Welcome to DeepCal",
      body:
        "This dashboard is your daily cockpit. Open your day, track active blocks, and log a quick shutdown report.",
    },
    {
      selector: "#routine-window-section",
      title: "Day Window",
      body:
        "Your Standing Routine’s open/close window for today. The app uses it to gate opening/closing and to limit one-off plans.",
    },
    {
      selector: "#open-day-section",
      title: "Open Your Day",
      body:
        "Start your workday here. By default, opening is allowed only close to your configured start time.",
    },
    {
      selector: "#now-section",
      title: "Now",
      body:
        "Shows the current block (if any). You can quickly mark it Active/Done/Skipped from here.",
    },
    {
      selector: "#blocks-section",
      title: "Today’s Blocks",
      body:
        "All blocks for today, from Standing Routine and any Single-Day Plans. Look for the small Standing / Single-Day pills.",
    },
    {
      selector: "#shutdown-section",
      title: "Shutdown Report",
      body:
        "Wrap up with quick notes per block and an optional daily journal. This stores a JSON summary in your logs.",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-5">
      {/* Header */}
      <div id="dash-header" className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-600">
            Your day at a glance • {WEEKDAYS[new Date().getDay()]}, {todayISO()}
          </p>
        </div>
        <button
          className="rounded-lg border px-3 py-1.5 text-sm"
          onClick={() => setTourOpen(true)}
          title="Open walkthrough"
        >
          Walkthrough
        </button>
      </div>

      {/* Routine window info + open/closed timestamps (as tiles) */}
      <section id="routine-window-section" className="rounded-2xl border p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm text-gray-500">Routine window (today)</div>
            <div className="text-lg font-semibold">
              {windowToday
                ? `${fromMinutes(windowToday.openMin)}–${fromMinutes(
                    windowToday.closeMin
                  )}`
                : "Not set"}
            </div>
          </div>
          <div className="text-sm text-gray-500">
            Current time: <span className="font-medium">{fromMinutes(nowMin)}</span>
          </div>
        </div>

        {/* Tiles */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">Full window</div>
            <div className="mt-1 text-lg font-semibold">
              {windowToday
                ? `${fromMinutes(windowToday.openMin)}–${fromMinutes(
                    windowToday.closeMin
                  )}`
                : "—"}
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">Day opened</div>
            <div className="mt-1 text-lg font-semibold">
              {pack?.openedAt ? fmtHM(pack.openedAt) : "Not opened yet"}
            </div>
          </div>

          <div className="rounded-xl border p-3">
            <div className="text-xs text-gray-500">Day closed</div>
            <div className="mt-1 text-lg font-semibold">
              {pack?.shutdownAt ? fmtHM(pack.shutdownAt) : "Not closed yet"}
            </div>
          </div>
        </div>

        {/* Plan summary */}
        {pack?.blocks?.length ? (
          <div className="mt-3">
            <span
              className={`rounded-full px-2 py-1 text-xs ${planSummary?.badge ?? "bg-slate-100 text-slate-800"}`}
              title="Where today's blocks come from"
            >
              {planSummary?.label ?? "Plan"}
            </span>
          </div>
        ) : null}
      </section>

      {/* Open Day */}
      {showOpenPanel && (
        <section id="open-day-section" className="rounded-2xl border p-4">
          <h2 className="mb-2 text-lg font-semibold">Open your day</h2>
          <p className="text-sm text-gray-600">
            You should open within <b>±10 minutes</b> of the start time.
          </p>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              disabled={(!bypassOpen && !canOpenNow) || loading}
              onClick={openDay}
              className={`rounded-lg px-4 py-2 text-white ${
                !bypassOpen && !canOpenNow ? "bg-gray-400" : "bg-black"
              }`}
            >
              {loading ? "Opening…" : "Open day now"}
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bypassOpen}
                onChange={(e) => setBypassOpen(e.target.checked)}
              />
              Allow bypass (testing)
            </label>
            {windowToday && !canOpenNow && !bypassOpen && (
              <div className="text-sm text-gray-600">
                Opening allowed {fromMinutes(windowToday.openMin - 10)} →{" "}
                {fromMinutes(windowToday.openMin + 10)}.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Active Block */}
      {!!pack?.openedAt && (
        <section id="now-section" className="rounded-2xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">Now</h2>
          {(() => {
            const active = activeBlock;
            if (!active)
              return (
                <div className="text-sm text-gray-600">
                  No active deep block right now.
                </div>
              );
            return (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <DepthPill d={active.depthLevel} />
                  <SourcePill s={active.source ?? "standing"} />
                  <div>
                    <div className="font-medium">
                      {fromMinutes(active.startMin)}–{fromMinutes(active.endMin)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {renderTaskOrGoal(active)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-lg border px-3 py-2 text-sm"
                    value={active.status}
                    onChange={(e) =>
                      updateStatus(active, e.target.value as Block["status"])
                    }
                  >
                    {["planned", "active", "done", "skipped"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })()}
        </section>
      )}

      {/* Schedule preview */}
      {!!pack?.openedAt && (
        <section id="blocks-section" className="rounded-2xl border p-4">
          <h2 className="mb-3 text-lg font-semibold">Today’s blocks</h2>
          {pack.blocks.length === 0 ? (
            <div className="text-sm text-gray-600">
              No blocks today. Create a routine in{" "}
              <a href="/routine" className="underline">
                Your Deep Routine
              </a>
              .
            </div>
          ) : (
            <div className="space-y-3">
              {pack.blocks.map((b) => (
                <div
                  key={b.id}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                    activeBlock?.id === b.id ? "ring-2 ring-black" : ""
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <DepthPill d={b.depthLevel} />
                    <SourcePill s={b.source ?? "standing"} />
                    <div className="text-sm">
                      <div className="font-medium">
                        {fromMinutes(b.startMin)}–{fromMinutes(b.endMin)}
                      </div>
                      <div className="text-gray-500">
                        {renderTaskOrGoal(b)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      className="rounded-lg border px-3 py-2 text-sm"
                      value={b.status}
                      onChange={(e) =>
                        updateStatus(b, e.target.value as Block["status"])
                      }
                    >
                      {["planned", "active", "done", "skipped"].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Shutdown */}
      {showShutdownPanel && (
        <section id="shutdown-section" className="rounded-2xl border p-4">
          <h2 className="mb-2 text-lg font-semibold">Shutdown report</h2>
          <p className="text-sm text-gray-600">
            Preferably close within <b>the last 15 minutes</b> of your day window.
          </p>

          <div className="mt-3">
            <div className="mb-2 text-sm font-medium">Per-block notes</div>
            {pack!.blocks.length === 0 ? (
              <div className="text-sm text-gray-500">No blocks to report.</div>
            ) : (
              <div className="space-y-3">
                {pack!.blocks.map((b) => (
                  <div key={b.id} className="rounded-lg border p-3">
                    <div className="mb-1 text-sm font-medium">
                      {fromMinutes(b.startMin)}–{fromMinutes(b.endMin)} •{" "}
                      {renderTaskOrGoal(b)} • <DepthPill d={b.depthLevel} /> •{" "}
                      <SourcePill s={b.source ?? "standing"} />
                    </div>
                    <textarea
                      rows={2}
                      placeholder="What did you do? Highlights, blockers, quick metrics…"
                      value={logNote[b.id] ?? ""}
                      onChange={(e) =>
                        setLogNote((s) => ({ ...s, [b.id]: e.target.value }))
                      }
                      className="w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4">
            <div className="mb-1 text-sm font-medium">Daily journal (optional)</div>
            <textarea
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="How did the day go overall?"
              value={journal}
              onChange={(e) => setJournal(e.target.value)}
            />
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              disabled={!bypassClose && !inCloseWindow}
              onClick={shutdownDay}
              className={`rounded-lg px-4 py-2 text-white ${
                !bypassClose && !inCloseWindow ? "bg-gray-400" : "bg-black"
              }`}
            >
              Close day & save report
            </button>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={bypassClose}
                onChange={(e) => setBypassClose(e.target.checked)}
              />
              Allow bypass (testing)
            </label>
            {windowToday && !inCloseWindow && !bypassClose && (
              <div className="text-sm text-gray-600">
                Closing allowed {fromMinutes(windowToday.closeMin - 15)} →{" "}
                {fromMinutes(windowToday.closeMin + 5)}.
              </div>
            )}
          </div>
        </section>
      )}

      {/* If nothing is set yet */}
      {!pack?.openedAt && (
        <section className="rounded-2xl border p-4">
          <h2 className="mb-2 text-lg font-semibold">Get started</h2>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
            <li>
              Set your goals in <a className="underline" href="/goals">Goals</a>.
            </li>
            <li>
              Build your routine in{" "}
              <a className="underline" href="/routine">Your Deep Routine</a>.
            </li>
            <li>Then come back here to open your day.</li>
          </ol>
        </section>
      )}

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        body={confirmBody}
        confirmText={confirmText}
        destructive={confirmDestructive}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          confirmAction.current?.();
        }}
      />

      {/* Walkthrough overlay */}
      <WalkthroughTour
        open={tourOpen}
        onClose={() => setTourOpen(false)}
        steps={tourSteps}
      />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

type Goal = { id: number; label: string; color: string; deadlineISO: string | null; parentGoalId: number | null };
type RoutineWindow = { weekday: number; openMin: number; closeMin: number };
type RoutineItem = { weekday: number; startMin: number; endMin: number; depthLevel: number; goalId: number | null; label: string | null };
type Summary = {
  goals: Goal[];
  routine: { windows: RoutineWindow[]; items: RoutineItem[] };
  stats: { range: { from: string; to: string }; byGoal: Array<{ goalId: number; label: string; hours: number; color: string }> };
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function minToTime(min: number) {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

type ShareParams = Promise<{ token?: string }>;

export default function SharePage({ params }: { params: ShareParams }) {
  const [token, setToken] = useState("");
  const searchParams = useSearchParams();
  const view = (searchParams.get("view") || "goals") as "goals" | "routine" | "shutdown";
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then((p) => setToken(p?.token ?? ""));
  }, [params]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);
    fetch(`/api/public/${token}/summary?range=30d`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Not found");
        return (await res.json()) as Summary;
      })
      .then((j) => setData(j))
      .catch(() => setError("Link not found or expired"))
      .finally(() => setLoading(false));
  }, [token, params]);

  const topGoals = useMemo(() => (data ? data.goals.filter((g) => !g.parentGoalId) : []), [data]);
  const byParent = useMemo(() => {
    const m = new Map<number, Goal[]>();
    (data?.goals ?? []).forEach((g) => {
      if (g.parentGoalId) {
        const arr = m.get(g.parentGoalId) ?? [];
        arr.push(g);
        m.set(g.parentGoalId, arr);
      }
    });
    return m;
  }, [data]);

  return (
    <div className="mx-auto max-w-6xl p-5 space-y-6 text-slate-900">
      <section className="rounded-3xl border border-gray-200/80 bg-gradient-to-r from-sky-500/10 via-fuchsia-500/10 to-amber-500/10 p-6 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Shared snapshot</p>
            <h1 className="text-3xl font-semibold text-gray-900">
              {view === "goals" ? "Goals" : view === "routine" ? "Deep Routine" : "Shutdown summary"}
            </h1>
            <p className="text-sm text-gray-700">
              A quick view to keep partners accountable.
            </p>
          </div>
          <Link
            href="https://deep-calendar.vercel.app/"
            className="rounded-full border px-4 py-2 text-sm font-semibold bg-white/80 shadow hover:shadow-md transition"
            target="_blank"
          >
            Join DeepWork Community
          </Link>
        </div>
      </section>

      {loading ? (
        <p className="text-gray-600">Loading…</p>
      ) : error ? (
        <p className="text-amber-700">{error}</p>
      ) : !data ? (
        <p className="text-gray-600">No data.</p>
      ) : view === "goals" ? (
        <section className="rounded-3xl border border-gray-200/80 bg-white/90 p-5 shadow-lg">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Goals</h2>
          {topGoals.length === 0 ? (
            <p className="text-gray-600">No goals shared.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {topGoals.map((g) => (
                <div key={g.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-3 w-3 rounded-full ${g.color}`} />
                    <div className="font-semibold text-gray-900">{g.label}</div>
                  </div>
                  {g.deadlineISO && <div className="mt-1 text-xs text-gray-600">Due: {g.deadlineISO}</div>}
                  {byParent.get(g.id)?.length ? (
                    <div className="mt-2 space-y-1">
                      {byParent.get(g.id)!.map((c) => (
                        <div key={c.id} className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-800">
                          {c.label}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>
      ) : view === "routine" ? (
        <section className="rounded-3xl border border-gray-200/80 bg-white/90 p-5 shadow-lg space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Deep Routine</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {WEEKDAYS.map((w, idx) => {
              const items = (data.routine.items || []).filter((it) => it.weekday === idx);
              if (!items.length) return null;
              const win = data.routine.windows.find((w) => w.weekday === idx);
              return (
                <div key={w} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                    <span>{w}</span>
                    {win ? <span className="text-xs text-gray-600">{minToTime(win.openMin)} - {minToTime(win.closeMin)}</span> : null}
                  </div>
                  <div className="mt-2 space-y-1">
                    {items.map((it, i) => (
                      <div key={i} className="rounded border border-gray-200 bg-gray-50 px-2 py-1 text-sm text-gray-800 flex justify-between">
                        <span>{it.label || `Block ${i + 1}`}</span>
                        <span className="text-xs text-gray-600">{minToTime(it.startMin)}-{minToTime(it.endMin)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="rounded-3xl border border-gray-200/80 bg-white/90 p-5 shadow-lg space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">Recent focus (last 30 days)</h2>
          {data.stats.byGoal.length === 0 ? (
            <p className="text-gray-600">No activity yet.</p>
          ) : (
            <div className="space-y-2">
              {data.stats.byGoal.map((g) => (
                <div key={g.goalId} className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className={`inline-block h-3 w-3 rounded-full ${g.color}`} />
                    <div className="text-sm font-semibold text-gray-900">{g.label}</div>
                  </div>
                  <div className="text-sm text-gray-700">{g.hours}h</div>
                </div>
              ))}
            </div>
          )}
          <div className="text-xs text-gray-500">
            Showing {data.stats.range.from} to {data.stats.range.to}
          </div>
        </section>
      )}
    </div>
  );
}

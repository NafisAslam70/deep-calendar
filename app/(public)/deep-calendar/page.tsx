"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

/* Types */
type AuthState = "loading" | "authed" | "anon";
type Depth = 1 | 2 | 3;
type RoutineWindow = { openMin: number; closeMin: number } | null;

type RoutineItem = {
  id: number;
  startMin: number;
  endMin: number;
  depthLevel: Depth;
  label?: string | null;
};
type RoutineResponse = {
  window: RoutineWindow;
  items: RoutineItem[];
};

/* Today pack (minimal) */
type DayBlock = {
  id: number;
  startMin: number;
  endMin: number;
  depthLevel: Depth;
  label?: string | null;
  /** server sends "standing" | "single-day" */
  source?: "standing" | "single-day";
};
type DayPackResp = {
  pack: { blocks: DayBlock[] } | null;
};

type ApiResp<T> = { ok: boolean; status: number; json: T };
async function apiJson<T>(input: RequestInfo, init?: RequestInit): Promise<ApiResp<T>> {
  const r = await fetch(input, init);
  const isJson = r.headers.get("content-type")?.includes("application/json");
  const j = (isJson ? await r.json().catch(() => ({})) : {}) as T;
  return { ok: r.ok, status: r.status, json: j };
}

/* Utils */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const pad = (n: number) => String(n).padStart(2, "0");
const fromMinutes = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
function depthColors(d: Depth) {
  if (d === 3) return { border: "#6366f1", bg: "#6366f126", label: "L3 Deep" };
  if (d === 2) return { border: "#0ea5e9", bg: "#0ea5e926", label: "L2 Medium" };
  return { border: "#f59e0b", bg: "#f59e0b26", label: "L1 Light" };
}
const nowInMinutesLocal = () => {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
};
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export default function DeepCalendarPage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>("loading");

  const [windowsByDay, setWindowsByDay] = useState<Record<number, RoutineWindow>>({});
  const [routineByDay, setRoutineByDay] = useState<Record<number, RoutineItem[]>>({});

  // Today override (if there&apos;s a Single-Day Plan)
  const todayIdx = new Date().getDay();
  const [todayOverrideItems, setTodayOverrideItems] = useState<RoutineItem[] | null>(null);
  const [todayHasSingleDay, setTodayHasSingleDay] = useState<boolean>(false);

  useEffect(() => {
    if (authState === "anon")
      router.replace(`/auth/signin?next=${encodeURIComponent("/deep-calendar")}`);
  }, [authState, router]);

  const loadAllRoutine = useCallback(async () => {
    const results = await Promise.all(
      [0, 1, 2, 3, 4, 5, 6].map((d) =>
        apiJson<RoutineResponse>(`/api/deepcal/routine?weekday=${d}`)
      )
    );
    const rmap: Record<number, RoutineItem[]> = {};
    const wmap: Record<number, RoutineWindow> = {};
    let any401 = false,
      anyOk = false;

    results.forEach((res, idx) => {
      if (res.ok) {
        anyOk = true;
        const items = (res.json.items ?? [])
          .slice()
          .sort((a, b) => a.startMin - b.startMin);
        rmap[idx] = items;
        wmap[idx] = res.json.window ?? null;
      } else if (res.status === 401) any401 = true;
    });
    if (anyOk) setAuthState("authed");
    else if (any401) setAuthState("anon");
    setRoutineByDay(rmap);
    setWindowsByDay(wmap);
  }, []);

  // Load today's pack and override if Single-Day Plan exists
  const loadTodayPack = useCallback(async () => {
    const date = todayISO();
    const res = await apiJson<DayPackResp>(`/api/deepcal/day?date=${encodeURIComponent(date)}`);
    if (!res.ok) {
      setTodayOverrideItems(null);
      setTodayHasSingleDay(false);
      return;
    }
    const blocks = res.json.pack?.blocks ?? [];
    const hasSingleDay = blocks.some((b) => b.source === "single-day");
    setTodayHasSingleDay(hasSingleDay);

    if (hasSingleDay) {
      const mapped: RoutineItem[] = blocks
        .slice()
        .sort((a, b) => a.startMin - b.startMin)
        .map((b) => ({
          id: b.id,
          startMin: b.startMin,
          endMin: b.endMin,
          depthLevel: b.depthLevel,
          label: b.label ?? null,
        }));
      setTodayOverrideItems(mapped);
    } else {
      setTodayOverrideItems(null);
    }
  }, []);

  useEffect(() => {
    void loadAllRoutine();
    void loadTodayPack();
  }, [loadAllRoutine, loadTodayPack]);

  // Group identical windows to reduce redundancy summary
  const groupedWindows = useMemo(() => {
    const groups: Record<string, number[]> = {};
    for (let d = 0; d < 7; d++) {
      const w = windowsByDay[d];
      const key = w ? `${w.openMin}-${w.closeMin}` : "none";
      (groups[key] ??= []).push(d);
    }
    return Object.entries(groups).map(([key, days]) => ({
      key,
      days,
      window: key === "none" ? null : { openMin: Number(key.split("-")[0]), closeMin: Number(key.split("-")[1]) },
    }));
  }, [windowsByDay]);

  // Calendar range (min open → max close across the week) for desktop weekly view
  const weeklyRange = useMemo(() => {
    const mins: number[] = [],
      maxs: number[] = [];
    for (let d = 0; d < 7; d++) {
      const w = windowsByDay[d];
      if (w) {
        mins.push(w.openMin);
        maxs.push(w.closeMin);
      }
    }
    const start = mins.length ? Math.min(...mins) : 8 * 60;
    const end = maxs.length ? Math.max(...maxs) : 20 * 60;
    return end > start ? { start, end } : { start: 8 * 60, end: 20 * 60 };
  }, [windowsByDay]);

  // Visual scale
  const pxPerMinDesktop = 0.8;
  const desktopHeight = Math.max(200, (weeklyRange.end - weeklyRange.start) * pxPerMinDesktop);
  const desktopTicks = useMemo(() => {
    const arr: number[] = [];
    for (let t = Math.ceil(weeklyRange.start / 60) * 60; t <= weeklyRange.end; t += 60) arr.push(t);
    return arr;
  }, [weeklyRange]);

  // "Now" indicator
  const [nowMin, setNowMin] = useState<number>(nowInMinutesLocal());
  useEffect(() => {
    const id = setInterval(() => setNowMin(nowInMinutesLocal()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // --- Mobile single-day mode ---
  const [dayMobile, setDayMobile] = useState<number>(todayIdx);

  // Range for the selected day (prefer its window; fallback to weekly range)
  const dayRange = useMemo(() => {
    const win = windowsByDay[dayMobile];
    if (win && win.closeMin > win.openMin) return { start: win.openMin, end: win.closeMin };
    return weeklyRange;
  }, [windowsByDay, dayMobile, weeklyRange]);

  const pxPerMinMobile = 1.0;
  const mobileHeight = Math.max(200, (dayRange.end - dayRange.start) * pxPerMinMobile);
  const mobileTicks = useMemo(() => {
    const arr: number[] = [];
    for (let t = Math.ceil(dayRange.start / 60) * 60; t <= dayRange.end; t += 60) arr.push(t);
    return arr;
  }, [dayRange]);

  if (authState !== "authed") {
    return (
      <div className="mx-auto max-w-6xl p-5">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  // Helper to choose items for a given day (override "today" if Single-Day Plan exists)
  const getItemsForDay = (day: number) => {
    if (day === todayIdx && todayOverrideItems) return todayOverrideItems;
    return routineByDay[day] ?? [];
  };

  // Plan-kind helpers
  const isSingleForDay = (day: number) => day === todayIdx && !!todayOverrideItems;
  const DayPlanBadge = ({ day }: { day: number }) => {
    const single = isSingleForDay(day);
    return (
      <span
        className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${
          single ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-700"
        }`}
        title={single ? "Single-Day Plan" : "Standing Routine"}
      >
        {single ? "Single-Day Plan" : "Standing"}
      </span>
    );
  };

  return (
    <div className="mx-auto max-w-6xl p-5">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Your Deep Calendar</h1>
        <p className="text-sm text-gray-600">
          Weekly view on desktop · single-day view on mobile.
        </p>
      </div>

      {/* Windows summary */}
      <div className="rounded-2xl border p-3">
        <div className="mb-2 text-sm font-semibold">Day windows (grouped)</div>
        {groupedWindows.length === 0 ? (
          <div className="text-sm text-gray-500">No windows set.</div>
        ) : (
          <div className="space-y-1 text-sm">
            {groupedWindows.map((g) => (
              <div key={g.key}>
                {g.window ? `${fromMinutes(g.window.openMin)}–${fromMinutes(g.window.closeMin)}` : "not set"}
                <span className="text-gray-600"> — {g.days.map((d) => WEEKDAYS[d]).join(", ")}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-700">
        {[3, 2, 1].map((lvl) => {
          const c = depthColors(lvl as Depth);
          return (
            <span
              key={lvl}
              className="inline-flex items-center gap-1 rounded border px-2 py-1"
              style={{ borderColor: c.border, background: c.bg }}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: c.border }} />
              {c.label}
            </span>
          );
        })}
      </div>

      {/* ---------- MOBILE: Single-day view (visible < sm) ---------- */}
      <section className="mt-4 block sm:hidden">
        {/* Day selector */}
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          {WEEKDAYS.map((w, i) => (
            <button
              key={w}
              onClick={() => setDayMobile(i)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ring-1 ring-gray-200 ${
                dayMobile === i ? "bg-black text-white" : "bg-white"
              }`}
            >
              {w}
            </button>
          ))}
        </div>

        {/* Single-day timeline */}
        <div className="overflow-hidden rounded-2xl border">
          <div className="grid grid-cols-6 border-b bg-gray-50 text-sm">
            <div className="col-span-2 p-2 text-gray-500">Time</div>
            <div className="col-span-4 border-l p-2 font-medium">
              <div className="flex items-center">
                <span>{WEEKDAYS[dayMobile]}</span>
                <DayPlanBadge day={dayMobile} />
              </div>
            </div>
          </div>

          <div className="relative grid grid-cols-6">
            {/* time rail */}
            <div className="relative col-span-2 border-r" style={{ height: mobileHeight }}>
              {mobileTicks.map((t) => (
                <div
                  key={t}
                  className="absolute left-0 right-0 -translate-y-1/2 text-[10px] text-gray-500"
                  style={{ top: (t - dayRange.start) * pxPerMinMobile }}
                >
                  <div className="px-2">{fromMinutes(t)}</div>
                  <div className="mt-1 h-px bg-gray-200" />
                </div>
              ))}
            </div>

            {/* day column */}
            <div className="relative col-span-4" style={{ height: mobileHeight }}>
              {/* day window band */}
              {windowsByDay[dayMobile] && (
                <div
                  className="absolute left-0 right-0 rounded-sm"
                  style={{
                    top: Math.max(0, (windowsByDay[dayMobile]!.openMin - dayRange.start) * pxPerMinMobile),
                    height: Math.max(
                      0,
                      (windowsByDay[dayMobile]!.closeMin - windowsByDay[dayMobile]!.openMin) * pxPerMinMobile
                    ),
                    backgroundColor: "#a7f3d0",
                    opacity: 0.45,
                  }}
                  title={`Window ${fromMinutes(windowsByDay[dayMobile]!.openMin)}–${fromMinutes(
                    windowsByDay[dayMobile]!.closeMin
                  )}`}
                />
              )}

              {/* now line */}
              {dayMobile === todayIdx &&
                nowMin >= dayRange.start &&
                nowMin <= dayRange.end && (
                  <div
                    className="pointer-events-none absolute left-0 right-0"
                    style={{ top: (nowMin - dayRange.start) * pxPerMinMobile }}
                  >
                    <div className="h-0.5 w-full bg-rose-500" />
                  </div>
                )}

              {/* blocks */}
              {getItemsForDay(dayMobile).map((it, idx) => {
                const { border, bg } = depthColors(it.depthLevel);
                const top = (it.startMin - dayRange.start) * pxPerMinMobile;
                const height = Math.max(20, (it.endMin - it.startMin) * pxPerMinMobile);
                const win = windowsByDay[dayMobile];
                const outside = win ? it.startMin < win.openMin || it.endMin > win.closeMin : false;
                return (
                  <div
                    key={it.id ?? idx}
                    className="absolute left-1 right-1 overflow-hidden rounded-md shadow-sm"
                    style={{
                      top,
                      height,
                      backgroundColor: bg,
                      border: `1px solid ${outside ? "#ef4444" : border}`,
                    }}
                    title={`${fromMinutes(it.startMin)}–${fromMinutes(it.endMin)} • L${it.depthLevel}`}
                  >
                    <div className="flex items-center justify-between px-2 py-1 text-[11px] leading-tight">
                      <span className="truncate font-medium">{it.label ?? "Block"}</span>
                      <span className="ml-2 shrink-0">L{it.depthLevel}</span>
                    </div>
                    <div className="px-2 pb-1 text-[10px] opacity-80">
                      {fromMinutes(it.startMin)}–{fromMinutes(it.endMin)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Mobile controls */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button className="w-full rounded-lg border px-3 py-1.5 text-sm sm:w-auto" onClick={() => { void loadAllRoutine(); void loadTodayPack(); }}>
            Refresh
          </button>
        </div>
      </section>

      {/* ---------- DESKTOP/TABLET: Weekly grid (hidden on mobile) ---------- */}
      <section className="mt-4 hidden sm:block">
        <div className="overflow-x-auto rounded-2xl border">
          <div className="grid min-w-[760px] grid-cols-8 border-b bg-gray-50 text-sm">
            <div className="p-2 text-gray-500">Time</div>
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`border-l p-2 ${i === todayIdx ? "bg-gray-100" : ""}`}>
                <div className="flex items-center font-medium">
                  <span>{w}</span>
                  <DayPlanBadge day={i} />
                </div>
              </div>
            ))}
          </div>

          <div className="relative grid min-w-[760px] grid-cols-8">
            {/* time rail */}
            <div className="relative border-r" style={{ height: desktopHeight }}>
              {desktopTicks.map((t) => (
                <div
                  key={t}
                  className="absolute left-0 right-0 -translate-y-1/2 text-[10px] text-gray-500"
                  style={{ top: (t - weeklyRange.start) * pxPerMinDesktop }}
                >
                  <div className="px-2">{fromMinutes(t)}</div>
                  <div className="mt-1 h-px bg-gray-200" />
                </div>
              ))}
            </div>

            {/* days */}
            {WEEKDAYS.map((w, day) => {
              const win = windowsByDay[day];
              const items = getItemsForDay(day);

              const showNow =
                day === todayIdx &&
                nowMin >= weeklyRange.start &&
                nowMin <= weeklyRange.end;

              return (
                <div key={w} className="relative border-l" style={{ height: desktopHeight }}>
                  {/* day window band */}
                  {win && (
                    <div
                      className="absolute left-0 right-0 rounded-sm"
                      style={{
                        top: Math.max(0, (win.openMin - weeklyRange.start) * pxPerMinDesktop),
                        height: Math.max(0, (win.closeMin - win.openMin) * pxPerMinDesktop),
                        backgroundColor: "#a7f3d0",
                        opacity: 0.45,
                      }}
                      title={`Window ${fromMinutes(win.openMin)}–${fromMinutes(win.closeMin)}`}
                    />
                  )}

                  {/* now line */}
                  {showNow && (
                    <div
                      className="pointer-events-none absolute left-0 right-0"
                      style={{ top: (nowMin - weeklyRange.start) * pxPerMinDesktop }}
                    >
                      <div className="h-0.5 w-full bg-rose-500" />
                    </div>
                  )}

                  {/* blocks */}
                  {items.map((it, idx) => {
                    const { border, bg } = depthColors(it.depthLevel);
                    const top = (it.startMin - weeklyRange.start) * pxPerMinDesktop;
                    const height = Math.max(16, (it.endMin - it.startMin) * pxPerMinDesktop);
                    const outside = win ? it.startMin < win.openMin || it.endMin > win.closeMin : false;
                    return (
                      <div
                        key={it.id ?? idx}
                        className="absolute left-1 right-1 overflow-hidden rounded-md shadow-sm"
                        style={{
                          top,
                          height,
                          backgroundColor: bg,
                          border: `1px solid ${outside ? "#ef4444" : border}`,
                        }}
                        title={`${fromMinutes(it.startMin)}–${fromMinutes(it.endMin)} • L${it.depthLevel}`}
                      >
                        <div className="flex items-center justify-between px-2 py-1 text-[10px] leading-tight">
                          <span className="truncate font-medium">{it.label ?? "Block"}</span>
                          <span className="ml-2 shrink-0">L{it.depthLevel}</span>
                        </div>
                        <div className="px-2 pb-1 text-[10px] opacity-80">
                          {fromMinutes(it.startMin)}–{fromMinutes(it.endMin)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4">
          <button
            className="rounded-lg border px-3 py-1.5 text-sm"
            onClick={() => {
              void loadAllRoutine();
              void loadTodayPack();
            }}
          >
            Refresh
          </button>
        </div>
      </section>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/* Types */
type AuthState = "loading" | "authed" | "anon";
type Depth = 1 | 2 | 3;
type Goal = { id: number; label: string; color: string; deadlineISO?: string | null };
type RoutineWindow = { openMin: number; closeMin: number } | null;
type DraftSprint = { s: number; e: number };
type DraftBreak = { s: number; e: number };
type DraftGroup = {
  id: number;
  label?: string;
  startMin: number;
  endMin: number;
  depthLevel: Depth;
  goalId: number;
  sprints: DraftSprint[];
  breaks: DraftBreak[];
  days: number[];
};

/* Utils */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const pad = (n: number) => String(n).padStart(2, "0");
const fromMinutes = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const overlaps = (aS: number, aE: number, bS: number, bE: number) =>
  Math.max(aS, bS) < Math.min(aE, bE);

async function apiJson(input: RequestInfo, init?: RequestInit) {
  const r = await fetch(input, init);
  const j = r.headers.get("content-type")?.includes("application/json")
    ? await r.json().catch(() => ({}))
    : {};
  return { ok: r.ok, status: r.status, json: j };
}

/* Confirm dialog */
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

/* Page */
export default function RoutinePage() {
  /* ---------------- auth gate ---------------- */
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    (async () => {
      // ping any authed endpoint
      const res = await apiJson("/api/deepcal/goals");
      if (res.ok) setAuthState("authed");
      else if (res.status === 401) setAuthState("anon");
      else setAuthState("loading");
    })();
  }, []);

  useEffect(() => {
    if (authState === "anon") {
      const next =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/routine";
      window.location.replace(`/auth/signin?next=${encodeURIComponent(next)}`);
    }
  }, [authState]);

  /* ---------------- server data ---------------- */
  const [goals, setGoals] = useState<Goal[]>([]);
  const [windowsByDay, setWindowsByDay] = useState<Record<number, RoutineWindow>>(
    {}
  );
  const [existingByDay, setExistingByDay] = useState<
    Record<
      number,
      Array<{
        id: number;
        startMin: number;
        endMin: number;
        depthLevel: 1 | 2 | 3;
        goalId: number;
        label?: string | null;
      }>
    >
  >({});

  async function loadGoals() {
    const { ok, json } = await apiJson("/api/deepcal/goals");
    if (ok) setGoals(json.goals ?? []);
  }

  async function loadAllRoutine() {
    const results = await Promise.all(
      [0, 1, 2, 3, 4, 5, 6].map((d) => apiJson(`/api/deepcal/routine?weekday=${d}`))
    );
    const wmap: typeof windowsByDay = {};
    const emap: typeof existingByDay = {};
    results.forEach((res, idx) => {
      if (res.ok) {
        wmap[idx] = res.json.window ?? null;
        emap[idx] = (res.json.items ?? []).sort(
          (a: any, b: any) => a.startMin - b.startMin
        );
      }
    });
    setWindowsByDay(wmap);
    setExistingByDay(emap);
  }

  useEffect(() => {
    if (authState === "authed") {
      loadGoals();
      loadAllRoutine();
    }
  }, [authState]);

  /* ---------------- finalize flag (preserve original feature) ---------------- */
  const FINALIZE_KEY = "deepcal_routine_finalized";
  const [finalizedFlag, setFinalizedFlagState] = useState<boolean>(false);
  useEffect(() => {
    setFinalizedFlagState(localStorage.getItem(FINALIZE_KEY) === "1");
  }, []);
  function setFinalizedFlag(v: boolean) {
    if (v) localStorage.setItem(FINALIZE_KEY, "1");
    else localStorage.removeItem(FINALIZE_KEY);
    setFinalizedFlagState(v);
  }

  // compute server-side presence: routine considered "set" if any day has items OR window
  const serverHasRoutine = useMemo(() => {
    const anyWindow = Object.values(windowsByDay).some((w) => !!w);
    const anyItems = Object.values(existingByDay).some((arr) => (arr?.length ?? 0) > 0);
    return anyWindow || anyItems;
  }, [windowsByDay, existingByDay]);

  const displayFinalized = serverHasRoutine || finalizedFlag;

  /* ---------------- day window editor ---------------- */
  const [windowOpen, setWindowOpen] = useState("09:00");
  const [windowClose, setWindowClose] = useState("18:00");
  const [windowDays, setWindowDays] = useState<Record<number, boolean>>({
    0: true,
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: true,
  });

  function setDaysPreset(type: "all" | "weekdays" | "weekends") {
    const base: Record<number, boolean> = {
      0: false,
      1: false,
      2: false,
      3: false,
      4: false,
      5: false,
      6: false,
    };
    if (type === "all") Object.keys(base).forEach((k) => (base[Number(k)] = true));
    if (type === "weekdays") [1, 2, 3, 4, 5].forEach((d) => (base[d] = true));
    if (type === "weekends") [0, 6].forEach((d) => (base[d] = true));
    setWindowDays(base);
  }

  async function applyWindowToSelected() {
    const days = Object.entries(windowDays)
      .filter(([, on]) => on)
      .map(([d]) => Number(d));
    const openMin = toMinutes(windowOpen),
      closeMin = toMinutes(windowClose);
    if (!(days.length && openMin < closeMin)) return;

    // confirmation modal (preserve feature)
    askConfirm({
      title: "Apply day window?",
      body: `Set ${fromMinutes(openMin)}–${fromMinutes(
        closeMin
      )} on ${days.map((d) => WEEKDAYS[d]).join(", ")} (overwrites).`,
      confirmText: "Apply",
      onConfirm: async () => {
        await apiJson("/api/deepcal/routine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applyTo: days,
            items: [],
            window: { openMin, closeMin },
          }),
        });
        await loadAllRoutine();
        setConfirmOpen(false);
      },
    });
  }

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
      window:
        key === "none"
          ? null
          : { openMin: Number(key.split("-")[0]), closeMin: Number(key.split("-")[1]) },
    }));
  }, [windowsByDay]);

  /* ---------------- composer: block + breaks → sprints ---------------- */
  const [bLabel, setBLabel] = useState("");
  const [bStart, setBStart] = useState("09:00");
  const [bEnd, setBEnd] = useState("13:00");
  const [bDepth, setBDepth] = useState<Depth>(3);
  const [bGoalId, setBGoalId] = useState<number | "">("");
  const [composerDays, setComposerDays] = useState<Record<number, boolean>>({
    0: false,
    1: true,
    2: true,
    3: true,
    4: true,
    5: true,
    6: false,
  });
  const [cbStart, setCbStart] = useState("");
  const [cbEnd, setCbEnd] = useState("");
  const [composerBreaks, setComposerBreaks] = useState<DraftBreak[]>([]);
  const [groups, setGroups] = useState<DraftGroup[]>([]);
  const [lastAddedIndex, setLastAddedIndex] = useState<number | null>(null);

  function addComposerBreak() {
    if (!cbStart || !cbEnd) return;
    const s = toMinutes(cbStart),
      e = toMinutes(cbEnd);
    const bs = toMinutes(bStart),
      be = toMinutes(bEnd);
    if (!(s < e) || s < bs || e > be) {
      askConfirm({
        title: "Invalid break",
        body: "Break must be within the block and start < end.",
        onConfirm: () => setConfirmOpen(false),
      });
      return;
    }
    if (composerBreaks.some((x) => overlaps(s, e, x.s, x.e))) {
      askConfirm({
        title: "Overlap",
        body: "Break overlaps another.",
        onConfirm: () => setConfirmOpen(false),
      });
      return;
    }
    setComposerBreaks([...composerBreaks, { s, e }].sort((a, b) => a.s - b.s));
    setCbStart("");
    setCbEnd("");
  }
  function removeComposerBreak(i: number) {
    setComposerBreaks(composerBreaks.filter((_, idx) => idx !== i));
  }

  function composeSprints(blockS: number, blockE: number, breaks: DraftBreak[]) {
    // merge overlapping breaks
    const merged: DraftBreak[] = [];
    for (const br of [...breaks].sort((a, b) => a.s - b.s)) {
      if (!merged.length || br.s > merged[merged.length - 1].e)
        merged.push({ ...br });
      else merged[merged.length - 1].e = Math.max(merged[merged.length - 1].e, br.e);
    }
    // create sprints
    const sprints: DraftSprint[] = [];
    let cur = blockS;
    for (const br of merged) {
      if (br.s > cur) sprints.push({ s: cur, e: br.s });
      cur = Math.max(cur, br.e);
    }
    if (cur < blockE) sprints.push({ s: cur, e: blockE });
    return { sprints, mergedBreaks: merged };
  }

  function draftedSprintsOverlap(sprints: DraftSprint[]) {
    for (const g of groups)
      for (const s1 of g.sprints)
        for (const s2 of sprints) if (overlaps(s1.s, s1.e, s2.s, s2.e)) return true;
    return false;
  }

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmBody, setConfirmBody] = useState<React.ReactNode>(null);
  const [confirmText, setConfirmText] = useState("Confirm");
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const confirmActionRef = useRef<null | (() => void | Promise<void>)>(null);

  function askConfirm(opts: {
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
    confirmActionRef.current = opts.onConfirm;
    setConfirmOpen(true);
  }

  async function addBlockWithBreaks() {
    if (!bGoalId) {
      askConfirm({
        title: "Pick a goal",
        onConfirm: () => setConfirmOpen(false),
      });
      return;
    }
    const bs = toMinutes(bStart),
      be = toMinutes(bEnd);
    if (!(bs < be)) {
      askConfirm({
        title: "Invalid block",
        body: "Start must be before end.",
        onConfirm: () => setConfirmOpen(false),
      });
      return;
    }
    const days = Object.entries(composerDays)
      .filter(([, on]) => on)
      .map(([d]) => Number(d));
    if (days.length === 0) {
      askConfirm({
        title: "No days selected",
        onConfirm: () => setConfirmOpen(false),
      });
      return;
    }

    const { sprints, mergedBreaks } = composeSprints(bs, be, composerBreaks);
    if (sprints.length === 0) {
      askConfirm({
        title: "Fully broken",
        body: "Breaks cover the whole block.",
        onConfirm: () => setConfirmOpen(false),
      });
      return;
    }
    if (draftedSprintsOverlap(sprints)) {
      askConfirm({
        title: "Overlaps draft",
        onConfirm: () => setConfirmOpen(false),
      });
      return;
    }

    // pre-warn for conflicts against existing items & windows (feature retained)
    const warnings: React.ReactNode[] = [];
    for (const d of days) {
      const win = windowsByDay[d];
      const items = existingByDay[d] ?? [];
      const outside = win
        ? sprints.filter((sp) => sp.s < win.openMin || sp.e > win.closeMin)
        : [];
      const ov: Array<{ s: number; e: number; label?: string | null }> = [];
      for (const sp of sprints)
        for (const it of items)
          if (overlaps(sp.s, sp.e, it.startMin, it.endMin))
            ov.push({
              s: Math.max(sp.s, it.startMin),
              e: Math.min(sp.e, it.endMin),
              label: it.label ?? null,
            });
      if (outside.length || ov.length) {
        warnings.push(
          <div key={d} className="mb-2">
            <div className="font-medium">{WEEKDAYS[d]}</div>
            <ul className="mt-1 list-disc pl-5 text-sm">
              {outside.map((o, i) => (
                <li key={`o${i}`}>
                  {fromMinutes(o.s)}–{fromMinutes(o.e)} outside day window
                </li>
              ))}
              {ov.map((o, i) => (
                <li key={`v${i}`}>
                  {fromMinutes(o.s)}–{fromMinutes(o.e)} overlaps existing
                  {o.label ? ` (${o.label})` : ""}
                </li>
              ))}
            </ul>
          </div>
        );
      }
    }

    const next: DraftGroup = {
      id: groups.length + 1,
      label: bLabel.trim() || undefined,
      startMin: bs,
      endMin: be,
      depthLevel: bDepth,
      goalId: Number(bGoalId),
      sprints,
      breaks: mergedBreaks,
      days,
    };

    if (warnings.length) {
      askConfirm({
        title: "Conflicts found — add to draft?",
        body: <div>{warnings}</div>,
        confirmText: "Add anyway",
        onConfirm: () => {
          setGroups([...groups, next].sort((a, b) => a.startMin - b.startMin));
          setLastAddedIndex(groups.length + 1);
          setBLabel("");
          setComposerBreaks([]);
          setConfirmOpen(false);
        },
      });
    } else {
      setGroups([...groups, next].sort((a, b) => a.startMin - b.startMin));
      setLastAddedIndex(groups.length + 1);
      setBLabel("");
      setComposerBreaks([]);
    }
  }

  function itemsByWeekdayFromGroups() {
    const map = new Map<
      number,
      Array<{
        startMin: number;
        endMin: number;
        depthLevel: Depth;
        goalId: number;
        label?: string;
      }>
    >();
    for (const g of groups) {
      const items = g.sprints.map((sp, i) => ({
        startMin: sp.s,
        endMin: sp.e,
        depthLevel: g.depthLevel,
        goalId: g.goalId,
        label: g.label ? `${g.label} — Sprint ${i + 1}` : undefined,
      }));
      for (const d of g.days) {
        const arr = map.get(d) ?? [];
        map.set(d, [...arr, ...items]);
      }
    }
    for (const [, arr] of map.entries()) arr.sort((a, b) => a.startMin - b.startMin);
    return map;
  }

  async function pushDraft() {
    if (groups.length === 0) {
      askConfirm({
        title: "Nothing to push",
        onConfirm: () => setConfirmOpen(false),
      });
      return;
    }
    const byDay = itemsByWeekdayFromGroups();
    if (byDay.size === 0) {
      askConfirm({
        title: "No days chosen",
        onConfirm: () => setConfirmOpen(false),
      });
      return;
    }

    // build conflict list for modal (preserve feature)
    const conflicts: Array<{
      weekday: number;
      overlaps: Array<{ s: number; e: number; existLabel?: string | null; label?: string }>;
    }> = [];
    for (const [wd, items] of byDay.entries()) {
      const ex = existingByDay[wd] ?? [];
      const list: Array<{ s: number; e: number; existLabel?: string | null; label?: string }> =
        [];
      for (const ni of items)
        for (const ei of ex)
          if (overlaps(ni.startMin, ni.endMin, ei.startMin, ei.endMin))
            list.push({
              s: Math.max(ni.startMin, ei.startMin),
              e: Math.min(ni.endMin, ei.endMin),
              existLabel: ei.label ?? null,
              label: ni.label,
            });
      if (list.length) conflicts.push({ weekday: wd, overlaps: list });
    }

    const write = async () => {
      for (const [weekday, items] of byDay.entries()) {
        await apiJson("/api/deepcal/routine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applyTo: [weekday],
            items: items.map((x, i) => ({ ...x, orderIndex: i })),
          }),
        });
      }
      await loadAllRoutine();
      setConfirmOpen(false);
    };

    if (conflicts.length) {
      askConfirm({
        title: "Overwrite existing routine?",
        destructive: true,
        confirmText: "Proceed & Overwrite",
        body: (
          <div className="max-h-64 overflow-auto">
            {conflicts.map((c, i) => (
              <div key={i} className="mb-2">
                <div className="font-medium">{WEEKDAYS[c.weekday]}</div>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {c.overlaps.map((o, j) => (
                    <li key={j}>
                      {fromMinutes(o.s)}–{fromMinutes(o.e)} • new: {o.label || "block"}
                      {o.existLabel ? ` • existing: ${o.existLabel}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ),
        onConfirm: write,
      });
    } else {
      askConfirm({
        title: "Push drafted blocks?",
        confirmText: "Push",
        body: "No conflicts detected.",
        onConfirm: write,
      });
    }
  }

  function clearDraft() {
    askConfirm({
      title: "Clear all drafted blocks?",
      destructive: true,
      confirmText: "Clear",
      onConfirm: () => {
        setGroups([]);
        setConfirmOpen(false);
      },
    });
  }

  async function clearDay(wd: number) {
    askConfirm({
      title: `Clear ${WEEKDAYS[wd]} routine + window?`,
      destructive: true,
      confirmText: "Clear",
      onConfirm: async () => {
        await apiJson(`/api/deepcal/routine?weekday=${wd}`, { method: "DELETE" });
        await loadAllRoutine();
        setConfirmOpen(false);
      },
    });
  }

  if (authState !== "authed") {
    return (
      <div className="mx-auto max-w-6xl p-5">
        <p className="text-gray-600">Loading…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-5 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Routine builder</h1>
        <p className="text-sm text-gray-600">
          Set day window → compose blocks (with breaks) → push to days.
        </p>
      </div>

      {/* Finalize / Modify — keeps original feature, but shows status from server too */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span
          className={`w-fit rounded-full px-2 py-1 text-xs ${
            displayFinalized
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {displayFinalized
            ? finalizedFlag
              ? "Routine is set"
              : "Routine is set (editing allowed)"
            : "Routine not finalized"}
        </span>
        {finalizedFlag ? (
          <button
            className="w-full sm:w-auto rounded-lg border px-3 py-1.5 text-sm"
            onClick={() => setFinalizedFlag(false)}
          >
            Modify routine
          </button>
        ) : (
          <button
            className="w-full sm:w-auto rounded-lg bg-black px-3 py-1.5 text-sm text-white"
            onClick={() => setFinalizedFlag(true)}
          >
            Finalize routine
          </button>
        )}
      </div>

      {/* 1) Day Window */}
      <section className="rounded-2xl border p-4">
        <h2 className="mb-3 text-lg font-semibold">1) Day Window</h2>
        <div className="grid gap-3 sm:grid-cols-5">
          <label className="space-y-1">
            <span className="text-sm text-gray-500">Open</span>
            <input
              type="time"
              className="w-full rounded-lg border px-3 py-2"
              value={windowOpen}
              onChange={(e) => setWindowOpen(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-500">Close</span>
            <input
              type="time"
              className="w-full rounded-lg border px-3 py-2"
              value={windowClose}
              onChange={(e) => setWindowClose(e.target.value)}
            />
          </label>
          <div className="sm:col-span-3">
            <div className="mb-2 text-sm text-gray-500">Apply to days</div>
            <div className="flex flex-wrap items-center gap-2">
              {WEEKDAYS.map((w, i) => (
                <button
                  key={w}
                  onClick={() => setWindowDays((s) => ({ ...s, [i]: !s[i] }))}
                  className={`rounded-lg px-3 py-1.5 text-sm ring-1 ring-gray-200 ${
                    windowDays[i] ? "bg-black text-white" : "bg-white"
                  }`}
                >
                  {w}
                </button>
              ))}
              <button
                onClick={() => setDaysPreset("weekdays")}
                className="rounded-lg border px-3 py-1.5 text-sm"
              >
                Weekdays
              </button>
              <button
                onClick={() => setDaysPreset("weekends")}
                className="rounded-lg border px-3 py-1.5 text-sm"
              >
                Weekends
              </button>
              <button
                onClick={() => setDaysPreset("all")}
                className="rounded-lg border px-3 py-1.5 text-sm"
              >
                All
              </button>
            </div>
          </div>
        </div>
        <div className="pt-3 flex flex-col gap-2 sm:flex-row">
          <button
            className="w-full sm:w-auto rounded-lg border px-3 py-1.5 text-sm"
            onClick={applyWindowToSelected}
          >
            Save window to selected days
          </button>
          <button
            className="w-full sm:w-auto rounded-lg border px-3 py-1.5 text-sm"
            onClick={loadAllRoutine}
          >
            Refresh
          </button>
        </div>

        {/* Deduped windows */}
        <div className="mt-4 rounded-xl border p-3">
          <div className="mb-2 text-sm font-semibold">Saved windows (grouped)</div>
          {groupedWindows.length === 0 ? (
            <div className="text-sm text-gray-500">No data.</div>
          ) : (
            <div className="space-y-2">
              {groupedWindows.map((g) => (
                <div
                  key={g.key}
                  className="flex flex-col gap-2 rounded-lg border p-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <span className="font-medium">
                      {g.window
                        ? `${fromMinutes(g.window.openMin)}–${fromMinutes(
                            g.window.closeMin
                          )}`
                        : "not set"}
                    </span>
                    <span className="text-gray-600">
                      {" "}
                      → {g.days.map((d) => WEEKDAYS[d]).join(", ")}
                    </span>
                  </div>
                  <button
                    className="w-full rounded-lg border px-2 py-1 text-xs sm:w-auto"
                    onClick={() => {
                      setWindowOpen(g.window ? fromMinutes(g.window.openMin) : "09:00");
                      setWindowClose(
                        g.window ? fromMinutes(g.window.closeMin) : "18:00"
                      );
                      const mapping: Record<number, boolean> = {
                        0: false,
                        1: false,
                        2: false,
                        3: false,
                        4: false,
                        5: false,
                        6: false,
                      };
                      g.days.forEach((d) => (mapping[d] = true));
                      setWindowDays(mapping);
                    }}
                  >
                    Load to editor
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 2) Block Composer */}
      <section className="rounded-2xl border p-4">
        <h2 className="mb-3 text-lg font-semibold">
          2) Compose Block (breaks → sprints)
        </h2>
        <p className="text-sm text-gray-600">
          Pick days, add breaks inside the block, generate sprints. Conflicts are
          checked before adding & on push.
        </p>

        <div className="mt-3 grid gap-3 sm:grid-cols-6">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-sm text-gray-500">Block name (optional)</span>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={bLabel}
              onChange={(e) => setBLabel(e.target.value)}
              placeholder="e.g. Research Focus"
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-500">Start</span>
            <input
              type="time"
              className="w-full rounded-lg border px-3 py-2"
              value={bStart}
              onChange={(e) => setBStart(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-500">End</span>
            <input
              type="time"
              className="w-full rounded-lg border px-3 py-2"
              value={bEnd}
              onChange={(e) => setBEnd(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-500">Depth</span>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={bDepth}
              onChange={(e) => setBDepth(Number(e.target.value) as Depth)}
            >
              <option value={3}>L3 (Deep)</option>
              <option value={2}>L2 (Medium)</option>
              <option value={1}>L1 (Light)</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm text-gray-500">Goal</span>
            <select
              className="w-full rounded-lg border px-3 py-2"
              value={bGoalId}
              onChange={(e) =>
                setBGoalId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">Pick goal</option>
              {goals.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* day toggles */}
        <div className="mt-3">
          <div className="mb-2 text-sm text-gray-500">Days this block applies to</div>
          <div className="flex flex-wrap items-center gap-2">
            {WEEKDAYS.map((w, i) => (
              <button
                key={w}
                onClick={() =>
                  setComposerDays((s) => ({
                    ...s,
                    [i]: !s[i],
                  }))
                }
                className={`rounded-lg px-3 py-1.5 text-sm ring-1 ring-gray-200 ${
                  composerDays[i] ? "bg-black text-white" : "bg-white"
                }`}
              >
                {w}
              </button>
            ))}
            <button
              onClick={() =>
                setComposerDays({
                  0: false,
                  1: true,
                  2: true,
                  3: true,
                  4: true,
                  5: true,
                  6: false,
                })
              }
              className="rounded-lg border px-3 py-1.5 text-sm"
            >
              Weekdays
            </button>
            <button
              onClick={() =>
                setComposerDays({
                  0: true,
                  1: false,
                  2: false,
                  3: false,
                  4: false,
                  5: false,
                  6: true,
                })
              }
              className="rounded-lg border px-3 py-1.5 text-sm"
            >
              Weekends
            </button>
            <button
              onClick={() =>
                setComposerDays({
                  0: true,
                  1: true,
                  2: true,
                  3: true,
                  4: true,
                  5: true,
                  6: true,
                })
              }
              className="rounded-lg border px-3 py-1.5 text-sm"
            >
              All
            </button>
          </div>
        </div>

        {/* breaks */}
        <div className="mt-4 rounded-lg border p-3">
          <div className="mb-2 text-sm font-semibold">Breaks within this block</div>
          <div className="grid gap-3 sm:grid-cols-5">
            <label className="space-y-1">
              <span className="text-sm text-gray-500">Break start</span>
              <input
                type="time"
                className="w-full rounded-lg border px-3 py-2"
                value={cbStart}
                onChange={(e) => setCbStart(e.target.value)}
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-500">Break end</span>
              <input
                type="time"
                className="w-full rounded-lg border px-3 py-2"
                value={cbEnd}
                onChange={(e) => setCbEnd(e.target.value)}
              />
            </label>
            <div className="flex items-end sm:col-span-3">
              <button
                onClick={addComposerBreak}
                className="w-full rounded-lg border px-3 py-2"
              >
                Add Break
              </button>
            </div>
          </div>
          {composerBreaks.length > 0 && (
            <div className="mt-3 space-y-2">
              {composerBreaks.map((br, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-2 rounded border p-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    {fromMinutes(br.s)}—{fromMinutes(br.e)}
                  </div>
                  <button
                    className="w-full rounded-lg border px-2 py-1 sm:w-auto"
                    onClick={() => removeComposerBreak(i)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 pt-3 sm:flex-row">
          <button
            onClick={addBlockWithBreaks}
            className="w-full rounded-lg bg-black px-4 py-2 text-white sm:w-auto"
          >
            Generate sprints for this block
          </button>
          {lastAddedIndex && (
            <span className="text-sm text-emerald-700">Block {lastAddedIndex} set ✓</span>
          )}
          <button
            onClick={clearDraft}
            className="w-full rounded-lg border px-4 py-2 sm:w-auto"
          >
            Clear Draft
          </button>
        </div>

        {/* Drafted blocks */}
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">Drafted Blocks</h3>
          {groups.length === 0 ? (
            <p className="text-sm text-gray-500">No blocks yet.</p>
          ) : (
            <div className="space-y-2">
              {groups.map((g, idx) => (
                <div key={g.id} className="rounded-xl border p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm">
                      <div className="font-medium">
                        Block {idx + 1}: {fromMinutes(g.startMin)}—{fromMinutes(g.endMin)}{" "}
                        {g.label ? `• ${g.label}` : ""}
                      </div>
                      <div className="text-gray-500">
                        L{g.depthLevel} •{" "}
                        {goals.find((x) => x.id === g.goalId)?.label ??
                          `Goal #${g.goalId}`}
                      </div>
                    </div>
                    <button
                      className="w-full rounded-lg border px-3 py-1.5 text-sm sm:w-auto"
                      onClick={() =>
                        askConfirm({
                          title: "Remove drafted block?",
                          destructive: true,
                          confirmText: "Remove",
                          onConfirm: () => {
                            setGroups(groups.filter((_, i) => i !== idx));
                            setConfirmOpen(false);
                          },
                        })
                      }
                    >
                      Remove
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <div>
                      <div className="text-xs font-semibold text-gray-600">Sprints</div>
                      <ul className="mt-1 space-y-1 text-sm">
                        {g.sprints.map((sp, i) => (
                          <li key={i} className="rounded border px-2 py-1">
                            Sprint {i + 1}: {fromMinutes(sp.s)}—{fromMinutes(sp.e)}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-gray-600">Breaks</div>
                      {g.breaks.length === 0 ? (
                        <div className="mt-1 text-sm text-gray-500">No breaks</div>
                      ) : (
                        <ul className="mt-1 space-y-1 text-sm">
                          {g.breaks.map((br, i) => (
                            <li key={i} className="rounded border px-2 py-1">
                              {fromMinutes(br.s)}—{fromMinutes(br.e)}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  {/* day toggles per drafted block WITH conflict warnings */}
                  <div className="mt-3">
                    <div className="mb-1 text-xs text-gray-600">Days</div>
                    <div className="flex flex-wrap items-center gap-2">
                      {WEEKDAYS.map((w, i) => {
                        const on = g.days.includes(i);
                        return (
                          <button
                            key={w}
                            onClick={() => {
                              const exists = g.days.includes(i);
                              if (exists) {
                                setGroups((prev) => {
                                  const next = [...prev];
                                  next[idx] = {
                                    ...g,
                                    days: g.days.filter((d) => d !== i),
                                  };
                                  return next;
                                });
                              } else {
                                const win = windowsByDay[i];
                                const ex = existingByDay[i] ?? [];
                                const outside = win
                                  ? g.sprints.some(
                                      (sp) =>
                                        sp.s < win.openMin || sp.e > win.closeMin
                                    )
                                  : false;
                                const hasOv = g.sprints.some((sp) =>
                                  ex.some((it) =>
                                    overlaps(sp.s, sp.e, it.startMin, it.endMin)
                                  )
                                );
                                if (outside || hasOv) {
                                  askConfirm({
                                    title: `Conflicts on ${WEEKDAYS[i]} — add day?`,
                                    body: (
                                      <div className="text-sm">
                                        {outside && (
                                          <div>• One or more sprints outside day window</div>
                                        )}
                                        {hasOv && <div>• Overlaps existing blocks</div>}
                                      </div>
                                    ),
                                    confirmText: "Add anyway",
                                    onConfirm: () => {
                                      setGroups((prev) => {
                                        const next = [...prev];
                                        next[idx] = {
                                          ...g,
                                          days: [...g.days, i].sort((a, b) => a - b),
                                        };
                                        return next;
                                      });
                                      setConfirmOpen(false);
                                    },
                                  });
                                } else {
                                  setGroups((prev) => {
                                    const next = [...prev];
                                    next[idx] = {
                                      ...g,
                                      days: [...g.days, i].sort((a, b) => a - b),
                                    };
                                    return next;
                                  });
                                }
                              }
                            }}
                            className={`rounded-lg px-2.5 py-1 text-xs ring-1 ring-gray-200 ${
                              on ? "bg-black text-white" : "bg-white"
                            }`}
                          >
                            {w}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 3) Push */}
      <section className="rounded-2xl border p-4">
        <h2 className="mb-3 text-lg font-semibold">3) Push Draft</h2>
        <p className="text-sm text-gray-600">
          We’ll warn on overlaps before writing (overwrite requires confirmation).
        </p>
        <button
          onClick={pushDraft}
          className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2 text-white sm:w-auto"
        >
          Push drafted to selected days
        </button>
      </section>

      {/* Existing */}
      <section className="rounded-2xl border p-4">
        <h2 className="mb-3 text-lg font-semibold">Existing Routine (by day)</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(existingByDay).map(([d, items]) => {
            const day = Number(d);
            const win = windowsByDay[day];
            return (
              <div key={d} className="rounded-xl border p-3">
                <div className="mb-1 text-sm text-gray-600">
                  Day: <b>{WEEKDAYS[day]}</b> • Window:{" "}
                  {win
                    ? `${fromMinutes(win.openMin)}–${fromMinutes(win.closeMin)}`
                    : "not set"}
                </div>
                {items.length === 0 ? (
                  <div className="text-sm text-gray-500">No blocks.</div>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {items.map((it) => (
                      <li key={it.id} className="rounded border px-2 py-1">
                        {fromMinutes(it.startMin)}–{fromMinutes(it.endMin)}{" "}
                        {it.label ? `• ${it.label}` : ""} (L{it.depthLevel})
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-2">
                  <button
                    className="w-full rounded-lg border px-3 py-1.5 text-xs sm:w-auto"
                    onClick={() => clearDay(day)}
                  >
                    Clear this day
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        body={confirmBody}
        confirmText={confirmText}
        destructive={confirmDestructive}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          confirmActionRef.current?.();
        }}
      />
    </div>
  );
}

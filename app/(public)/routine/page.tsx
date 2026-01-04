"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";

/* ================= Types ================= */
type AuthState = "loading" | "authed" | "anon";
type Depth = 1 | 2 | 3;
type Goal = { id: number; label: string; color: string; deadlineISO?: string | null; parentGoalId?: number | null };
type RoutineWindow = { openMin: number; closeMin: number } | null;
type DraftSprint = { s: number; e: number };
type DraftBreak = { s: number; e: number };
type DraftGroup = {
  id: number;
  label?: string;           // used as Task for single-day too
  startMin: number;
  endMin: number;
  depthLevel: Depth;
  goalId: number;           // required only for standing updates
  sprints: DraftSprint[];
  breaks: DraftBreak[];
  days: number[];           // weekdays 0..6 (only for standing updates)
};
type RoutineItem = {
  id: number;
  startMin: number;
  endMin: number;
  depthLevel: 1 | 2 | 3;
  goalId: number;
  label?: string | null;
};

type ApiResp<T> = { ok: boolean; status: number; json: T };
async function apiJson<T>(input: RequestInfo, init?: RequestInit): Promise<ApiResp<T>> {
  const r = await fetch(input, init);
  const isJson = r.headers.get("content-type")?.includes("application/json");
  const j = (isJson ? await r.json().catch(() => ({})) : {}) as T;
  return { ok: r.ok, status: r.status, json: j };
}

/* ================= Utils ================= */
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const toMinutes = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const pad = (n: number) => String(n).padStart(2, "0");
const fromMinutes = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const overlaps = (aS: number, aE: number, bS: number, bE: number) => Math.max(aS, bS) < Math.min(aE, bE);
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const weekdayFromISO = (dateISO: string) => new Date(`${dateISO}T00:00:00`).getDay();

/** range helpers */
type Range = { s: number; e: number };
const FULL_DAY: Range = { s: 0, e: 24 * 60 };

function mergeRanges(ranges: Range[]): Range[] {
  if (!ranges.length) return [];
  const arr = ranges.slice().sort((a,b)=> a.s - b.s);
  const out: Range[] = [];
  for (const r of arr) {
    if (!out.length || r.s > out[out.length-1].e) out.push({ ...r });
    else out[out.length-1].e = Math.max(out[out.length-1].e, r.e);
  }
  return out;
}
function intersect(a: Range, b: Range): Range | null {
  const s = Math.max(a.s, b.s);
  const e = Math.min(a.e, b.e);
  return s < e ? { s, e } : null;
}
function clampToBase(ranges: Range[], base: Range): Range[] {
  if (!ranges.length) return [];
  const out: Range[] = [];
  for (const r of ranges) {
    const x = intersect(r, base);
    if (x) out.push(x);
  }
  return mergeRanges(out);
}
function subtractRanges(base: Range, blocked: Range[]): Range[] {
  if (!blocked.length) return [base];
  const blk = mergeRanges(blocked);
  let curS = base.s;
  const out: Range[] = [];
  for (const b of blk) {
    if (b.e <= curS) continue;
    if (b.s >= base.e) break;
    if (b.s > curS) out.push({ s: curS, e: Math.min(b.s, base.e) });
    curS = Math.max(curS, b.e);
    if (curS >= base.e) break;
  }
  if (curS < base.e) out.push({ s: curS, e: base.e });
  return out.filter(r => r.e > r.s);
}
function sprintsWithinAllowed(sprints: Range[], allowed: Range[]) {
  return sprints.every(sp => allowed.some(a => a.s <= sp.s && sp.e <= a.e));
}

/* ================= Confirm dialog (up to 3 actions) ================= */
function ConfirmDialog({
  open,
  title,
  body,
  confirmText = "Confirm",
  destructive = false,
  onCancel,
  onConfirm,
  secondaryText,
  secondaryDestructive,
  onSecondary,
  tertiaryText,
  tertiaryDestructive,
  onTertiary,
}: {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmText?: string;
  destructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  secondaryText?: string;
  secondaryDestructive?: boolean;
  onSecondary?: () => void | Promise<void>;
  tertiaryText?: string;
  tertiaryDestructive?: boolean;
  onTertiary?: () => void | Promise<void>;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="text-lg font-semibold">{title}</div>
        {body && <div className="mt-2 text-sm text-gray-700">{body}</div>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button className="rounded-lg border px-4 py-2" onClick={onCancel}>Cancel</button>
          {tertiaryText && onTertiary && (
            <button
              className={`rounded-lg px-4 py-2 text-white ${tertiaryDestructive ? "bg-red-600" : "bg-gray-700"}`}
              onClick={onTertiary}
            >
              {tertiaryText}
            </button>
          )}
          {secondaryText && onSecondary && (
            <button
              className={`rounded-lg px-4 py-2 text-white ${secondaryDestructive ? "bg-red-600" : "bg-gray-800"}`}
              onClick={onSecondary}
            >
              {secondaryText}
            </button>
          )}
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

/* ================= Page ================= */
export default function RoutinePage() {
  /* ---------- auth gate ---------- */
  const [authState, setAuthState] = useState<AuthState>("loading");

  useEffect(() => {
    (async () => {
      const res = await apiJson<Record<string, unknown>>("/api/deepcal/goals");
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

  /* ---------- server data ---------- */
  const [goals, setGoals] = useState<Goal[]>([]);
  const [windowsByDay, setWindowsByDay] = useState<Record<number, RoutineWindow>>({});
  const [existingByDay, setExistingByDay] = useState<Record<number, RoutineItem[]>>({});
  const goalMap = useMemo(() => {
    const m = new Map<number, Goal>();
    goals.forEach((g) => m.set(g.id, g));
    return m;
  }, [goals]);

  const loadGoals = useCallback(async () => {
    const { ok, json } = await apiJson<{ goals: Goal[] }>("/api/deepcal/goals");
    if (ok) setGoals(json.goals ?? []);
  }, []);

  const loadAllRoutine = useCallback(async () => {
    const results = await Promise.all(
      [0, 1, 2, 3, 4, 5, 6].map((d) =>
        apiJson<{ window: RoutineWindow; items: RoutineItem[] }>(`/api/deepcal/routine?weekday=${d}`)
      )
    );
    const wmap: Record<number, RoutineWindow> = {};
    const emap: Record<number, RoutineItem[]> = {};
    results.forEach((res, idx) => {
      if (res.ok) {
        wmap[idx] = res.json.window ?? null;
        emap[idx] = (res.json.items ?? []).slice().sort((a, b) => a.startMin - b.startMin);
      }
    });
    setWindowsByDay(wmap);
    setExistingByDay(emap);
  }, []);

  // Today open-state → locks the weekday
  type DayOpenResp = { pack: { openedAt?: string | null; shutdownAt?: string | null } | null };
  const [todayOpen, setTodayOpen] = useState(false);
  const todayWeekday = useMemo(() => new Date().getDay(), []);
  const loadTodayOpen = useCallback(async () => {
    const res = await apiJson<DayOpenResp>(`/api/deepcal/day?date=${encodeURIComponent(todayISO())}`);
    const p = res.ok ? res.json.pack : null;
    setTodayOpen(!!(p?.openedAt && !p.shutdownAt));
  }, []);
  const lockedWeekdays = useMemo(() => new Set<number>(todayOpen ? [todayWeekday] : []), [todayOpen, todayWeekday]);

  useEffect(() => {
    if (authState === "authed") {
      void loadGoals();
      void loadAllRoutine();
      void loadTodayOpen();
    }
  }, [authState, loadGoals, loadAllRoutine, loadTodayOpen]);

  /* ---------- tabs ---------- */
  type Tab = "window" | "standing" | "single-day";
  const [tab, setTab] = useState<Tab>("single-day");

  /* ---------- Single-day: detail mode & date ---------- */
  type PlanDetail = "entire" | "gaps";
  const [planDetail, setPlanDetail] = useState<PlanDetail>("entire");
  const [dateISO, setDateISO] = useState<string>(todayISO());

  /* ---------- Day window editor state (tab: window) ---------- */
  const [windowOpen, setWindowOpen] = useState("09:00");
  const [windowClose, setWindowClose] = useState("18:00");
  const [windowDays, setWindowDays] = useState<Record<number, boolean>>({
    0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true,
  });

  // If a weekday is locked, make sure it&apos;s not preselected in editors
  useEffect(() => {
    if (lockedWeekdays.size) {
      setWindowDays((s) => {
        const next = { ...s };
        lockedWeekdays.forEach((d) => (next[d] = false));
        return next;
      });
      setComposerDays((s) => {
        const next = { ...s };
        lockedWeekdays.forEach((d) => (next[d] = false));
        return next;
      });
      setGroups((prev) =>
        prev.map((g) => ({ ...g, days: g.days.filter((d) => !lockedWeekdays.has(d)) }))
      );
    }
  }, [lockedWeekdays]);

  function setDaysPreset(type: "all" | "weekdays" | "weekends") {
    const base: Record<number, boolean> = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
    if (type === "all") Object.keys(base).forEach((k) => (base[Number(k)] = true));
    if (type === "weekdays") [1, 2, 3, 4, 5].forEach((d) => (base[d] = true));
    if (type === "weekends") [0, 6].forEach((d) => (base[d] = true));
    // clear locked
    lockedWeekdays.forEach((d) => (base[d] = false));
    setWindowDays(base);
  }

  async function applyWindowToSelected() {
    const days = Object.entries(windowDays).filter(([, on]) => on).map(([d]) => Number(d));
    const openMin = toMinutes(windowOpen), closeMin = toMinutes(windowClose);
    if (!(days.length && openMin < closeMin)) return;

    const locked = days.filter((d) => lockedWeekdays.has(d));
    if (locked.length) {
      askConfirm({
  title: "Can&apos;t change window for an opened day",
        body: `Locked: ${locked.map((d) => WEEKDAYS[d]).join(", ")} (day is opened).`,
        onConfirm: () => setConfirmOpen(false),
      });
      return;
    }

    askConfirm({
      title: "Apply day window?",
      body: `Set ${fromMinutes(openMin)}–${fromMinutes(closeMin)} on ${days.map((d) => WEEKDAYS[d]).join(", ")} (overwrites).`,
      confirmText: "Apply",
      onConfirm: async () => {
        await apiJson("/api/deepcal/routine", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applyTo: days, items: [], window: { openMin, closeMin } }),
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
      window: key === "none" ? null : { openMin: Number(key.split("-")[0]), closeMin: Number(key.split("-")[1]) },
    }));
  }, [windowsByDay]);

  /* ---------- confirm dialog ---------- */
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmBody, setConfirmBody] = useState<React.ReactNode>(null);
  const [confirmText, setConfirmText] = useState("Confirm");
  const [confirmDestructive, setConfirmDestructive] = useState(false);
  const [secondaryText, setSecondaryText] = useState<string | undefined>(undefined);
  const [secondaryDestructive, setSecondaryDestructive] = useState<boolean | undefined>(undefined);
  const [tertiaryText, setTertiaryText] = useState<string | undefined>(undefined);
  const [tertiaryDestructive, setTertiaryDestructive] = useState<boolean | undefined>(undefined);
  const confirmActionRef = useRef<null | (() => void | Promise<void>)>(null);
  const secondaryActionRef = useRef<null | (() => void | Promise<void>)>(null);
  const tertiaryActionRef = useRef<null | (() => void | Promise<void>)>(null);

  function askConfirm(opts: {
    title: string;
    body?: React.ReactNode;
    confirmText?: string;
    destructive?: boolean;
    onConfirm: () => void | Promise<void>;
    secondaryText?: string;
    secondaryDestructive?: boolean;
    onSecondary?: () => void | Promise<void>;
    tertiaryText?: string;
    tertiaryDestructive?: boolean;
    onTertiary?: () => void | Promise<void>;
  }) {
    setConfirmTitle(opts.title);
    setConfirmBody(opts.body ?? null);
    setConfirmText(opts.confirmText ?? "Confirm");
    setConfirmDestructive(!!opts.destructive);
    setSecondaryText(opts.secondaryText);
    setSecondaryDestructive(opts.secondaryDestructive);
    setTertiaryText(opts.tertiaryText);
    setTertiaryDestructive(opts.tertiaryDestructive);
    confirmActionRef.current = opts.onConfirm;
    secondaryActionRef.current = opts.onSecondary ?? null;
    tertiaryActionRef.current = opts.onTertiary ?? null;
    setConfirmOpen(true);
  }

  /* ---------- composer ---------- */
  const [bLabel, setBLabel] = useState("");           // Task/Block name
  const [bStart, setBStart] = useState("09:00");
  const [bEnd, setBEnd] = useState("13:00");
  const [bDepth, setBDepth] = useState<Depth>(3);
  const [bGoalId, setBGoalId] = useState<number | "">(""); // used only in Standing tab
  const [composerDays, setComposerDays] = useState<Record<number, boolean>>({
    0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false,
  });
  const [cbStart, setCbStart] = useState("");
  const [cbEnd, setCbEnd] = useState("");
  const [composerBreaks, setComposerBreaks] = useState<DraftBreak[]>([]);
  const [groups, setGroups] = useState<DraftGroup[]>([]);
  const [lastAddedIndex, setLastAddedIndex] = useState<number | null>(null);

  // ===== Window helpers =====
  const windowRangeForDay = useCallback((wd: number): Range | null => {
    const w = windowsByDay[wd];
    return w ? { s: w.openMin, e: w.closeMin } : null;
  }, [windowsByDay]);

  // ======== Gaps preview (Only-Today → Fill only gaps) — window-aware ========
  const wdForDate = useMemo(() => weekdayFromISO(dateISO), [dateISO]);
  const baseToday: Range = useMemo(() => windowRangeForDay(wdForDate) ?? FULL_DAY, [windowRangeForDay, wdForDate]);
  const blockedStandingToday = useMemo<Range[]>(() => {
    const list = existingByDay[wdForDate] ?? [];
    const raw = list.map(i => ({ s: i.startMin, e: i.endMin }));
    return clampToBase(raw, baseToday);
  }, [existingByDay, wdForDate, baseToday]);
  const gapsToday = useMemo<Range[]>(() => subtractRanges(baseToday, blockedStandingToday), [baseToday, blockedStandingToday]);

  // ====== Sprint composition ======
  function composeSprints(blockS: number, blockE: number, breaks: DraftBreak[]) {
    const merged: DraftBreak[] = [];
    for (const br of [...breaks].sort((a, b) => a.s - b.s)) {
      if (!merged.length || br.s > merged[merged.length - 1].e) merged.push({ ...br });
      else merged[merged.length - 1].e = Math.max(merged[merged.length - 1].e, br.e);
    }
    const sprints: DraftSprint[] = [];
    let cur = blockS;
    for (const br of merged) {
      if (br.s > cur) sprints.push({ s: cur, e: br.s });
      cur = Math.max(cur, br.e);
    }
    if (cur < blockE) sprints.push({ s: cur, e: blockE });
    return { sprints, mergedBreaks: merged };
  }
  const draftedSprintsOverlap = (sprints: DraftSprint[]) =>
    groups.some((g) => g.sprints.some((s1) => sprints.some((s2) => overlaps(s1.s, s1.e, s2.s, s2.e))));

  // ====== Break controls ======
  function addComposerBreak() {
    if (!cbStart || !cbEnd) return;
    const s = toMinutes(cbStart), e = toMinutes(cbEnd);
    const bs = toMinutes(bStart), be = toMinutes(bEnd);
    if (!(s < e) || s < bs || e > be) {
      askConfirm({ title: "Invalid break", body: "Break must be within the block and start < end.", onConfirm: () => setConfirmOpen(false) });
      return;
    }
    if (composerBreaks.some((x) => overlaps(s, e, x.s, x.e))) {
      askConfirm({ title: "Overlap", body: "Break overlaps another.", onConfirm: () => setConfirmOpen(false) });
      return;
    }
    setComposerBreaks([...composerBreaks, { s, e }].sort((a, b) => a.s - b.s));
    setCbStart(""); setCbEnd("");
  }
  function removeComposerBreak(i: number) { setComposerBreaks(composerBreaks.filter((_, idx) => idx !== i)); }

  // ====== Add drafted block (validations include Day-Window constraints) ======
  function addBlockWithBreaks() {
    if (tab === "single-day") {
      // Only-for-today flow
      if (!bLabel.trim()) {
        askConfirm({ title: "Add a task name", body: "Task is required for Only-Today modes.", onConfirm: () => setConfirmOpen(false) });
        return;
      }
      const bs = toMinutes(bStart), be = toMinutes(bEnd);
      if (!(bs < be)) {
        askConfirm({ title: "Invalid block", body: "Start must be before end.", onConfirm: () => setConfirmOpen(false) });
        return;
      }
      // Day Window bound (specific date)
      const w = windowRangeForDay(wdForDate);
      if (w && !(w.s <= bs && be <= w.e)) {
        askConfirm({
          title: "Outside of Day Window",
          body: `For ${WEEKDAYS[wdForDate]}, times must be within ${fromMinutes(w.s)}–${fromMinutes(w.e)}.`,
          onConfirm: () => setConfirmOpen(false),
        });
        return;
      }
      const { sprints: rawSprints, mergedBreaks } = composeSprints(bs, be, composerBreaks);
      if (rawSprints.length === 0) {
        askConfirm({ title: "Fully broken", body: "Breaks cover the whole block.", onConfirm: () => setConfirmOpen(false) });
        return;
      }
      // Strict blocking when "Fill only gaps"
      if (planDetail === "gaps") {
        const ok = sprintsWithinAllowed(rawSprints, gapsToday);
        if (!ok) {
          askConfirm({
            title: "Outside available gaps",
            body: (
              <div className="text-sm">
                <div className="mb-2">With <b>Fill only gaps</b>, sprints must fit entirely inside today&apos;s gaps (bounded by Day Window).</div>
                <div className="mb-1 font-medium">Available gaps</div>
                {gapsToday.length ? (
                  <ul className="list-disc pl-5">
                    {gapsToday.map((g,i)=> <li key={i}>{fromMinutes(g.s)}–{fromMinutes(g.e)}</li>)}
                  </ul>
                ) : (
                  <div className="text-gray-600">No gaps available today.</div>
                )}
              </div>
            ),
            onConfirm: () => setConfirmOpen(false),
          });
          return;
        }
      }
      if (draftedSprintsOverlap(rawSprints)) {
        askConfirm({ title: "Overlaps another draft block", onConfirm: () => setConfirmOpen(false) });
        return;
      }

      const next: DraftGroup = {
        id: groups.length + 1,
        label: bLabel.trim() || undefined,
        startMin: bs,
        endMin: be,
        depthLevel: bDepth,
        goalId: -1,
        sprints: rawSprints,
        breaks: mergedBreaks,
        days: [],
      };
      setGroups([...groups, next].sort((a, b) => a.startMin - b.startMin));
      setLastAddedIndex(groups.length + 1);
      setBLabel("");
      setComposerBreaks([]);
      return;
    }

    // Standing tab flow
    if (!bGoalId) {
      askConfirm({ title: "Pick a goal", body: "Standing changes require a goal.", onConfirm: () => setConfirmOpen(false) });
      return;
    }
    const bs = toMinutes(bStart), be = toMinutes(bEnd);
    if (!(bs < be)) {
      askConfirm({ title: "Invalid block", body: "Start must be before end.", onConfirm: () => setConfirmOpen(false) });
      return;
    }
    const days = Object.entries(composerDays).filter(([, on]) => on).map(([d]) => Number(d));
    if (days.length === 0) {
      askConfirm({ title: "Select weekdays", onConfirm: () => setConfirmOpen(false) });
      return;
    }

    // Enforce lock (opened day)
    const locked = days.filter((d) => lockedWeekdays.has(d));
    if (locked.length) {
      askConfirm({
        title: "Day is opened — locked",
  body: `Can&apos;t draft for: ${locked.map((d) => WEEKDAYS[d]).join(", ")}.`,
        onConfirm: () => setConfirmOpen(false),
      });
      return;
    }

    // Enforce Day Window per selected day (when set)
    const sprintBoundsError: string[] = [];
    for (const wd of days) {
      const w = windowRangeForDay(wd);
      if (!w) continue;
      if (!(w.s <= bs && be <= w.e)) {
        sprintBoundsError.push(`${WEEKDAYS[wd]} (${fromMinutes(w.s)}–${fromMinutes(w.e)})`);
      }
    }
    if (sprintBoundsError.length) {
      askConfirm({
        title: "Outside of Day Window",
        body: (
          <div className="text-sm">
            <div className="mb-2">Blocks must be within the Day Window:</div>
            <ul className="list-disc pl-5">
              {sprintBoundsError.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          </div>
        ),
        onConfirm: () => setConfirmOpen(false),
      });
      return;
    }
    const { sprints: rawSprints, mergedBreaks } = composeSprints(bs, be, composerBreaks);
    if (rawSprints.length === 0) {
      askConfirm({ title: "Fully broken", body: "Breaks cover the whole block.", onConfirm: () => setConfirmOpen(false) });
      return;
    }
    if (draftedSprintsOverlap(rawSprints)) {
      askConfirm({ title: "Overlaps another draft block", onConfirm: () => setConfirmOpen(false) });
      return;
    }

    const next: DraftGroup = {
      id: groups.length + 1,
      label: bLabel.trim() || undefined,
      startMin: bs,
      endMin: be,
      depthLevel: bDepth,
      goalId: Number(bGoalId),
      sprints: rawSprints,
      breaks: mergedBreaks,
      days,
    };
    setGroups([...groups, next].sort((a, b) => a.startMin - b.startMin));
    setLastAddedIndex(groups.length + 1);
    setBLabel("");
    setComposerBreaks([]);
  }

  function itemsByWeekdayFromGroups() {
    const map = new Map<number, Array<{ startMin: number; endMin: number; depthLevel: Depth; goalId: number; label?: string }>>();
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

  /* ---------- finalize / push ---------- */
  async function pushDraft() {
    if (groups.length === 0) {
      askConfirm({ title: "Nothing to push", onConfirm: () => setConfirmOpen(false) });
      return;
    }

    // ===== Standing tab flow =====
    if (tab === "standing") {
      const byDay = itemsByWeekdayFromGroups();
      if (byDay.size === 0) {
        askConfirm({ title: "No days chosen", onConfirm: () => setConfirmOpen(false) });
        return;
      }

      // Prevent writing to locked day(s)
      const lockedUsed = Array.from(byDay.keys()).filter((d) => lockedWeekdays.has(d));
      if (lockedUsed.length) {
        askConfirm({
          title: "Can&apos;t push to opened day",
          body: `Locked: ${lockedUsed.map((d) => WEEKDAYS[d]).join(", ")}`,
          onConfirm: () => setConfirmOpen(false),
        });
        return;
      }

  // Window-aware clip (ensure we don&apos;t write outside window if set)
      const clippedByDay = new Map<number, Array<{ startMin: number; endMin: number; depthLevel: Depth; goalId: number; label?: string }>>();
      for (const [wd, items] of byDay.entries()) {
        const base = windowRangeForDay(wd) ?? FULL_DAY;
        const clipped: Array<{ startMin: number; endMin: number; depthLevel: Depth; goalId: number; label?: string }> = [];
        for (const it of items) {
          const cut = intersect({ s: it.startMin, e: it.endMin }, base);
          if (cut) clipped.push({ ...it, startMin: cut.s, endMin: cut.e });
        }
        clipped.sort((a,b)=> a.startMin - b.startMin);
        clippedByDay.set(wd, clipped);
      }

      // conflict preview vs existing standing
      const conflicts: Array<{ weekday: number; overlaps: Array<{ s: number; e: number; existLabel?: string | null; label?: string }> }> = [];
      for (const [wd, items] of clippedByDay.entries()) {
        const ex = existingByDay[wd] ?? [];
        const list: Array<{ s: number; e: number; existLabel?: string | null; label?: string }> = [];
        for (const ni of items)
          for (const ei of ex)
            if (overlaps(ni.startMin, ni.endMin, ei.startMin, ei.endMin))
              list.push({ s: Math.max(ni.startMin, ei.startMin), e: Math.min(ni.endMin, ei.endMin), existLabel: ei.label ?? null, label: ni.label });
        if (list.length) conflicts.push({ weekday: wd, overlaps: list });
      }

      const write = async () => {
        for (const [weekday, items] of clippedByDay.entries()) {
          if (!items.length) continue;
          await apiJson("/api/deepcal/routine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ applyTo: [weekday], items: items.map((x, i) => ({ ...x, orderIndex: i })) }),
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
      return;
    }

    // ===== Only-for-today (Single-Day tab) =====
    const items = groups
      .flatMap((g) =>
        g.sprints.map((sp, i) => ({
          startMin: sp.s,
          endMin: sp.e,
          depthLevel: g.depthLevel,
          label: g.label ? `${g.label} — Sprint ${i + 1}` : undefined,
        }))
      )
      .sort((a, b) => a.startMin - b.startMin);

    // Clip items to today's window if set (safety)
    const baseToday = windowRangeForDay(wdForDate) ?? FULL_DAY;
    const clippedItems = items
      .map(it => {
        const cut = intersect({ s: it.startMin, e: it.endMin }, baseToday);
        return cut ? { ...it, startMin: cut.s, endMin: cut.e } : null;
      })
      .filter(Boolean) as typeof items;

    const preview = await apiJson<{ conflicts: Array<{ startMin: number; endMin: number; withLabel?: string | null }> }>(
      "/api/deepcal/day/plan/conflicts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateISO, items: clippedItems }),
      }
    );

    const doMergeOverwrite = async () => {
      await apiJson(`/api/deepcal/day/plan?overwrite=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateISO, items: clippedItems, strategy: "merge" }),
      });
      setConfirmOpen(false);
    };
    const doReplace = async () => {
      await apiJson(`/api/deepcal/day/plan?overwrite=1`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateISO, items: clippedItems, strategy: "replace" }),
      });
      setConfirmOpen(false);
    };
    const doOnlyTodayKeepStanding = async () => {
      const blocked = mergeRanges((preview.json.conflicts ?? []).map(c => ({ s: c.startMin, e: c.endMin })));
      const trimmed: typeof clippedItems = [];
      for (const it of clippedItems) {
        const parts = subtractRanges({ s: it.startMin, e: it.endMin }, blocked);
        for (const p of parts) trimmed.push({ ...it, startMin: p.s, endMin: p.e });
      }
      if (trimmed.length === 0) { setConfirmOpen(false); return; }
      await apiJson(`/api/deepcal/day/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateISO, items: trimmed, strategy: "merge" }),
      });
      setConfirmOpen(false);
    };
    const doMergeNoOverwrite = async () => {
      const r = await apiJson(`/api/deepcal/day/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dateISO, items: clippedItems, strategy: "merge" }),
      });
      if (!r.ok && r.status === 409) {
        askConfirm({
          title: "Conflicts exist — choose a strategy",
          body: "Pick how to resolve overlaps with today's schedule.",
          confirmText: "Only today (keep standing as-is)",
          onConfirm: doOnlyTodayKeepStanding,
          secondaryText: "Merge & Overwrite",
          onSecondary: doMergeOverwrite,
          tertiaryText: "Replace day",
          tertiaryDestructive: true,
          onTertiary: doReplace,
        });
        return;
      }
      setConfirmOpen(false);
    };

    if (preview.ok && preview.json.conflicts.length > 0) {
      askConfirm({
        title: `Conflicts on ${dateISO}`,
        body: (
          <div className="text-sm">
            <div className="mb-2 font-medium">Overlapping ranges:</div>
            <ul className="list-disc pl-5">
              {preview.json.conflicts.map((c, i) => (
                <li key={i}>
                  {fromMinutes(c.startMin)}–{fromMinutes(c.endMin)}
                  {c.withLabel ? ` • existing: ${c.withLabel}` : ""}
                </li>
              ))}
            </ul>
            <div className="mt-2 text-gray-700 space-y-1">
              <div><b>Only today (keep standing as-is)</b>: add only the non-overlapping parts.</div>
              <div><b>Merge & Overwrite</b>: replace just the overlapping slots.</div>
              <div><b>Replace day</b>: wipe the day and set this plan.</div>
            </div>
          </div>
        ),
        confirmText: "Only today (keep standing as-is)",
        onConfirm: doOnlyTodayKeepStanding,
        secondaryText: "Merge & Overwrite",
        onSecondary: doMergeOverwrite,
        tertiaryText: "Replace day",
        tertiaryDestructive: true,
        onTertiary: doReplace,
      });
    } else {
      askConfirm({
        title: `Finalize Only-Today Plan (${dateISO})?`,
        confirmText: "Finalize",
  body: "No conflicts detected. We&apos;ll merge your plan into the day.",
        onConfirm: doMergeNoOverwrite,
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
    if (lockedWeekdays.has(wd)) {
      askConfirm({
  title: "Can&apos;t clear opened day",
        body: `${WEEKDAYS[wd]} is locked because the day is opened.`,
        onConfirm: () => setConfirmOpen(false),
      });
      return;
    }
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

  /* ================= Render ================= */
  return (
    <div className="mx-auto max-w-6xl p-5 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Routine builder</h1>
        <p className="text-sm text-gray-600">
          Manage your <b>Day Window</b>, weekly <b>Standing Routine</b>, or a one-off <b>Single-Day Plan</b>.
        </p>

        {/* Lock status strip */}
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className={`rounded-full px-2 py-1 ${todayOpen ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>
            Today: {todayOpen ? "Opened — edits to " + WEEKDAYS[todayWeekday] + " are locked" : "Closed — all weekdays editable"}
          </span>
        </div>

        {/* Tabs */}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="rounded-xl border p-1">
            <button
              className={`rounded-lg px-3 py-1 text-sm ${tab === "window" ? "bg-black text-white" : ""}`}
              onClick={() => setTab("window")}
            >
              Day Window
            </button>
            <button
              className={`rounded-lg px-3 py-1 text-sm ${tab === "standing" ? "bg-black text-white" : ""}`}
              onClick={() => setTab("standing")}
            >
              Standing Routine
            </button>
            <button
              className={`rounded-lg px-3 py-1 text-sm ${tab === "single-day" ? "bg-black text-white" : ""}`}
              onClick={() => setTab("single-day")}
            >
              Single-Day Plan
            </button>
          </div>

          {/* Date picker only when Single-Day tab */}
          {tab === "single-day" && (
            <label className="ml-2 flex items-center gap-2 text-sm">
              <span className="text-gray-600">Date</span>
              <input
                type="date"
                value={dateISO}
                onChange={(e) => setDateISO(e.target.value)}
                className="rounded-lg border px-2 py-1"
              />
            </label>
          )}
        </div>
      </div>

      {/* ====== TAB: Day Window ====== */}
      {tab === "window" && (
        <section className="space-y-4">
          {/* Current status FIRST */}
          <div className="rounded-2xl border p-4">
            <h3 className="mb-2 text-sm font-semibold">Current status</h3>
            <div className="grid gap-2 md:grid-cols-2">
              {Array.from({ length: 7 }).map((_, d) => {
                const w = windowsByDay[d];
                const locked = lockedWeekdays.has(d);
                return (
                  <div key={d} className="rounded-xl border p-3 text-sm flex items-center justify-between">
                    <div>
                      <div className="font-medium">{WEEKDAYS[d]}</div>
                      <div className="text-gray-600">
                        {w ? `Set to ${fromMinutes(w.openMin)}–${fromMinutes(w.closeMin)}` : "Not set (full day available)"}
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${locked ? "bg-amber-100 text-amber-700" : w ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
                      {locked ? "Locked (opened)" : w ? "Set" : "Open"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Grouped windows quick-load */}
            <div className="mt-4 rounded-xl border p-3">
              <div className="mb-2 text-sm font-semibold">Saved windows (grouped)</div>
              {(() => {
                const grouped = groupedWindows;
                if (grouped.length === 0) return <div className="text-sm text-gray-500">No data.</div>;
                return (
                  <div className="space-y-2">
                    {grouped.map((g) => (
                      <div key={g.key} className="flex flex-col gap-2 rounded-lg border p-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <span className="font-medium">
                            {g.window ? `${fromMinutes(g.window.openMin)}–${fromMinutes(g.window.closeMin)}` : "not set"}
                          </span>
                          <span className="text-gray-600"> → {g.days.map((d) => WEEKDAYS[d]).join(", ")}</span>
                        </div>
                        <button
                          className="w-full rounded-lg border px-2 py-1 text-xs sm:w-auto"
                          onClick={() => {
                            setWindowOpen(g.window ? fromMinutes(g.window.openMin) : "09:00");
                            setWindowClose(g.window ? fromMinutes(g.window.closeMin) : "18:00");
                            const mapping: Record<number, boolean> = { 0: false, 1: false, 2: false, 3: false, 4: false, 5: false, 6: false };
                            g.days.forEach((d) => (mapping[d] = true));
                            lockedWeekdays.forEach((d) => (mapping[d] = false));
                            setWindowDays(mapping);
                          }}
                        >
                          Load to editor
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Editor AFTER status */}
          <div className="rounded-2xl border p-4">
            <h2 className="mb-1 text-lg font-semibold">Set your Day Window</h2>
            <p className="text-sm text-gray-600">
              If a Day Window is set for a weekday, all plans and gaps on that day are limited to <b>within</b> the window. Otherwise the whole day is available.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-5">
              <label className="space-y-1">
                <span className="text-sm text-gray-500">Open</span>
                <input type="time" className="w-full rounded-lg border px-3 py-2" value={windowOpen} onChange={(e) => setWindowOpen(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-500">Close</span>
                <input type="time" className="w-full rounded-lg border px-3 py-2" value={windowClose} onChange={(e) => setWindowClose(e.target.value)} />
              </label>
              <div className="sm:col-span-3">
                <div className="mb-2 text-sm text-gray-500">Apply to days</div>
                <div className="flex flex-wrap items-center gap-2">
                  {WEEKDAYS.map((w, i) => {
                    const locked = lockedWeekdays.has(i);
                    return (
                      <button
                        key={w}
                        onClick={() => !locked && setWindowDays((s) => ({ ...s, [i]: !s[i] }))}
                        disabled={locked}
                        title={locked ? "Day is opened — window locked" : ""}
                        className={`rounded-lg px-3 py-1.5 text-sm ring-1 ring-gray-200 ${locked ? "cursor-not-allowed opacity-50" : ""} ${windowDays[i] ? "bg-black text-white" : "bg-white"}`}
                      >
                        {w}
                      </button>
                    );
                  })}
                  <button onClick={() => setDaysPreset("weekdays")} className="rounded-lg border px-3 py-1.5 text-sm">Weekdays</button>
                  <button onClick={() => setDaysPreset("weekends")} className="rounded-lg border px-3 py-1.5 text-sm">Weekends</button>
                  <button onClick={() => setDaysPreset("all")} className="rounded-lg border px-3 py-1.5 text-sm">All</button>
                </div>
              </div>
            </div>
            <div className="pt-3 flex flex-col gap-2 sm:flex-row">
              <button className="w-full sm:w-auto rounded-lg border px-3 py-1.5 text-sm" onClick={applyWindowToSelected}>
                Save window to selected days
              </button>
              <button className="w-full sm:w-auto rounded-lg border px-3 py-1.5 text-sm" onClick={loadAllRoutine}>
                Refresh
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ====== TAB: Standing Routine ====== */}
      {tab === "standing" && (
        <>
          {/* Existing FIRST */}
          <section className="rounded-2xl border p-4">
            <h2 className="mb-3 text-lg font-semibold">Existing Routine (by day)</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(existingByDay).map(([d, items]) => {
                const day = Number(d);
                const win = windowsByDay[day];
                const locked = lockedWeekdays.has(day);
                return (
                  <div key={d} className="rounded-xl border p-3">
                    <div className="mb-1 text-sm text-gray-600">
                      Day: <b>{WEEKDAYS[day]}</b> • Window: {win ? `${fromMinutes(win.openMin)}–${fromMinutes(win.closeMin)}` : "not set"}
                    </div>
                    {items.length === 0 ? (
                      <div className="text-sm text-gray-500">No blocks.</div>
                    ) : (
                      <ul className="mt-1 space-y-1 text-sm">
                    {items.map((it) => (
                      <li key={it.id} className="rounded border px-2 py-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{fromMinutes(it.startMin)}–{fromMinutes(it.endMin)} {it.label ? `• ${it.label}` : ""}</span>
                          <span className="text-xs text-gray-500">L{it.depthLevel}</span>
                        </div>
                        <div className="text-xs text-gray-600">
                          Goal: {it.goalId ? goalMap.get(it.goalId)?.label ?? `Goal #${it.goalId}` : "None"}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                    <div className="mt-2">
                      <button
                        className={`w-full rounded-lg border px-3 py-1.5 text-xs sm:w-auto ${locked ? "cursor-not-allowed opacity-50" : ""}`}
                        onClick={() => !locked && clearDay(day)}
                        disabled={locked}
                        title={locked ? "Day is opened — locked" : ""}
                      >
                        {locked ? "Locked (day opened)" : "Clear this day"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Compose AFTER status */}
          <section className="rounded-2xl border p-4">
            <h2 className="mb-3 text-lg font-semibold">Compose Block (breaks → sprints)</h2>
            <p className="text-sm text-gray-600">Pick days, add breaks, and generate sprints. Blocks are limited to each day&apos;s Day Window if set. <b>Opened day is locked.</b></p>

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
                <input type="time" className="w-full rounded-lg border px-3 py-2" value={bStart} onChange={(e) => setBStart(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-500">End</span>
                <input type="time" className="w-full rounded-lg border px-3 py-2" value={bEnd} onChange={(e) => setBEnd(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-500">Depth</span>
                <select className="w-full rounded-lg border px-3 py-2" value={bDepth} onChange={(e) => setBDepth(Number(e.target.value) as Depth)}>
                  <option value={3}>L3 (Deep)</option>
                  <option value={2}>L2 (Medium)</option>
                  <option value={1}>L1 (Light)</option>
                </select>
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-500">Goal</span>
                <select className="w-full rounded-lg border px-3 py-2" value={bGoalId} onChange={(e)=>setBGoalId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Pick goal</option>
                  {goals.map((g)=> (<option key={g.id} value={g.id}>{g.label}</option>))}
                </select>
              </label>
            </div>

            {/* day toggles */}
            <div className="mt-3">
              <div className="mb-2 text-sm text-gray-500">Days this block applies to</div>
              <div className="flex flex-wrap items-center gap-2">
                {WEEKDAYS.map((w, i) => {
                  const locked = lockedWeekdays.has(i);
                  return (
                    <button
                      key={w}
                      onClick={() => !locked && setComposerDays((s) => ({ ...s, [i]: !s[i] }))}
                      disabled={locked}
                      title={locked ? "Day is opened — locked" : ""}
                      className={`rounded-lg px-3 py-1.5 text-sm ring-1 ring-gray-200 ${locked ? "cursor-not-allowed opacity-50" : ""} ${composerDays[i] ? "bg-black text-white" : "bg-white"}`}
                    >
                      {w}
                    </button>
                  );
                })}
                <button onClick={() => setComposerDays({ 0: false, 1: true, 2: true, 3: true, 4: true, 5: true, 6: false })} className="rounded-lg border px-3 py-1.5 text-sm">
                  Weekdays
                </button>
                <button onClick={() => setComposerDays({ 0: true, 1: false, 2: false, 3: false, 4: false, 5: false, 6: true })} className="rounded-lg border px-3 py-1.5 text-sm">
                  Weekends
                </button>
                <button onClick={() => setComposerDays({ 0: true, 1: true, 2: true, 3: true, 4: true, 5: true, 6: true })} className="rounded-lg border px-3 py-1.5 text-sm">
                  All
                </button>
              </div>
            </div>

            {/* breaks */}
            <div className="mt-4 rounded-lg border p-3">
              <div className="mb-2 text-sm font-semibold">Breaks within this block (Optional)</div>
              <div className="grid gap-3 sm:grid-cols-5">
                <label className="space-y-1">
                  <span className="text-sm text-gray-500">Break start</span>
                  <input type="time" className="w-full rounded-lg border px-3 py-2" value={cbStart} onChange={(e) => setCbStart(e.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm text-gray-500">Break end</span>
                  <input type="time" className="w-full rounded-lg border px-3 py-2" value={cbEnd} onChange={(e) => setCbEnd(e.target.value)} />
                </label>
                <div className="flex items-end sm:col-span-3">
                  <button onClick={addComposerBreak} className="w-full rounded-lg border px-3 py-2">Add Break</button>
                </div>
              </div>
              {composerBreaks.length > 0 && (
                <div className="mt-3 space-y-2">
                  {composerBreaks.map((br, i) => (
                    <div key={i} className="flex flex-col gap-2 rounded border p-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <div>{fromMinutes(br.s)}—{fromMinutes(br.e)}</div>
                      <button className="w-full rounded-lg border px-2 py-1 sm:w-auto" onClick={() => removeComposerBreak(i)}>Remove</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-3 sm:flex-row">
              <button onClick={addBlockWithBreaks} className="w-full rounded-lg bg-black px-4 py-2 text-white sm:w-auto">
                Generate sprints for this block
              </button>
              {lastAddedIndex && <span className="text-sm text-emerald-700">Block {lastAddedIndex} set ✓</span>}
              <button onClick={clearDraft} className="w-full rounded-lg border px-4 py-2 sm:w-auto">
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
                            Block {idx + 1}: {fromMinutes(g.startMin)}—{fromMinutes(g.endMin)} {g.label ? `• ${g.label}` : ""}
                          </div>
                          <div className="text-gray-500">
                            L{g.depthLevel} • {goals.find((x) => x.id === g.goalId)?.label ?? `Goal #${g.goalId}`}
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

                      {/* day toggles per drafted block */}
                      <div className="mt-3">
                        <div className="mb-1 text-xs text-gray-600">Days</div>
                        <div className="flex flex-wrap items-center gap-2">
                          {WEEKDAYS.map((w, i) => {
                            const on = g.days.includes(i);
                            const locked = lockedWeekdays.has(i);
                            return (
                              <button
                                key={w}
                                onClick={() => {
                                  if (locked) return;
                                  const exists = g.days.includes(i);
                                  if (exists) {
                                    setGroups((prev) => {
                                      const next = [...prev];
                                      next[idx] = { ...g, days: g.days.filter((d) => d !== i) };
                                      return next;
                                    });
                                  } else {
                                    setGroups((prev) => {
                                      const next = [...prev];
                                      next[idx] = { ...g, days: [...g.days, i].sort((a, b) => a - b) };
                                      return next;
                                    });
                                  }
                                }}
                                disabled={locked}
                                title={locked ? "Day is opened — locked" : ""}
                                className={`rounded-lg px-2.5 py-1 text-xs ring-1 ring-gray-200 ${locked ? "cursor-not-allowed opacity-50" : ""} ${on ? "bg-black text-white" : "bg-white"}`}
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

          {/* Push */}
          <section className="rounded-2xl border p-4">
            <h2 className="mb-3 text-lg font-semibold">Push Draft</h2>
            <p className="text-sm text-gray-600">
              Window-aware: we clip to each day&apos;s Day Window (if set). <b>Opened day is locked.</b>
            </p>
            <button onClick={pushDraft} className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2 text-white sm:w-auto">
              Push drafted to selected days
            </button>
          </section>
        </>
      )}

      {/* ====== TAB: Single-Day Plan (Only for today) ====== */}
      {tab === "single-day" && (
        <section className="rounded-2xl border p-4">
          <h2 className="mb-1 text-lg font-semibold">Only for today</h2>
          <p className="text-sm text-gray-600">
            A floating plan that affects <b>this date only</b>. Standing routine remains unchanged. Day Window is enforced.
          </p>

          {/* Mode chips */}
          <div className="mt-3 flex gap-2">
            <button
              className={`rounded-lg border px-2 py-1 text-xs ${planDetail === "entire" ? "bg-black text-white" : ""}`}
              onClick={() => setPlanDetail("entire")}
            >
              Entire day
            </button>
            <button
              className={`rounded-lg border px-2 py-1 text-xs ${planDetail === "gaps" ? "bg-black text-white" : ""}`}
              onClick={() => setPlanDetail("gaps")}
            >
              Fill only gaps
            </button>
          </div>

          {/* Gaps preview panel for Fill only gaps */}
          {planDetail === "gaps" && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border p-3">
                <div className="mb-1 text-sm font-semibold">Blocked by standing ({WEEKDAYS[wdForDate]})</div>
                {blockedStandingToday.length ? (
                  <ul className="list-disc pl-5 text-sm">
                    {blockedStandingToday.map((r,i)=> <li key={i}>{fromMinutes(r.s)}–{fromMinutes(r.e)}</li>)}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-600">No standing blocks within Day Window.</div>
                )}
              </div>
              <div className="rounded-lg border p-3">
                <div className="mb-1 text-sm font-semibold">Available gaps ({dateISO})</div>
                {gapsToday.length ? (
                  <ul className="list-disc pl-5 text-sm">
                    {gapsToday.map((r,i)=> <li key={i}>{fromMinutes(r.s)}–{fromMinutes(r.e)}</li>)}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-600">No gaps available within Day Window.</div>
                )}
              </div>
            </div>
          )}

          {/* Inputs */}
          <div className="mt-3 grid gap-3 sm:grid-cols-6">
            <label className="space-y-1 sm:col-span-2">
              <span className="text-sm text-gray-500">Task (required)</span>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={bLabel}
                onChange={(e) => setBLabel(e.target.value)}
                placeholder="e.g. Write blog draft"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-500">Start</span>
              <input type="time" className="w-full rounded-lg border px-3 py-2" value={bStart} onChange={(e) => setBStart(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-500">End</span>
              <input type="time" className="w-full rounded-lg border px-3 py-2" value={bEnd} onChange={(e) => setBEnd(e.target.value)} />
            </label>
            <label className="space-y-1">
              <span className="text-sm text-gray-500">Depth</span>
              <select className="w-full rounded-lg border px-3 py-2" value={bDepth} onChange={(e) => setBDepth(Number(e.target.value) as Depth)}>
                <option value={3}>L3 (Deep)</option>
                <option value={2}>L2 (Medium)</option>
                <option value={1}>L1 (Light)</option>
              </select>
            </label>
          </div>

          {/* breaks */}
          <div className="mt-4 rounded-lg border p-3">
            <div className="mb-2 text-sm font-semibold">Breaks within this block (Optional)</div>
            <div className="grid gap-3 sm:grid-cols-5">
              <label className="space-y-1">
                <span className="text-sm text-gray-500">Break start</span>
                <input type="time" className="w-full rounded-lg border px-3 py-2" value={cbStart} onChange={(e) => setCbStart(e.target.value)} />
              </label>
              <label className="space-y-1">
                <span className="text-sm text-gray-500">Break end</span>
                <input type="time" className="w-full rounded-lg border px-3 py-2" value={cbEnd} onChange={(e) => setCbEnd(e.target.value)} />
              </label>
              <div className="flex items-end sm:col-span-3">
                <button onClick={addComposerBreak} className="w-full rounded-lg border px-3 py-2">Add Break</button>
              </div>
            </div>
            {composerBreaks.length > 0 && (
              <div className="mt-3 space-y-2">
                {composerBreaks.map((br, i) => (
                  <div key={i} className="flex flex-col gap-2 rounded border p-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div>{fromMinutes(br.s)}—{fromMinutes(br.e)}</div>
                    <button className="w-full rounded-lg border px-2 py-1 sm:w-auto" onClick={() => removeComposerBreak(i)}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 pt-3 sm:flex-row">
            <button onClick={addBlockWithBreaks} className="w-full rounded-lg bg-black px-4 py-2 text-white sm:w-auto">
              Generate sprints for this block
            </button>
            {lastAddedIndex && <span className="text-sm text-emerald-700">Block {lastAddedIndex} set ✓</span>}
            <button onClick={clearDraft} className="w-full rounded-lg border px-4 py-2 sm:w-auto">
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
                          Block {idx + 1}: {fromMinutes(g.startMin)}—{fromMinutes(g.endMin)} {g.label ? `• ${g.label}` : ""}
                        </div>
                        <div className="text-gray-500">L{g.depthLevel}</div>
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
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Finalize Only-Today */}
          <section className="mt-4 rounded-2xl border p-4">
            <h2 className="mb-3 text-lg font-semibold">Finalize Only-Today Plan</h2>
            <p className="text-sm text-gray-600">
              We’ll check overlaps with this date’s schedule and the standing routine. Day Window enforced.
            </p>
            <button onClick={pushDraft} className="mt-2 w-full rounded-lg bg-emerald-600 px-4 py-2 text-white sm:w-auto">
              Finalize plan for {dateISO}
            </button>
          </section>
        </section>
      )}

      {/* Confirm */}
      <ConfirmDialog
        open={confirmOpen}
        title={confirmTitle}
        body={confirmBody}
        confirmText={confirmText}
        destructive={confirmDestructive}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => { confirmActionRef.current?.(); }}
        secondaryText={secondaryText}
        secondaryDestructive={secondaryDestructive}
        onSecondary={() => { secondaryActionRef.current?.(); }}
        tertiaryText={tertiaryText}
        tertiaryDestructive={tertiaryDestructive}
        onTertiary={() => { tertiaryActionRef.current?.(); }}
      />
    </div>
  );
}

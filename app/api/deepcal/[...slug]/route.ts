import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { goals, routines, routineWindows, days, blocks } from "@/lib/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { verifyToken } from "@/lib/jwt";

type Depth = 1 | 2 | 3;
type Ctx = { params: Promise<{ slug?: string[] }> };
type RoutineInsert = typeof routines.$inferInsert;

async function getUid(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.match(/^Bearer\\s+(.+)$/i)?.[1];
  const cookie = req.cookies.get("dc_token")?.value;
  const token = bearer || cookie;
  if (!token) return null;
  try {
    const p = await verifyToken<{ uid: number }>(token);
    return p.uid;
  } catch {
    return null;
  }
}

function overlap(aS: number, aE: number, bS: number, bE: number) {
  return Math.max(aS, bS) < Math.min(aE, bE);
}
function dayOfWeekFromISO(dateISO: string) {
  return new Date(`${dateISO}T00:00:00`).getDay();
}

function instantiateFromRoutine(
  items: Array<{
    startMin: number;
    endMin: number;
    depthLevel: Depth;
    goalId: number | null;
    label?: string | null;
  }>
) {
  return items
    .slice()
    .sort((a, b) => a.startMin - b.startMin)
    .map((r) => ({
      startMin: r.startMin,
      endMin: r.endMin,
      depthLevel: r.depthLevel,
      goalId: r.goalId ?? null,
      label: r.label ?? null,
      status: "planned" as const,
      actualSec: 0,
      source: "standing" as const,
    }));
}

/** shared conflict checker for weekly routine push */
async function getRoutineConflictsForUser(
  uid: number,
  payloadItems: Array<{ days: number[]; sprints: Array<{ startMin: number; endMin: number }> }>
) {
  if (!payloadItems.length) return [] as Array<{ weekday: number; startMin: number; endMin: number }>;

  const daySet = new Set<number>();
  for (const it of payloadItems) for (const d of it.days || []) if (d >= 0 && d <= 6) daySet.add(d);
  const daysList = [...daySet];
  if (!daysList.length) return [];

  const existing = await db
    .select()
    .from(routines)
    .where(and(eq(routines.userId, uid), inArray(routines.weekday, daysList)));

  const conflicts: Array<{ weekday: number; startMin: number; endMin: number }> = [];
  for (const it of payloadItems) {
    for (const wd of it.days) {
      const ex = existing.filter((r) => r.weekday === wd);
      for (const sp of it.sprints) {
        for (const r of ex) {
          if (overlap(sp.startMin, sp.endMin, r.startMin, r.endMin)) {
            conflicts.push({ weekday: wd, startMin: r.startMin, endMin: r.endMin });
          }
        }
      }
    }
  }
  const key = (c: { weekday: number; startMin: number; endMin: number }) => `${c.weekday}-${c.startMin}-${c.endMin}`;
  return Array.from(new Map(conflicts.map((c) => [key(c), c])).values());
}

// ---------------- GET ----------------
export async function GET(req: NextRequest, ctx: Ctx) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug: _slug } = await ctx.params;
  const slug = _slug ?? [];
  const url = new URL(req.url);

  if (slug[0] === "goals") {
    const gs = await db.select().from(goals).where(and(eq(goals.userId, uid), eq(goals.isArchived, false)));
    return NextResponse.json({ goals: gs });
  }

  if (slug[0] === "routine" && slug[1] === "status") {
    const cookieVal = req.cookies.get("dc_routine_finalized")?.value;
    const finalized = cookieVal === "1";
    return NextResponse.json({ finalized });
  }

  if (slug[0] === "routine") {
    const weekdayParam = url.searchParams.get("weekday");
    if (weekdayParam == null) return NextResponse.json({ error: "weekday 0..6 required" }, { status: 400 });
    const weekday = Number(weekdayParam);
    if (!(weekday >= 0 && weekday <= 6)) return NextResponse.json({ error: "weekday 0..6 required" }, { status: 400 });

    const items = await db.select().from(routines).where(and(eq(routines.userId, uid), eq(routines.weekday, weekday)));
    const [win] = await db
      .select()
      .from(routineWindows)
      .where(and(eq(routineWindows.userId, uid), eq(routineWindows.weekday, weekday)));
    return NextResponse.json({
      items,
      window: win ? { openMin: win.openMin, closeMin: win.closeMin } : null,
    });
  }

  if (slug[0] === "day") {
    const dateISO = url.searchParams.get("date");
    const autocreate = url.searchParams.get("autocreate") === "true";
    if (!dateISO) return NextResponse.json({ error: "date required" }, { status: 400 });

    let [dayRow] = await db.select().from(days).where(and(eq(days.userId, uid), eq(days.dateISO, dateISO)));
    if (!dayRow && autocreate) {
      const weekday = new Date(`${dateISO}T00:00:00`).getDay();
      const routine = await db.select().from(routines).where(and(eq(routines.userId, uid), eq(routines.weekday, weekday)));
      const [created] = await db.insert(days).values({ userId: uid, dateISO, openedAt: new Date() }).returning();
      dayRow = created;
      if (routine.length) {
        const blocksData = instantiateFromRoutine(
          routine.map((r) => ({
            startMin: r.startMin,
            endMin: r.endMin,
            depthLevel: r.depthLevel as Depth,
            goalId: r.goalId ?? null,
            label: r.label ?? null,
          }))
        );
        await db.insert(blocks).values(
          blocksData.map((b) => ({
            dayId: dayRow!.id,
            startMin: b.startMin,
            endMin: b.endMin,
            depthLevel: b.depthLevel,
            goalId: b.goalId,
            label: b.label ?? null,
            status: b.status,
            actualSec: b.actualSec,
            source: b.source,
          }))
        );
      }
    }
    if (!dayRow) return NextResponse.json({ pack: null });
    const blks = await db.select().from(blocks).where(eq(blocks.dayId, dayRow.id));
    const pack = {
      dateISO,
      openedAt: dayRow.openedAt?.getTime(),
      shutdownAt: dayRow.shutdownAt?.getTime(),
      journal: dayRow.journal ?? undefined,
      blocks: blks.map((b) => ({
        id: b.id,
        startMin: b.startMin,
        endMin: b.endMin,
        depthLevel: b.depthLevel as Depth,
        goalId: b.goalId ?? undefined,
        label: (b as any).label ?? undefined,
        status: b.status as "planned" | "active" | "done" | "skipped",
        actualSec: b.actualSec,
        source: (b as any).source as "standing" | "single-day",
      })),
    };
    return NextResponse.json({ pack });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

// ---------------- POST ----------------
export async function POST(req: NextRequest, ctx: Ctx) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug: _slug } = await ctx.params;
  const slug = _slug ?? [];
  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));

  if (slug[0] === "goals") {
    const { label, color, deadlineISO } = body || {};
    if (!label || !color) return NextResponse.json({ error: "label,color required" }, { status: 400 });
    const [g] = await db
      .insert(goals)
      .values({ userId: uid, label, color, deadlineISO: deadlineISO ?? null })
      .returning();
    return NextResponse.json({ goal: g });
  }

  if (slug[0] === "routine" && slug[1] === "finalize") {
    const finalized = !!body?.finalized;
    const res = NextResponse.json({ ok: true, finalized });
    res.cookies.set("dc_routine_finalized", finalized ? "1" : "0", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  }

  if (slug[0] === "routine" && slug[1] === "window") {
    const openMin = Number(body?.openMin);
    const closeMin = Number(body?.closeMin);
    const daysArr: number[] = Array.isArray(body?.days) ? body.days.map(Number) : [];
    if (!Number.isInteger(openMin) || !Number.isInteger(closeMin) || closeMin <= openMin) {
      return NextResponse.json({ error: "invalid openMin/closeMin" }, { status: 400 });
    }
    if (daysArr.length === 0 || daysArr.some((wd) => !(wd >= 0 && wd <= 6))) {
      return NextResponse.json({ error: "invalid days[]" }, { status: 400 });
    }
    for (const wd of daysArr) {
      await db.delete(routineWindows).where(and(eq(routineWindows.userId, uid), eq(routineWindows.weekday, wd)));
      await db.insert(routineWindows).values({ userId: uid, weekday: wd, openMin, closeMin });
    }
    return NextResponse.json({ ok: true, days: daysArr });
  }

  if (slug[0] === "routine" && slug[1] === "conflicts") {
    const items: Array<{ days: number[]; sprints: Array<{ startMin: number; endMin: number }> }> = Array.isArray(
      body?.items
    )
      ? body.items
      : [];
    const conflicts = await getRoutineConflictsForUser(uid, items);
    return NextResponse.json({ conflicts });
  }

  // NEW: Single-Day Plan conflicts (no goal required)
  if (slug[0] === "day" && slug[1] === "plan" && slug[2] === "conflicts") {
    type PlanItem = { startMin: number; endMin: number; depthLevel: number; label?: string | null; goalId?: number | null };
    const dateISO: string | undefined = body?.dateISO;
    const items: PlanItem[] = Array.isArray(body?.items) ? body.items : [];
    if (!dateISO) return NextResponse.json({ error: "dateISO required" }, { status: 400 });
    if (!items.length) return NextResponse.json({ conflicts: [] });

    const [dayRow] = await db.select().from(days).where(and(eq(days.userId, uid), eq(days.dateISO, dateISO)));
    let existingRanges: Array<{ startMin: number; endMin: number; label?: string | null }> = [];

    if (dayRow) {
      const existingBlocks = await db.select().from(blocks).where(eq(blocks.dayId, dayRow.id));
      existingRanges = existingBlocks.map((b) => ({ startMin: b.startMin, endMin: b.endMin, label: (b as any).label ?? null }));
    } else {
      const wd = dayOfWeekFromISO(dateISO);
      const standing = await db.select().from(routines).where(and(eq(routines.userId, uid), eq(routines.weekday, wd)));
      existingRanges = standing.map((r) => ({ startMin: r.startMin, endMin: r.endMin, label: r.label ?? null }));
    }

    const conflicts: Array<{ startMin: number; endMin: number; withLabel?: string | null }> = [];
    for (const it of items) {
      for (const ex of existingRanges) {
        if (overlap(it.startMin, it.endMin, ex.startMin, ex.endMin)) {
          conflicts.push({
            startMin: Math.max(it.startMin, ex.startMin),
            endMin: Math.min(it.endMin, ex.endMin),
            withLabel: ex.label ?? null,
          });
        }
      }
    }
    return NextResponse.json({ conflicts });
  }

  // NEW: push Single-Day Plan (no goal required)
  if (slug[0] === "day" && slug[1] === "plan") {
    type PlanItem = { startMin: number; endMin: number; depthLevel: number; label?: string | null; goalId?: number | null };
    const dateISO: string | undefined = body?.dateISO;
    const items: PlanItem[] = Array.isArray(body?.items) ? body.items : [];
    const strategy: "replace" | "merge" = body?.strategy === "merge" ? "merge" : "replace";
    const overwrite: boolean = url.searchParams.get("overwrite") === "1";

    if (!dateISO) return NextResponse.json({ error: "dateISO required" }, { status: 400 });
    if (!items.length) return NextResponse.json({ ok: true, inserted: 0 });

    let [dayRow] = await db.select().from(days).where(and(eq(days.userId, uid), eq(days.dateISO, dateISO)));
    if (!dayRow) {
      const [created] = await db.insert(days).values({ userId: uid, dateISO }).returning();
      dayRow = created;
    }

    const existing = await db.select().from(blocks).where(eq(blocks.dayId, dayRow.id));

    // on merge with empty day -> bootstrap standing
    if (strategy === "merge" && existing.length === 0) {
      const wd = dayOfWeekFromISO(dateISO);
      const standing = await db.select().from(routines).where(and(eq(routines.userId, uid), eq(routines.weekday, wd)));
      if (standing.length) {
        const base = standing
          .slice()
          .sort((a, b) => a.startMin - b.startMin)
          .map((r) => ({
            dayId: dayRow.id,
            startMin: r.startMin,
            endMin: r.endMin,
            depthLevel: r.depthLevel as Depth,
            goalId: r.goalId,
            label: r.label ?? null,
            status: "planned" as const,
            actualSec: 0,
            source: "standing" as const,
          }));
        await db.insert(blocks).values(base);
      }
    }

    // refresh current day blocks
    const current = await db.select().from(blocks).where(eq(blocks.dayId, dayRow.id));

    // conflicts
    const overlapsFound: Array<{ startMin: number; endMin: number }> = [];
    for (const it of items) {
      for (const ex of current) {
        if (overlap(it.startMin, it.endMin, ex.startMin, ex.endMin)) {
          overlapsFound.push({
            startMin: Math.max(it.startMin, ex.startMin),
            endMin: Math.min(it.endMin, ex.endMin),
          });
        }
      }
    }
    if (overlapsFound.length && !overwrite) {
      return NextResponse.json({ error: "conflicts", conflicts: overlapsFound }, { status: 409 });
    }

    if (strategy === "replace") {
      await db.delete(blocks).where(eq(blocks.dayId, dayRow.id));
    } else if (overlapsFound.length && overwrite) {
      // delete only overlapping existing blocks
      for (const it of items) {
        await db.execute(sql`
          DELETE FROM "blocks"
          WHERE "day_id" = ${dayRow.id}
          AND GREATEST(${it.startMin}, "start_min") < LEAST(${it.endMin}, "end_min")
        `);
      }
    }

    // insert one-off (no goal required)
    const values = items
      .slice()
      .sort((a, b) => a.startMin - b.startMin)
      .map((it) => ({
        dayId: dayRow.id,
        startMin: Number(it.startMin),
        endMin: Number(it.endMin),
        depthLevel: (Number(it.depthLevel) as Depth) || 3,
        goalId: typeof it.goalId === "number" ? it.goalId : null,
        label: typeof it.label === "string" && it.label.trim() ? it.label.trim() : null,
        status: "planned" as const,
        actualSec: 0,
        source: "single-day" as const,
      }));

    if (values.length) await db.insert(blocks).values(values);

    return NextResponse.json({ ok: true, inserted: values.length });
  }

  // ---------- weekly routine push (unchanged; goal required) ----------
  if (slug[0] === "routine" && slug[1] === "push") {
    const overwrite = url.searchParams.get("overwrite") === "1";
    type PushItem = {
      label?: string;
      depthLevel: Depth | number;
      goalId: number; // REQUIRED for weekly
      days: number[];
      sprints: Array<{ startMin: number; endMin: number }>;
    };
    const items: PushItem[] = Array.isArray(body?.items) ? body.items : [];
    if (items.length === 0) return NextResponse.json({ ok: true, inserted: 0 });

    if (items.some((it) => typeof it.goalId !== "number")) {
      return NextResponse.json({ error: "goalId required for all items" }, { status: 400 });
    }

    if (!overwrite) {
      const conflicts = await getRoutineConflictsForUser(
        uid,
        items.map((it) => ({ days: it.days, sprints: it.sprints }))
      );
      if (conflicts.length) return NextResponse.json({ error: "conflicts", conflicts }, { status: 409 });
    }

    if (overwrite) {
      const daySet = new Set<number>();
      for (const it of items) for (const d of it.days || []) if (d >= 0 && d <= 6) daySet.add(d);
      const daysList = [...daySet];
      if (daysList.length) {
        const existing = await db
          .select()
          .from(routines)
          .where(and(eq(routines.userId, uid), inArray(routines.weekday, daysList)));
        const toDeleteIds: number[] = [];
        for (const it of items) {
          for (const wd of it.days) {
            const ex = existing.filter((r) => r.weekday === wd);
            for (const sp of it.sprints) {
              for (const r of ex) if (overlap(sp.startMin, sp.endMin, r.startMin, r.endMin)) toDeleteIds.push(r.id);
            }
          }
        }
        const uniqueIds = Array.from(new Set(toDeleteIds));
        if (uniqueIds.length) await db.delete(routines).where(inArray(routines.id, uniqueIds));
      }
    }

    let count = 0;
    for (const it of items) {
      const label = typeof it.label === "string" && it.label.trim() ? it.label.trim() : null;
      const depth = (Number(it.depthLevel) as Depth) || 3;

      for (const wd of it.days) {
        if (!(wd >= 0 && wd <= 6)) continue;

        const values: RoutineInsert[] = it.sprints.map((s, i) => ({
          userId: uid,
          weekday: wd,
          startMin: s.startMin,
          endMin: s.endMin,
          depthLevel: depth,
          goalId: it.goalId,
          ...(label ? { label } : {}),
          orderIndex: i,
        }));

        if (values.length) {
          await db.insert(routines).values(values);
          count += values.length;
        }
      }
    }
    return NextResponse.json({ ok: true, inserted: count });
  }

  // ---------- legacy single-weekday upsert (unchanged) ----------
  if (slug[0] === "routine") {
    const { weekday, items, applyTo, window } = body || {};

    // Bulk apply
    if (Array.isArray(applyTo) && applyTo.length > 0) {
      const wds = applyTo.map(Number);
      if (wds.some((wd: number) => !(wd >= 0 && wd <= 6))) {
        return NextResponse.json({ error: "invalid weekday in applyTo" }, { status: 400 });
      }

      for (const wd of wds) {
        if (window && Number.isInteger(window.openMin) && Number.isInteger(window.closeMin)) {
          await db.delete(routineWindows).where(and(eq(routineWindows.userId, uid), eq(routineWindows.weekday, wd)));
          await db.insert(routineWindows).values({
            userId: uid,
            weekday: wd,
            openMin: window.openMin,
            closeMin: window.closeMin,
          });
        }

        await db.delete(routines).where(and(eq(routines.userId, uid), eq(routines.weekday, wd)));
        if (Array.isArray(items) && items.length) {
          type RoutineItemInput = {
            startMin: number;
            endMin: number;
            depthLevel: number;
            goalId: number | null | undefined;
            label?: string | null;
            orderIndex?: number;
          };
          const arr = items as RoutineItemInput[];

          if (arr.some((x) => typeof x.goalId !== "number")) {
            return NextResponse.json({ error: "goalId required for each routine item" }, { status: 400 });
          }

          const values: RoutineInsert[] = arr.map((x, i) => ({
            userId: uid,
            weekday: wd,
            startMin: Number(x.startMin),
            endMin: Number(x.endMin),
            depthLevel: Number(x.depthLevel) as Depth,
            goalId: x.goalId as number,
            ...(typeof x.label === "string" && x.label.trim() ? { label: x.label.trim() } : {}),
            orderIndex: Number.isFinite(x.orderIndex as number) ? (x.orderIndex as number) : i,
          }));
          await db.insert(routines).values(values);
        }
      }
      return NextResponse.json({ ok: true, applied: wds });
    }

    // Single weekday mode
    const wd = Number(weekday);
    if (!(wd >= 0 && wd <= 6)) {
      return NextResponse.json({ error: "weekday 0..6 required (or provide applyTo[])" }, { status: 400 });
    }

    if (window && Number.isInteger(window.openMin) && Number.isInteger(window.closeMin)) {
      await db.delete(routineWindows).where(and(eq(routineWindows.userId, uid), eq(routineWindows.weekday, wd)));
      await db.insert(routineWindows).values({
        userId: uid,
        weekday: wd,
        openMin: window.openMin,
        closeMin: window.closeMin,
      });
    }

    await db.delete(routines).where(and(eq(routines.userId, uid), eq(routines.weekday, wd)));
    if (Array.isArray(items) && items.length) {
      type RoutineItemInput = {
        startMin: number;
        endMin: number;
        depthLevel: number;
        goalId: number | null | undefined;
        label?: string | null;
        orderIndex?: number;
      };
      const arr = items as RoutineItemInput[];

      if (arr.some((x) => typeof x.goalId !== "number")) {
        return NextResponse.json({ error: "goalId required for each routine item" }, { status: 400 });
      }

      const values: RoutineInsert[] = arr.map((x, i) => ({
        userId: uid,
        weekday: wd,
        startMin: Number(x.startMin),
        endMin: Number(x.endMin),
        depthLevel: Number(x.depthLevel) as Depth,
        goalId: x.goalId as number,
        ...(typeof x.label === "string" && x.label.trim() ? { label: x.label.trim() } : {}),
        orderIndex: Number.isFinite(x.orderIndex as number) ? (x.orderIndex as number) : i,
      }));
      await db.insert(routines).values(values);
    }
    return NextResponse.json({ ok: true });
  }

  if (slug[0] === "day" && slug[1] === "shutdown") {
    const { dateISO, journal } = body || {};
    if (!dateISO) return NextResponse.json({ error: "dateISO required" }, { status: 400 });
    await db
      .update(days)
      .set({ shutdownAt: new Date(), journal: journal ?? null })
      .where(and(eq(days.userId, uid), eq(days.dateISO, dateISO)));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

// ---------------- PATCH ----------------
export async function PATCH(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const body = await req.json().catch(() => ({}));

  if (url.pathname.includes("/blocks")) {
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });

    await db
      .update(blocks)
      .set({
        ...(typeof body.status === "string" ? { status: body.status } : {}),
        ...(body.goalId === null
          ? { goalId: null }
          : Number.isInteger(body.goalId)
          ? { goalId: body.goalId }
          : {}),
        ...(typeof body.label === "string" ? { label: body.label } : {}),
        ...(Number.isInteger(body.cognition)
          ? { depthLevel: body.cognition }
          : Number.isInteger(body.depthLevel)
          ? { depthLevel: body.depthLevel }
          : {}),
        ...(Number.isInteger(body.actualSec) ? { actualSec: body.actualSec } : {}),
      })
      .where(eq(blocks.id, id));

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

// ---------------- DELETE ----------------
export async function DELETE(req: NextRequest, ctx: Ctx) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { slug: _slug } = await ctx.params;
  const slug = _slug ?? [];
  const url = new URL(req.url);

  if (slug[0] === "goals") {
    const id = Number(url.searchParams.get("id"));
    if (!Number.isInteger(id)) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    await db.update(goals).set({ isArchived: true }).where(and(eq(goals.userId, uid), eq(goals.id, id)));
    return NextResponse.json({ ok: true });
  }

  if (slug[0] === "routine") {
    const weekdayParam = url.searchParams.get("weekday");
    if (weekdayParam == null) return NextResponse.json({ error: "weekday required" }, { status: 400 });
    const wd = Number(weekdayParam);
    if (!(wd >= 0 && wd <= 6)) return NextResponse.json({ error: "weekday 0..6" }, { status: 400 });

    await db.delete(routines).where(and(eq(routines.userId, uid), eq(routines.weekday, wd)));
    await db
      .delete(routineWindows)
      .where(and(eq(routineWindows.userId, uid), eq(routineWindows.weekday, wd)));
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

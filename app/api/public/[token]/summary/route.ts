import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals, routines, routineWindows, days, blocks } from "@/lib/schema";
import { getUserIdByPublicKey } from "../../_util";

type Depth = 1|2|3;

function parseRange(url: URL) {
  const range = (url.searchParams.get("range") || "").toLowerCase();
  const fromQ = url.searchParams.get("from");
  const toQ = url.searchParams.get("to");

  if (fromQ && toQ) return { from: fromQ, to: toQ };

  const today = new Date();
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const to = d.toISOString().slice(0,10);
  let from = to;
  if (range === "7d") {
    d.setUTCDate(d.getUTCDate() - 6);
    from = d.toISOString().slice(0,10);
  } else if (range === "30d" || !range) {
    d.setUTCDate(d.getUTCDate() - 29);
    from = d.toISOString().slice(0,10);
  } else if (range === "all") {
    from = "0001-01-01";
  }
  return { from, to };
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const uid = await getUserIdByPublicKey(token);
  if (!uid) return NextResponse.json({ error: "not found" }, { status: 404 });

  const url = new URL(req.url);
  const { from, to } = parseRange(url);

  // goals
  const gs = await db.select().from(goals).where(and(eq(goals.userId, uid), eq(goals.isArchived, false)));

  // routine windows + items (all days)
  const wins = await db.select().from(routineWindows).where(eq(routineWindows.userId, uid));
  const items = await db.select().from(routines).where(eq(routines.userId, uid));

  // stats: sum actualSec for DONE or ACTIVE blocks within [from..to]
  const drows = await db.select().from(days)
    .where(and(eq(days.userId, uid), gte(days.dateISO, from), lte(days.dateISO, to)));

  let byGoal = new Map<number, number>();
  if (drows.length) {
    const ids = drows.map(d => d.id);
    // fetch blocks for these days
    // drizzle doesn't have IN for arrays via helper here, but you can loop; for perf keep it simple
    // If you have inArray, you can use it. Many setups do:
    // import { inArray } from "drizzle-orm";
    // const blks = await db.select().from(blocks).where(inArray(blocks.dayId, ids));
    const blks: Array<{ goalId: number|null; status: string; actualSec: number }> = [];
    for (const d of ids) {
      const part = await db.select().from(blocks).where(eq(blocks.dayId, d));
      blks.push(...part);
    }
    for (const b of blks) {
      if (!b.goalId) continue;
      if (b.status !== "done" && b.status !== "active") continue;
      byGoal.set(b.goalId, (byGoal.get(b.goalId) ?? 0) + (b.actualSec ?? 0));
    }
  }
  const stats = {
    range: { from, to },
    totalSec: Array.from(byGoal.values()).reduce((a,b)=>a+b,0),
    byGoal: Array.from(byGoal.entries()).map(([goalId, seconds]) => {
      const g = gs.find(x => x.id === goalId);
      return {
        goalId,
        label: g?.label ?? `Goal #${goalId}`,
        color: g?.color ?? "bg-blue-500",
        seconds,
        hours: Number((seconds/3600).toFixed(2)),
      };
    }).sort((a,b)=>b.seconds-a.seconds),
  };

  // active now (based on server time; no user TZ yet)
  const now = new Date();
  const weekday = now.getDay(); // 0..6
  const nowMin = now.getHours()*60 + now.getMinutes();
  const todays = items.filter(i => i.weekday === weekday);
  const activeNow = todays.find(i => nowMin >= i.startMin && nowMin < i.endMin) || null;

  return NextResponse.json({
    nowUtc: now.toISOString(),
    user: { name: undefined }, // we keep PII out; you can add display name later if wanted
    goals: gs.map(g => ({ id: g.id, label: g.label, color: g.color, deadlineISO: g.deadlineISO ?? null })),
    routine: {
      windows: wins.map(w => ({ weekday: w.weekday, openMin: w.openMin, closeMin: w.closeMin })),
      items: items.map(it => ({
        weekday: it.weekday, startMin: it.startMin, endMin: it.endMin,
        depthLevel: it.depthLevel as Depth, goalId: it.goalId, label: it.label ?? null
      })),
    },
    stats,
    activeNow: activeNow ? {
      weekday: activeNow.weekday,
      startMin: activeNow.startMin,
      endMin: activeNow.endMin,
      depthLevel: activeNow.depthLevel as Depth,
      goalId: activeNow.goalId,
      label: activeNow.label ?? null,
    } : null,
  }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" }
  });
}

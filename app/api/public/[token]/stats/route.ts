import { NextRequest, NextResponse } from "next/server";
import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals, days, blocks } from "@/lib/schema";
import { getUserIdByPublicKey } from "../../_util";

function parseRange(url: URL) {
  const range = (url.searchParams.get("range") || "").toLowerCase();
  const fromQ = url.searchParams.get("from");
  const toQ = url.searchParams.get("to");

  if (fromQ && toQ) return { from: fromQ, to: toQ };

  const today = new Date();
  const d = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );
  const to = d.toISOString().slice(0, 10);
  let from = to;
  if (range === "7d") {
    d.setUTCDate(d.getUTCDate() - 6);
    from = d.toISOString().slice(0, 10);
  } else if (range === "30d" || !range) {
    d.setUTCDate(d.getUTCDate() - 29);
    from = d.toISOString().slice(0, 10);
  } else if (range === "all") {
    from = "0001-01-01";
  }
  return { from, to };
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ token: string }> }
) {
  const { token } = await ctx.params;
  const uid = await getUserIdByPublicKey(token);
  if (!uid) return NextResponse.json({ error: "not found" }, { status: 404 });

  const url = new URL(req.url);
  const { from, to } = parseRange(url);

  const gs = await db
    .select()
    .from(goals)
    .where(and(eq(goals.userId, uid), eq(goals.isArchived, false)));
  const drows = await db
    .select()
    .from(days)
    .where(and(eq(days.userId, uid), gte(days.dateISO, from), lte(days.dateISO, to)));

  const byGoal = new Map<number, number>();
  if (drows.length) {
    for (const d of drows) {
      const blks = await db.select().from(blocks).where(eq(blocks.dayId, d.id));
      for (const b of blks) {
        if (!b.goalId) continue;
        if (b.status !== "done" && b.status !== "active") continue;
        byGoal.set(b.goalId, (byGoal.get(b.goalId) ?? 0) + (b.actualSec ?? 0));
      }
    }
  }

  const result = Array.from(byGoal.entries())
    .map(([goalId, seconds]) => {
      const g = gs.find((x) => x.id === goalId);
      return {
        goalId,
        label: g?.label ?? `Goal #${goalId}`,
        color: g?.color ?? "bg-blue-500",
        seconds,
        hours: Number((seconds / 3600).toFixed(2)),
      };
    })
    .sort((a, b) => b.seconds - a.seconds);

  return NextResponse.json(
    { range: { from, to }, totalSec: result.reduce((a, b) => a + b.seconds, 0), byGoal: result },
    {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    }
  );
}

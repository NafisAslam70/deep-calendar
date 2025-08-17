import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { routines, routineWindows } from "@/lib/schema";
import { getUserIdByPublicKey } from "../../_util";

type Depth = 1|2|3;

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const uid = await getUserIdByPublicKey(token);
  if (!uid) return NextResponse.json({ error: "not found" }, { status: 404 });

  const url = new URL(req.url);
  const wq = url.searchParams.get("weekday");

  if (wq != null) {
    const wd = Number(wq);
    if (!(wd >= 0 && wd <= 6)) return NextResponse.json({ error: "weekday 0..6" }, { status: 400 });

    const [win] = await db.select().from(routineWindows).where(and(eq(routineWindows.userId, uid), eq(routineWindows.weekday, wd)));
    const items = await db.select().from(routines).where(and(eq(routines.userId, uid), eq(routines.weekday, wd)));
    return NextResponse.json({
      window: win ? { openMin: win.openMin, closeMin: win.closeMin } : null,
      items: items.map(i => ({
        id: i.id, startMin: i.startMin, endMin: i.endMin,
        depthLevel: i.depthLevel as Depth, goalId: i.goalId, label: i.label ?? null
      })),
    });
  }

  // all days
  const wins = await db.select().from(routineWindows).where(eq(routineWindows.userId, uid));
  const items = await db.select().from(routines).where(eq(routines.userId, uid));
  return NextResponse.json({
    windows: wins.map(w => ({ weekday: w.weekday, openMin: w.openMin, closeMin: w.closeMin })),
    items: items.map(i => ({
      weekday: i.weekday, startMin: i.startMin, endMin: i.endMin,
      depthLevel: i.depthLevel as Depth, goalId: i.goalId, label: i.label ?? null
    })),
  });
}

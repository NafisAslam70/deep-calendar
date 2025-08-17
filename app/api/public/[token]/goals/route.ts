import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { goals } from "@/lib/schema";
import { getUserIdByPublicKey } from "../../_util";

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const uid = await getUserIdByPublicKey(token);
  if (!uid) return NextResponse.json({ error: "not found" }, { status: 404 });

  const gs = await db.select().from(goals).where(and(eq(goals.userId, uid), eq(goals.isArchived, false)));
  return NextResponse.json({ goals: gs.map(g => ({ id: g.id, label: g.label, color: g.color, deadlineISO: g.deadlineISO ?? null })) });
}

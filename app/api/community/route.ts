import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { communityPosts, goals, users } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { verifyToken } from "@/lib/jwt";

type Kind = "goal" | "routine" | "shutdown";

async function getUid(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
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

export async function GET(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const posts = await db
    .select({
      id: communityPosts.id,
      kind: communityPosts.kind,
      message: communityPosts.message,
      goalId: communityPosts.goalId,
      weekday: communityPosts.weekday,
      dayISO: communityPosts.dayISO,
      createdAt: communityPosts.createdAt,
      userId: communityPosts.userId,
      userName: users.name,
    })
    .from(communityPosts)
    .leftJoin(users, eq(users.id, communityPosts.userId))
    .orderBy(desc(communityPosts.createdAt))
    .limit(50);

  return NextResponse.json({ posts });
}

export async function POST(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const kind: Kind | undefined = ["goal", "routine", "shutdown"].includes(body?.kind)
    ? (body.kind as Kind)
    : undefined;
  if (!kind) return NextResponse.json({ error: "kind required" }, { status: 400 });

  const msg =
    typeof body?.message === "string" && body.message.trim()
      ? body.message.trim().slice(0, 400)
      : null;

  let goalId: number | null = null;
  if (kind === "goal" && body?.goalId !== undefined) {
    if (!Number.isInteger(body.goalId)) {
      return NextResponse.json({ error: "goalId must be integer" }, { status: 400 });
    }
    const [g] = await db.select({ id: goals.id, userId: goals.userId }).from(goals).where(eq(goals.id, body.goalId));
    if (!g || g.userId !== uid) {
      return NextResponse.json({ error: "goalId not found" }, { status: 404 });
    }
    goalId = g.id;
  }

  const weekday =
    kind === "routine" && Number.isInteger(body?.weekday) && body.weekday >= 0 && body.weekday <= 6
      ? Number(body.weekday)
      : null;
  const dayISO =
    kind === "shutdown" && typeof body?.dayISO === "string" && body.dayISO.trim()
      ? body.dayISO.trim()
      : null;

  const inserted = await db
    .insert(communityPosts)
    .values({
      userId: uid,
      kind,
      goalId,
      weekday,
      dayISO,
      message: msg,
    })
    .returning();

  const post = Array.isArray(inserted)
    ? inserted[0]
    : (inserted as { rows?: Array<typeof communityPosts.$inferSelect> })?.rows?.[0];

  return NextResponse.json({ post });
}

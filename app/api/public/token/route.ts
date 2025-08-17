import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { verifyToken } from "@/lib/jwt";

async function getUid(req: NextRequest) {
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const cookie = req.cookies.get("dc_token")?.value;
  const token = bearer || cookie;
  if (!token) return null;
  try {
    const p = await verifyToken<{ uid: number }>(token);
    return p.uid;
  } catch { return null; }
}

export async function GET(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [u] = await db.select().from(users).where(eq(users.id, uid));
  return NextResponse.json({
    publicKey: u?.publicKey ?? null,
    createdAt: u?.publicKeyCreatedAt?.toISOString() ?? null,
  });
}

export async function POST(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const token = crypto.randomBytes(24).toString("hex"); // 48 chars
  const [u] = await db.update(users)
    .set({ publicKey: token, publicKeyCreatedAt: new Date() })
    .where(eq(users.id, uid))
    .returning();

  return NextResponse.json({
    publicKey: u.publicKey,
    createdAt: u.publicKeyCreatedAt?.toISOString() ?? null,
  });
}

export async function DELETE(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  await db.update(users)
    .set({ publicKey: null, publicKeyCreatedAt: null })
    .where(eq(users.id, uid));

  return NextResponse.json({ ok: true });
}

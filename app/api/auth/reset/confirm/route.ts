import bcrypt from "bcryptjs";
import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { and, eq, gt } from "drizzle-orm";
import { signToken } from "@/lib/jwt";

export async function POST(req: Request) {
  const { token, password } = await req.json().catch(() => ({}));
  const rawToken = typeof token === "string" ? token.trim() : "";
  const p = String(password || "");
  if (!rawToken || !p) return NextResponse.json({ error: "token and password required" }, { status: 400 });

  const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");
  const now = new Date();
  const [u] = await db
    .select()
    .from(users)
    .where(and(eq(users.resetToken, hashed), gt(users.resetTokenExpiresAt, now)))
    .limit(1);

  if (!u) return NextResponse.json({ error: "invalid or expired token" }, { status: 400 });

  const newHash = await bcrypt.hash(p, 10);
  await db
    .update(users)
    .set({ hash: newHash, resetToken: null, resetTokenExpiresAt: null })
    .where(eq(users.id, u.id));

  const jwt = await signToken({ uid: u.id, email: u.email });
  const res = NextResponse.json({
    ok: true,
    token: jwt,
    user: { id: u.id, email: u.email, name: u.name },
  });
  res.cookies.set("dc_token", jwt, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}

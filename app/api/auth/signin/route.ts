import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { signToken } from "@/lib/jwt";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const e = String(body.email || "").toLowerCase().trim();
  const p = String(body.password || "");

  if (!e || !p) {
    return NextResponse.json({ error: "email & password required" }, { status: 400 });
  }

  const [u] = await db.select().from(users).where(eq(users.email, e)).limit(1);
  if (!u) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });

  const ok = await bcrypt.compare(p, u.hash);
  if (!ok) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });

  const jwt = await signToken({ uid: u.id, email: u.email });

  const res = NextResponse.json({
    token: jwt,
    user: { id: u.id, email: u.email, name: u.name },
  });

  res.cookies.set("dc_token", jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}

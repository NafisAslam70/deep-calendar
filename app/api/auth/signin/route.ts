import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { signToken } from "@/lib/jwt";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const e = String(email || "").toLowerCase().trim();
  const p = String(password || "");
  if (!e || !p) return NextResponse.json({ error: "email & password required" }, { status: 400 });

  const [u] = await db.select().from(users).where(eq(users.email, e)).limit(1);
  if (!u) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });
  const ok = await bcrypt.compare(p, u.hash);
  if (!ok) return NextResponse.json({ error: "invalid credentials" }, { status: 401 });

  const jwt = await signToken({ uid: u.id, email: u.email });
  const res = NextResponse.json({ token: jwt, user: { id: u.id, email: u.email, name: u.name } });
  res.cookies.set("dc_token", jwt, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}

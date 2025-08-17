import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { signToken } from "@/lib/jwt";

export async function POST(req: Request) {
  const { email, password, name } = await req.json();
  const e = String(email || "").toLowerCase().trim();
  const p = String(password || "");
  if (!e || !p) return NextResponse.json({ error: "email & password required" }, { status: 400 });

  const [existing] = await db.select().from(users).where(eq(users.email, e)).limit(1);
  if (existing) return NextResponse.json({ error: "email already in use" }, { status: 409 });

  const hash = await bcrypt.hash(p, 10);
  const [u] = await db.insert(users).values({ email: e, hash, name: name ?? null }).returning();
  const jwt = await signToken({ uid: u.id, email: u.email });
  const res = NextResponse.json({ token: jwt, user: { id: u.id, email: u.email, name: u.name } });
  res.cookies.set("dc_token", jwt, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}

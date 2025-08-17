import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { signToken } from "@/lib/jwt";

export const runtime = "nodejs"; // bcryptjs needs Node runtime

export async function POST(req: Request) {
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const e = String(body.email || "").toLowerCase().trim();
  const p = String(body.password || "");
  const name = body.name ? String(body.name).trim() : null;

  if (!e || !p) {
    return NextResponse.json({ error: "email & password required" }, { status: 400 });
  }

  // Pre-check (still race-safe thanks to unique constraint + try/catch below)
  const [existing] = await db.select().from(users).where(eq(users.email, e)).limit(1);
  if (existing) {
    return NextResponse.json({ error: "email already in use" }, { status: 409 });
  }

  try {
    const hash = await bcrypt.hash(p, 10);
    const [u] = await db.insert(users).values({ email: e, hash, name }).returning();
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
      // choose: persist 30 days (or remove maxAge for session cookies)
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (err: any) {
    // Handle unique constraint race (PG code 23505)
    if (err?.code === "23505") {
      return NextResponse.json({ error: "email already in use" }, { status: 409 });
    }
    console.error("Signup error:", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
    }
}

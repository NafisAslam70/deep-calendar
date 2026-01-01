import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({}));
  const e = String(email || "").toLowerCase().trim();
  if (!e) return NextResponse.json({ error: "email required" }, { status: 400 });

  // Always respond success to avoid user enumeration; only set token if user exists
  const [u] = await db.select().from(users).where(eq(users.email, e)).limit(1);
  if (u) {
    const rawToken = crypto.randomBytes(24).toString("hex");
    const hashed = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await db
      .update(users)
      .set({ resetToken: hashed, resetTokenExpiresAt: expiresAt })
      .where(eq(users.id, u.id));

    const payload: Record<string, unknown> = { ok: true };
    if (process.env.NODE_ENV !== "production") {
      payload.devToken = rawToken; // exposed only in non-prod for local testing
      payload.expiresAt = expiresAt.toISOString();
    }
    return NextResponse.json(payload);
  }

  return NextResponse.json({ ok: true });
}

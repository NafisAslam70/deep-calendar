import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(req: NextRequest) {
  // Accept either Authorization: Bearer <jwt> or the dc_token cookie
  const auth = req.headers.get("authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i)?.[1];
  const cookie = req.cookies.get("dc_token")?.value;
  const token = bearer || cookie;
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    const payload = await verifyToken<{ uid: number }>(token);
    const [u] = await db.select().from(users).where(eq(users.id, payload.uid)).limit(1);
    if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return NextResponse.json({ user: { id: u.id, email: u.email, name: u.name } });
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
}

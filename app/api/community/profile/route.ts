import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { communityProfiles, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
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
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [profile] = await db.select().from(communityProfiles).where(eq(communityProfiles.userId, uid));
  return NextResponse.json({ profile: profile ?? null });
}

export async function PATCH(req: NextRequest) {
  const uid = await getUid(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  const displayName =
    typeof body?.displayName === "string" && body.displayName.trim() ? body.displayName.trim().slice(0, 80) : null;
  const contactEmail =
    typeof body?.contactEmail === "string" && body.contactEmail.trim() ? body.contactEmail.trim().slice(0, 120) : null;
  const contactWhatsApp =
    typeof body?.contactWhatsApp === "string" && body.contactWhatsApp.trim()
      ? body.contactWhatsApp.trim().slice(0, 40)
      : null;
  const optedIn = !!body?.optedIn;

  const updates = {
    displayName,
    contactEmail,
    contactWhatsApp,
    optedIn,
    updatedAt: new Date(),
  };

  // upsert
  const [existing] = await db.select().from(communityProfiles).where(eq(communityProfiles.userId, uid));
  if (existing) {
    await db.update(communityProfiles).set(updates).where(eq(communityProfiles.userId, uid));
  } else {
    // fallback to user.name if displayName absent
    const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, uid));
    await db.insert(communityProfiles).values({
      userId: uid,
      displayName: displayName ?? u?.name ?? null,
      contactEmail,
      contactWhatsApp,
      optedIn,
    });
  }

  const [profile] = await db.select().from(communityProfiles).where(eq(communityProfiles.userId, uid));
  return NextResponse.json({ profile });
}

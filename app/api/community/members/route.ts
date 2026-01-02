import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { communityProfiles, users } from "@/lib/schema";
import { and, eq } from "drizzle-orm";
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

  const profiles = await db
    .select({
      id: communityProfiles.id,
      displayName: communityProfiles.displayName,
      contactEmail: communityProfiles.contactEmail,
      contactWhatsApp: communityProfiles.contactWhatsApp,
      userId: communityProfiles.userId,
      userName: users.name,
    })
    .from(communityProfiles)
    .leftJoin(users, eq(users.id, communityProfiles.userId))
    .where(and(eq(communityProfiles.optedIn, true)));

  return NextResponse.json({ members: profiles });
}

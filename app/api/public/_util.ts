// app/api/public/_util.ts
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function getUserIdByPublicKey(token: string) {
  if (!token || token.length < 16) return null;
  const [u] = await db.select().from(users).where(eq(users.publicKey, token));
  return u?.id ?? null;
}

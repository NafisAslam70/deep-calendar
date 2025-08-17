import { db } from "./db";
import { goals, routines, days, blocks } from "./schema";
import { and, eq } from "drizzle-orm";
import { instantiateDayFromRoutine } from "./core/deepcalendar";

// --- helpers ---
const USER_ID = 1; // TODO: replace with real session / token user

export async function listGoals() {
  return db.select().from(goals).where(and(eq(goals.userId, USER_ID), eq(goals.isArchived, false)));
}
export async function createGoal(input: { label: string; color: string; deadlineISO?: string }) {
  const [g] = await db.insert(goals).values({
    userId: USER_ID, label: input.label, color: input.color, deadlineISO: input.deadlineISO ?? null
  }).returning();
  return g;
}
export async function deleteGoal(id: number) {
  // soft delete (archive)
  await db.update(goals).set({ isArchived: true }).where(and(eq(goals.userId, USER_ID), eq(goals.id, id)));
}

export async function getRoutine(weekday: number) {
  return db.select().from(routines).where(and(eq(routines.userId, USER_ID), eq(routines.weekday, weekday)));
}
export async function setRoutine(weekday: number, items: Array<{startMin:number; endMin:number; depthLevel:1|2|3; goalId:number; orderIndex?:number;}>) {
  // delete then insert
  await db.delete(routines).where(and(eq(routines.userId, USER_ID), eq(routines.weekday, weekday)));
  if (items.length) {
    await db.insert(routines).values(items.map((it,i)=>({
      userId: USER_ID, weekday,
      startMin: it.startMin, endMin: it.endMin,
      depthLevel: it.depthLevel, goalId: it.goalId,
      orderIndex: it.orderIndex ?? i
    })));
  }
}

export async function getDay(dateISO: string) {
  const [day] = await db.select().from(days).where(and(eq(days.userId, USER_ID), eq(days.dateISO, dateISO)));
  if (!day) return null;
  const blks = await db.select().from(blocks).where(eq(blocks.dayId, day.id));
  return { day, blks };
}

export async function ensureDayFromRoutine(dateISO: string) {
  const existing = await getDay(dateISO);
  if (existing) return existing;

  const weekday = new Date(`${dateISO}T00:00:00`).getDay();
  const routine = await getRoutine(weekday);
  // instantiate with headless core
  const pack = instantiateDayFromRoutine({
    userId: String(USER_ID),
    dateISO,
    routine: routine
      .sort((a,b)=> (a.orderIndex ?? 0) - (b.orderIndex ?? 0))
      .map(r => ({ startMin: r.startMin, endMin: r.endMin, depthLevel: r.depthLevel as 1|2|3, goalId: String(r.goalId) })),
  });

  const [dayRow] = await db.insert(days).values({ userId: USER_ID, dateISO, openedAt: new Date() }).returning();

  if (pack.blocks.length) {
    await db.insert(blocks).values(
      pack.blocks.map(b => ({
        dayId: dayRow.id,
        startMin: b.startMin,
        endMin: b.endMin,
        depthLevel: b.depthLevel,
        goalId: b.goalId ? Number(b.goalId) : null,
        status: b.status,
        actualSec: b.actualSec,
      }))
    );
  }
  const blks = await db.select().from(blocks).where(eq(blocks.dayId, dayRow.id));
  return { day: dayRow, blks };
}

export async function updateBlock(blockId: number, patch: Partial<{ status: string; goalId: number|null; depthLevel: number; actualSec: number }>) {
  await db.update(blocks).set({
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.goalId !== undefined ? { goalId: patch.goalId } : {}),
    ...(patch.depthLevel ? { depthLevel: patch.depthLevel } : {}),
    ...(patch.actualSec !== undefined ? { actualSec: patch.actualSec } : {}),
  }).where(eq(blocks.id, blockId));
}

export async function shutdownDay(dateISO: string, journal?: string) {
  await db.update(days).set({ shutdownAt: new Date(), journal: journal ?? null })
    .where(and(eq(days.userId, USER_ID), eq(days.dateISO, dateISO)));
}

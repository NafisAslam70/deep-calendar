export type DepthLevel = 1 | 2 | 3;
export type Status = "planned" | "active" | "done" | "skipped";

export type RoutineItem = { startMin: number; endMin: number; depthLevel: DepthLevel; goalId: string };
export type DayBlock = {
  id: string;
  startMin: number;
  endMin: number;
  depthLevel: DepthLevel;
  goalId?: string;
  status: Status;
  actualSec: number;
};
export type DayPack = {
  userId: string;
  dateISO: string;
  openedAt?: number;
  shutdownAt?: number;
  journal?: string;
  blocks: DayBlock[];
};

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const fromMinutes = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

export function instantiateDayFromRoutine(params: {
  userId: string;
  dateISO: string;
  routine: RoutineItem[];
  idFactory?: () => string;
}): DayPack {
  const id = params.idFactory ?? (() => Math.random().toString(36).slice(2, 10));
  return {
    userId: params.userId,
    dateISO: params.dateISO,
    openedAt: Date.now(),
    blocks: params.routine
      .slice()
      .sort((a, b) => a.startMin - b.startMin)
      .map((r) => ({
        id: id(),
        startMin: r.startMin,
        endMin: r.endMin,
        depthLevel: r.depthLevel,
        goalId: r.goalId,
        status: "planned",
        actualSec: 0,
      })),
  };
}

export function startBlock(pack: DayPack, blockId: string): DayPack {
  const next = { ...pack, blocks: pack.blocks.map((b) => ({ ...b })) };
  for (const b of next.blocks) if (b.status === "active") b.status = "done";
  const blk = next.blocks.find((b) => b.id === blockId);
  if (blk) blk.status = "active";
  return next;
}

export function stopActive(pack: DayPack): DayPack {
  const next = { ...pack, blocks: pack.blocks.map((b) => ({ ...b })) };
  for (const b of next.blocks) if (b.status === "active") b.status = "done";
  return next;
}

export function updateBlock(
  pack: DayPack,
  blockId: string,
  patch: Partial<Pick<DayBlock, "goalId" | "depthLevel" | "status" | "actualSec">>
): DayPack {
  const next = { ...pack, blocks: pack.blocks.map((b) => ({ ...b })) };
  const b = next.blocks.find((x) => x.id === blockId);
  if (!b) return next;
  if (patch.goalId !== undefined) b.goalId = patch.goalId || undefined;
  if (patch.depthLevel) b.depthLevel = patch.depthLevel;
  if (patch.status) b.status = patch.status;
  if (patch.actualSec !== undefined) b.actualSec = patch.actualSec;
  return next;
}

export function shutdown(pack: DayPack, journal?: string): DayPack {
  return { ...stopActive(pack), shutdownAt: Date.now(), journal };
}

export function summarize(pack: DayPack) {
  const byGoal: Record<string, { plannedMin: number; actualSec: number }> = {};
  const byDepth: Record<DepthLevel, { plannedMin: number; actualSec: number }> = {
    1: { plannedMin: 0, actualSec: 0 },
    2: { plannedMin: 0, actualSec: 0 },
    3: { plannedMin: 0, actualSec: 0 },
  };
  for (const b of pack.blocks) {
    const planned = b.endMin - b.startMin;
    if (b.goalId) {
      byGoal[b.goalId] ??= { plannedMin: 0, actualSec: 0 };
      byGoal[b.goalId].plannedMin += planned;
      byGoal[b.goalId].actualSec += b.actualSec;
    }
    byDepth[b.depthLevel].plannedMin += planned;
    byDepth[b.depthLevel].actualSec += b.actualSec;
  }
  return { byGoal, byDepth };
}

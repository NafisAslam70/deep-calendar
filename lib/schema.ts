import {
  pgTable,
  serial,
  integer,
  text,
  timestamp,
  boolean,
  smallint,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";

/* USERS — add publicKey + publicKeyCreatedAt for public API */
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull().unique(),
    hash: text("hash").notNull(),
    name: text("name"),
    publicKey: text("public_key").unique(),
    publicKeyCreatedAt: timestamp("public_key_created_at", { withTimezone: true }),
    resetToken: text("reset_token"),
    resetTokenExpiresAt: timestamp("reset_token_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    resetTokenIdx: index("idx_users_reset_token").on(t.resetToken),
  })
);

/* GOALS */
export const goals = pgTable(
  "goals",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentGoalId: integer("parent_goal_id"),
    priority: smallint("priority").notNull().default(0),
    label: text("label").notNull(),
    color: text("color").notNull().default("bg-blue-500"),
    deadlineISO: text("deadline_iso"),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byUser: index("idx_goals_user").on(t.userId),
    byParent: index("idx_goals_parent").on(t.parentGoalId),
    parentFk: foreignKey({
      columns: [t.parentGoalId],
      foreignColumns: [t.id],
    }),
  })
);

/* ROUTINE WINDOWS (per weekday open/close time) */
export const routineWindows = pgTable(
  "routine_windows",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(), // 0..6
    openMin: integer("open_min").notNull(),
    closeMin: integer("close_min").notNull(),
  },
  (t) => ({
    uniqUserDay: uniqueIndex("uniq_windows_user_day").on(t.userId, t.weekday),
    byUserDay: index("idx_windows_user_day").on(t.userId, t.weekday),
  })
);

/* ROUTINES (weekday templates; one row per block) */
export const routines = pgTable(
  "routines",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(),
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    depthLevel: smallint("depth_level").notNull(), // 1|2|3
    goalId: integer("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    label: text("label"),
    orderIndex: integer("order_index").notNull().default(0),
  },
  (t) => ({
    byUserDay: index("idx_routines_user_weekday").on(t.userId, t.weekday),
    byUserDayTime: index("idx_routines_user_day_time").on(t.userId, t.weekday, t.startMin),
    uniqPerDayOrder: uniqueIndex("uniq_routines_user_weekday_order").on(
      t.userId,
      t.weekday,
      t.orderIndex
    ),
  })
);

/* DAYS (actual calendar day) */
export const days = pgTable(
  "days",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    dateISO: text("date_iso").notNull(), // 'YYYY-MM-DD'
    openedAt: timestamp("opened_at", { withTimezone: true }),
    shutdownAt: timestamp("shutdown_at", { withTimezone: true }),
    journal: text("journal"),
  },
  (t) => ({
    uniqUserDate: uniqueIndex("uniq_days_user_date").on(t.userId, t.dateISO),
    byUser: index("idx_days_user").on(t.userId),
  })
);

/* BLOCKS (standing from routine OR one-off "single-day") */
export const blocks = pgTable(
  "blocks",
  {
    id: serial("id").primaryKey(),
    dayId: integer("day_id")
      .notNull()
      .references(() => days.id, { onDelete: "cascade" }),
    startMin: integer("start_min").notNull(),
    endMin: integer("end_min").notNull(),
    depthLevel: smallint("depth_level").notNull(), // 1|2|3
    goalId: integer("goal_id").references(() => goals.id, { onDelete: "set null" }),
    status: text("status").notNull().default("planned"), // planned|active|done|skipped
    actualSec: integer("actual_sec").notNull().default(0),
    // NEW: free-text task/label for one-offs (and copy of routine label)
    label: text("label"),
    // provenance
    source: text("source").notNull().default("standing"), // "standing" | "single-day"
  },
  (t) => ({
    byDay: index("idx_blocks_day").on(t.dayId),
  })
);

// lib/schema.ts
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
} from "drizzle-orm/pg-core";

/* USERS — add publicKey + publicKeyCreatedAt for public API */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  hash: text("hash").notNull(),
  name: text("name"),
  // NEW (for public, read-only API token)
  publicKey: text("public_key").unique(), // nullable until user generates
  publicKeyCreatedAt: timestamp("public_key_created_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* GOALS */
export const goals = pgTable(
  "goals",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    color: text("color").notNull().default("bg-blue-500"),
    // store 'YYYY-MM-DD' as TEXT (easy migrations)
    deadlineISO: text("deadline_iso"),
    isArchived: boolean("is_archived").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    byUser: index("idx_goals_user").on(t.userId),
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
    openMin: integer("open_min").notNull(), // minutes from 00:00
    closeMin: integer("close_min").notNull(), // minutes from 00:00
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
    weekday: smallint("weekday").notNull(), // 0..6
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
    // optional: helps sort quickly
    byUserDayTime: index("idx_routines_user_day_time").on(
      t.userId,
      t.weekday,
      t.startMin
    ),
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

/* BLOCKS (instantiated from routine for a specific day) */
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
  },
  (t) => ({
    byDay: index("idx_blocks_day").on(t.dayId),
  })
);

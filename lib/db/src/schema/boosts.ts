import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const boostsTable = pgTable("boosts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  type: text("type").notNull(),
  targetUserId: integer("target_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

export type Boost = typeof boostsTable.$inferSelect;

import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const likesTable = pgTable("likes", {
  id: serial("id").primaryKey(),
  fromUserId: integer("from_user_id").notNull(),
  toUserId: integer("to_user_id").notNull(),
  action: text("action").notNull(), // 'like' | 'dislike'
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLikeSchema = createInsertSchema(likesTable).omit({ id: true, createdAt: true });
export type InsertLike = z.infer<typeof insertLikeSchema>;
export type Like = typeof likesTable.$inferSelect;

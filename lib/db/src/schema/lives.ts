import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const livesTable = pgTable("lives", {
  id: serial("id").primaryKey(),
  hostId: integer("host_id").notNull(),
  title: text("title").notNull().default("Live"),
  isActive: boolean("is_active").notNull().default(true),
  viewerCount: integer("viewer_count").notNull().default(0),
  hostPeerJsId: text("host_peer_js_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertLiveSchema = createInsertSchema(livesTable).omit({ id: true, createdAt: true });
export type InsertLive = z.infer<typeof insertLiveSchema>;
export type Live = typeof livesTable.$inferSelect;

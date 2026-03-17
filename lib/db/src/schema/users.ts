import { boolean, integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  username: text("username").unique(),
  age: integer("age").notNull(),
  bio: text("bio").notNull(),
  photoUrl: text("photo_url").notNull(),
  photos: text("photos").array(),
  isPremium: boolean("is_premium").notNull().default(false),
  city: text("city"),
  interests: text("interests").array(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;

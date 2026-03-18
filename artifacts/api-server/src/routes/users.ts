import { Router, type IRouter } from "express";
import { db, usersTable, likesTable } from "@workspace/db";
import { eq, and, notInArray, isNotNull } from "drizzle-orm";
import { CITY_COORDS } from "./auth";

const router: IRouter = Router();

export function toUserDto(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    username: u.username ?? null,
    age: u.age,
    bio: u.bio,
    photoUrl: u.photoUrl,
    photos: u.photos ?? [],
    isPremium: u.isPremium,
    city: u.city,
    interests: u.interests ?? [],
    lat: u.lat ?? null,
    lng: u.lng ?? null,
  };
}

router.get("/users", async (req, res) => {
  const currentUserId = parseInt(req.query.currentUserId as string);
  if (isNaN(currentUserId)) { res.status(400).json({ error: "currentUserId required" }); return; }

  const alreadySwiped = await db.select({ toUserId: likesTable.toUserId }).from(likesTable).where(eq(likesTable.fromUserId, currentUserId));
  const swipedIds = alreadySwiped.map(r => r.toUserId);
  const exclude = [currentUserId, ...swipedIds];

  const users = await db.select().from(usersTable).where(
    exclude.length > 0 ? notInArray(usersTable.id, exclude) : undefined
  ).limit(20);

  res.json(users.map(toUserDto));
});

// IMPORTANT: Specific routes must come BEFORE the generic /:id route
router.get("/users/check-username/:username", async (req, res) => {
  const raw = req.params.username.replace(/^@/, "").toLowerCase();
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, raw));
  res.json({ available: !existing });
});

router.get("/users/by-username/:username", async (req, res) => {
  const raw = req.params.username.replace(/^@/, "").toLowerCase();
  const [user] = await db.select().from(usersTable).where(eq(usersTable.username, raw));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(toUserDto(user));
});

router.get("/users/map", async (req, res) => {
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    age: usersTable.age,
    photoUrl: usersTable.photoUrl,
    city: usersTable.city,
    lat: usersTable.lat,
    lng: usersTable.lng,
    isPremium: usersTable.isPremium,
  }).from(usersTable).where(
    and(isNotNull(usersTable.lat), isNotNull(usersTable.lng))
  ).limit(200);
  res.json(users);
});

router.post("/users/register", async (req, res) => {
  const { name, username, age, bio, photoUrl, photos, city, interests } = req.body;
  if (!name || !age || !bio) { res.status(400).json({ error: "name, age, bio required" }); return; }

  const rawUsername = username ? username.replace(/^@/, "").toLowerCase() : null;

  if (rawUsername) {
    const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, rawUsername));
    if (existing) { res.status(400).json({ error: "Nazwa użytkownika jest już zajęta" }); return; }
  }

  const coords = city ? CITY_COORDS[city] : undefined;

  const [user] = await db.insert(usersTable).values({
    name,
    username: rawUsername,
    age: parseInt(age),
    bio,
    photoUrl: photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ccff00&color=000&size=400`,
    photos: photos || [],
    city: city || null,
    interests: interests || [],
    isPremium: false,
    lat: coords?.[0] ?? null,
    lng: coords?.[1] ?? null,
  }).returning();

  res.json(toUserDto(user));
});

router.get("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json(toUserDto(user));
});

router.patch("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }

  const { name, username, age, bio, photoUrl, photos, city, interests } = req.body;
  const updates: Record<string, unknown> = {};

  if (name !== undefined) updates.name = name;
  if (age !== undefined) updates.age = parseInt(age);
  if (bio !== undefined) updates.bio = bio;
  if (photoUrl !== undefined) updates.photoUrl = photoUrl;
  if (photos !== undefined) updates.photos = photos;
  if (interests !== undefined) updates.interests = interests;

  if (city !== undefined) {
    updates.city = city;
    const coords = city ? CITY_COORDS[city] : null;
    updates.lat = coords?.[0] ?? null;
    updates.lng = coords?.[1] ?? null;
  }

  if (username !== undefined) {
    const rawUsername = username ? username.replace(/^@/, "").toLowerCase() : null;
    if (rawUsername) {
      const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.username, rawUsername));
      if (existing && existing.id !== id) { res.status(400).json({ error: "Nazwa użytkownika jest już zajęta" }); return; }
    }
    updates.username = rawUsername;
  }

  const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json(toUserDto(updated));
});

export default router;

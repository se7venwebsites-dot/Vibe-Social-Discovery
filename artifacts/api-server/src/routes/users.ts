import { Router, type IRouter } from "express";
import { db, usersTable, likesTable, friendRequestsTable, boostsTable, blocksTable } from "@workspace/db";
import { eq, and, notInArray, isNotNull, or, count, gt, inArray } from "drizzle-orm";
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
    voivodeship: u.voivodeship ?? null,
    gender: u.gender ?? null,
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

  const blocks = await db.select().from(blocksTable).where(
    or(eq(blocksTable.userId, currentUserId), eq(blocksTable.blockedUserId, currentUserId))
  );
  const blockedIds = blocks.map(b => b.userId === currentUserId ? b.blockedUserId : b.userId);

  const exclude = [currentUserId, ...swipedIds, ...blockedIds];

  const now = new Date();
  const spotlightBoosts = await db.select({ userId: boostsTable.userId }).from(boostsTable).where(
    and(
      or(eq(boostsTable.type, "spotlight"), eq(boostsTable.type, "megaboost")),
      gt(boostsTable.expiresAt, now)
    )
  );
  const boostedIds = new Set(spotlightBoosts.map(b => b.userId));

  const users = await db.select().from(usersTable).where(
    exclude.length > 0 ? notInArray(usersTable.id, exclude) : undefined
  ).limit(20);

  const sorted = [...users].sort((a, b) => {
    const aB = boostedIds.has(a.id) ? 1 : 0;
    const bB = boostedIds.has(b.id) ? 1 : 0;
    return bB - aB;
  });

  res.json(sorted.map(u => ({ ...toUserDto(u), isBoosted: boostedIds.has(u.id) })));
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
  const currentUserId = parseInt(req.query.currentUserId as string);
  let blockedIds: number[] = [];
  if (!isNaN(currentUserId)) {
    const blocks = await db.select().from(blocksTable).where(
      or(eq(blocksTable.userId, currentUserId), eq(blocksTable.blockedUserId, currentUserId))
    );
    blockedIds = blocks.map(b => b.userId === currentUserId ? b.blockedUserId : b.userId);
  }

  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    age: usersTable.age,
    photoUrl: usersTable.photoUrl,
    city: usersTable.city,
    lat: usersTable.lat,
    lng: usersTable.lng,
    isPremium: usersTable.isPremium,
    lastLocationUpdate: usersTable.lastLocationUpdate,
  }).from(usersTable).where(
    and(isNotNull(usersTable.lat), isNotNull(usersTable.lng))
  ).limit(200);

  const filtered = blockedIds.length > 0 ? users.filter(u => !blockedIds.includes(u.id)) : users;
  res.json(filtered);
});

router.post("/users/:id/location", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }
  const { lat, lng } = req.body;
  if (lat == null || lng == null) { res.status(400).json({ error: "lat and lng required" }); return; }
  const [updated] = await db.update(usersTable).set({
    lat: parseFloat(lat),
    lng: parseFloat(lng),
    lastLocationUpdate: new Date(),
  }).where(eq(usersTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ success: true });
});

router.post("/users/register", async (req, res) => {
  const { name, username, age, bio, photoUrl, photos, city, voivodeship, gender, interests } = req.body;
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
    voivodeship: voivodeship || null,
    gender: gender || null,
    interests: interests || [],
    isPremium: false,
    lat: coords?.[0] ?? null,
    lng: coords?.[1] ?? null,
  }).returning();

  res.json(toUserDto(user));
});

router.get("/users/:id/stats", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "invalid id" }); return; }

  const [swipeCount] = await db.select({ val: count() }).from(likesTable).where(eq(likesTable.fromUserId, id));
  const [friendCount] = await db.select({ val: count() }).from(friendRequestsTable).where(
    and(
      or(eq(friendRequestsTable.fromUserId, id), eq(friendRequestsTable.toUserId, id)),
      eq(friendRequestsTable.status, "accepted")
    )
  );
  const [receivedLikes] = await db.select({ val: count() }).from(likesTable).where(
    and(eq(likesTable.toUserId, id), eq(likesTable.action, "like"))
  );
  res.json({
    swipeCount: swipeCount?.val ?? 0,
    friendCount: friendCount?.val ?? 0,
    receivedLikes: receivedLikes?.val ?? 0,
  });
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

  const { name, username, age, bio, photoUrl, photos, city, voivodeship, gender, interests } = req.body;
  const updates: Record<string, unknown> = {};

  if (name !== undefined) updates.name = name;
  if (age !== undefined) updates.age = parseInt(age);
  if (bio !== undefined) updates.bio = bio;
  if (photoUrl !== undefined) updates.photoUrl = photoUrl;
  if (photos !== undefined) updates.photos = photos;
  if (interests !== undefined) updates.interests = interests;
  if (voivodeship !== undefined) updates.voivodeship = voivodeship;
  if (gender !== undefined) updates.gender = gender;

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

router.post("/users/:id/push-token", async (req, res) => {
  const id = parseInt(req.params.id);
  const { pushToken } = req.body;
  if (isNaN(id) || !pushToken) { res.status(400).json({ error: "invalid" }); return; }
  await db.update(usersTable).set({ pushToken }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

export default router;

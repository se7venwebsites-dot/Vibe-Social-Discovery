import { Router, type IRouter } from "express";
import { db, usersTable, likesTable } from "@workspace/db";
import { eq, and, notInArray } from "drizzle-orm";

const router: IRouter = Router();

router.get("/users", async (req, res) => {
  const currentUserId = parseInt(req.query.currentUserId as string);
  if (isNaN(currentUserId)) {
    res.status(400).json({ error: "currentUserId is required" });
    return;
  }

  const alreadySwiped = await db
    .select({ toUserId: likesTable.toUserId })
    .from(likesTable)
    .where(eq(likesTable.fromUserId, currentUserId));

  const swipedIds = alreadySwiped.map((r) => r.toUserId);
  const exclude = [currentUserId, ...swipedIds];

  const users = await db
    .select()
    .from(usersTable)
    .where(exclude.length > 0 ? notInArray(usersTable.id, exclude) : undefined)
    .limit(20);

  res.json(users.map(toUserDto));
});

router.post("/users/register", async (req, res) => {
  const { name, age, bio, photoUrl, city, interests } = req.body;
  if (!name || !age || !bio) {
    res.status(400).json({ error: "name, age, bio required" });
    return;
  }
  const [user] = await db
    .insert(usersTable)
    .values({
      name,
      age: parseInt(age),
      bio,
      photoUrl: photoUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=ccff00&color=000&size=400`,
      city: city || null,
      interests: interests || [],
      isPremium: false,
    })
    .returning();
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
  const { name, age, bio, photoUrl, city, interests } = req.body;
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (age !== undefined) updates.age = parseInt(age);
  if (bio !== undefined) updates.bio = bio;
  if (photoUrl !== undefined) updates.photoUrl = photoUrl;
  if (city !== undefined) updates.city = city;
  if (interests !== undefined) updates.interests = interests;

  const [updated] = await db
    .update(usersTable)
    .set(updates)
    .where(eq(usersTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "User not found" }); return; }
  res.json(toUserDto(updated));
});

function toUserDto(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    age: u.age,
    bio: u.bio,
    photoUrl: u.photoUrl,
    isPremium: u.isPremium,
    city: u.city,
    interests: u.interests ?? [],
  };
}

export default router;

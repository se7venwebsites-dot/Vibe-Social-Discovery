import { Router, type IRouter } from "express";
import { db, usersTable, likesTable } from "@workspace/db";
import { eq, and, notInArray, inArray } from "drizzle-orm";

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
    .where(
      exclude.length > 0
        ? notInArray(usersTable.id, exclude)
        : undefined
    )
    .limit(20);

  res.json(
    users.map((u) => ({
      id: u.id,
      name: u.name,
      age: u.age,
      bio: u.bio,
      photoUrl: u.photoUrl,
      isPremium: u.isPremium,
      city: u.city,
      interests: u.interests ?? [],
    }))
  );
});

router.get("/users/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: user.id,
    name: user.name,
    age: user.age,
    bio: user.bio,
    photoUrl: user.photoUrl,
    isPremium: user.isPremium,
    city: user.city,
    interests: user.interests ?? [],
  });
});

export default router;

import { Router, type IRouter } from "express";
import { db, likesTable, usersTable, matchesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const router: IRouter = Router();

async function createMatchIfNeeded(fromUserId: number, toUserId: number): Promise<boolean> {
  const mutual = await db
    .select()
    .from(likesTable)
    .where(
      and(
        eq(likesTable.fromUserId, toUserId),
        eq(likesTable.toUserId, fromUserId),
        eq(likesTable.action, "like")
      )
    );

  if (mutual.length > 0) {
    const u1 = Math.min(fromUserId, toUserId);
    const u2 = Math.max(fromUserId, toUserId);
    const existing = await db
      .select()
      .from(matchesTable)
      .where(and(eq(matchesTable.user1Id, u1), eq(matchesTable.user2Id, u2)));
    if (existing.length === 0) {
      await db.insert(matchesTable).values({ user1Id: u1, user2Id: u2 });
    }
    return true;
  }
  return false;
}

router.post("/likes", async (req, res) => {
  const { fromUserId, toUserId, action } = req.body;
  if (!fromUserId || !toUserId || !action) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const fId = parseInt(fromUserId);
  const tId = parseInt(toUserId);

  const existing = await db
    .select()
    .from(likesTable)
    .where(and(eq(likesTable.fromUserId, fId), eq(likesTable.toUserId, tId)));

  if (existing.length === 0) {
    await db.insert(likesTable).values({ fromUserId: fId, toUserId: tId, action });
  } else {
    await db
      .update(likesTable)
      .set({ action })
      .where(and(eq(likesTable.fromUserId, fId), eq(likesTable.toUserId, tId)));
  }

  let isMatch = false;
  if (action === "like") {
    isMatch = await createMatchIfNeeded(fId, tId);
  }

  res.json({ success: true, isMatch });
});

router.post("/matches/friend", async (req, res) => {
  const { fromUserId, toUserId } = req.body;
  if (!fromUserId || !toUserId) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const fId = parseInt(fromUserId);
  const tId = parseInt(toUserId);

  const existing = await db
    .select()
    .from(likesTable)
    .where(and(eq(likesTable.fromUserId, fId), eq(likesTable.toUserId, tId)));
  if (existing.length === 0) {
    await db.insert(likesTable).values({ fromUserId: fId, toUserId: tId, action: "like" });
  }

  const isMatch = await createMatchIfNeeded(fId, tId);
  res.json({ success: true, isMatch });
});

router.get("/likes/received/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const received = await db
    .select({ fromUserId: likesTable.fromUserId })
    .from(likesTable)
    .where(and(eq(likesTable.toUserId, userId), eq(likesTable.action, "like")));

  if (received.length === 0) {
    const allUsers = await db
      .select()
      .from(usersTable)
      .limit(50);
    const others = allUsers.filter((u) => u.id !== userId);
    const shuffled = others.sort(() => Math.random() - 0.5).slice(0, 5);
    res.json(
      shuffled.map((u) => ({
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
    return;
  }

  const fromIds = received.map((r) => r.fromUserId);
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, fromIds));

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

export default router;

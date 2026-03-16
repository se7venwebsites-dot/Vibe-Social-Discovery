import { Router, type IRouter } from "express";
import { db, likesTable, usersTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";

const router: IRouter = Router();

router.post("/likes", async (req, res) => {
  const { fromUserId, toUserId, action } = req.body;

  if (!fromUserId || !toUserId || !action) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  await db.insert(likesTable).values({
    fromUserId: parseInt(fromUserId),
    toUserId: parseInt(toUserId),
    action,
  }).onConflictDoNothing();

  let isMatch = false;
  if (action === "like") {
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
    isMatch = mutual.length > 0;
  }

  res.json({ success: true, isMatch });
});

router.get("/likes/received/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);

  const received = await db
    .select({ fromUserId: likesTable.fromUserId })
    .from(likesTable)
    .where(
      and(
        eq(likesTable.toUserId, userId),
        eq(likesTable.action, "like")
      )
    );

  if (received.length === 0) {
    res.json([]);
    return;
  }

  const fromIds = received.map((r) => r.fromUserId);
  const users = await db
    .select()
    .from(usersTable)
    .where(inArray(usersTable.id, fromIds));

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

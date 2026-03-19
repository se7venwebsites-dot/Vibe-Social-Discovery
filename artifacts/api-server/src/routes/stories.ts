import { Router, type IRouter } from "express";
import { db, storiesTable, usersTable, friendRequestsTable, matchesTable } from "@workspace/db";
import { eq, and, or, gt, inArray, desc } from "drizzle-orm";

const router: IRouter = Router();

router.post("/stories", async (req, res) => {
  const { userId, mediaUrl, type, caption } = req.body;
  if (!userId || !mediaUrl) {
    res.status(400).json({ error: "userId and mediaUrl required" });
    return;
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [story] = await db.insert(storiesTable).values({
    userId: parseInt(userId),
    mediaUrl,
    type: type || "photo",
    caption: caption || null,
    expiresAt,
  }).returning();

  res.json(story);
});

router.get("/stories/feed/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const now = new Date();

  const friends = await db.select().from(friendRequestsTable).where(
    and(
      or(eq(friendRequestsTable.fromUserId, userId), eq(friendRequestsTable.toUserId, userId)),
      eq(friendRequestsTable.status, "accepted")
    )
  );
  const matches = await db.select().from(matchesTable).where(
    or(eq(matchesTable.user1Id, userId), eq(matchesTable.user2Id, userId))
  );

  const connectedIds = new Set<number>();
  connectedIds.add(userId);
  friends.forEach(f => connectedIds.add(f.fromUserId === userId ? f.toUserId : f.fromUserId));
  matches.forEach(m => connectedIds.add(m.user1Id === userId ? m.user2Id : m.user1Id));

  const allIds = Array.from(connectedIds);

  const stories = await db.select().from(storiesTable)
    .where(and(
      inArray(storiesTable.userId, allIds),
      gt(storiesTable.expiresAt, now)
    ))
    .orderBy(desc(storiesTable.createdAt));

  const userIds = [...new Set(stories.map(s => s.userId))];
  const users = userIds.length > 0
    ? await db.select({ id: usersTable.id, name: usersTable.name, photoUrl: usersTable.photoUrl })
      .from(usersTable).where(inArray(usersTable.id, userIds))
    : [];

  const grouped = userIds.map(uid => {
    const u = users.find(u => u.id === uid);
    return {
      userId: uid,
      name: u?.name ?? "",
      photoUrl: u?.photoUrl ?? "",
      isOwn: uid === userId,
      stories: stories.filter(s => s.userId === uid).map(s => ({
        id: s.id,
        mediaUrl: s.mediaUrl,
        type: s.type,
        caption: s.caption,
        createdAt: s.createdAt?.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      })),
    };
  });

  const own = grouped.filter(g => g.isOwn);
  const others = grouped.filter(g => !g.isOwn);
  res.json([...own, ...others]);
});

router.delete("/stories/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(storiesTable).where(eq(storiesTable.id, id));
  res.json({ success: true });
});

router.get("/stories/cleanup", async (_req, res) => {
  const now = new Date();
  const deleted = await db.delete(storiesTable).where(gt(now, storiesTable.expiresAt)).returning();
  res.json({ cleaned: deleted.length });
});

export default router;

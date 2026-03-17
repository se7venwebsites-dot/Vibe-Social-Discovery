import { Router, type IRouter } from "express";
import { db, matchesTable, usersTable, messagesTable } from "@workspace/db";
import { eq, or, and, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

router.get("/matches/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);

  const matches = await db
    .select()
    .from(matchesTable)
    .where(or(eq(matchesTable.user1Id, userId), eq(matchesTable.user2Id, userId)));

  if (matches.length === 0) { res.json([]); return; }

  const results = await Promise.all(
    matches.map(async (m) => {
      const otherId = m.user1Id === userId ? m.user2Id : m.user1Id;
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, otherId));
      if (!user) return null;

      const lastMsgArr = await db
        .select()
        .from(messagesTable)
        .where(
          or(
            and(eq(messagesTable.senderId, userId), eq(messagesTable.receiverId, otherId)),
            and(eq(messagesTable.senderId, otherId), eq(messagesTable.receiverId, userId))
          )
        )
        .orderBy(desc(messagesTable.createdAt))
        .limit(1);

      const unreadArr = await db
        .select({ count: sql<number>`count(*)` })
        .from(messagesTable)
        .where(
          and(
            eq(messagesTable.senderId, otherId),
            eq(messagesTable.receiverId, userId),
            eq(messagesTable.isRead, false)
          )
        );

      return {
        id: user.id,
        name: user.name,
        username: user.username ?? null,
        age: user.age,
        bio: user.bio,
        photoUrl: user.photoUrl,
        isPremium: user.isPremium,
        city: user.city,
        matchId: m.id,
        lastMessage: lastMsgArr[0]?.content ?? null,
        unreadCount: Number(unreadArr[0]?.count ?? 0),
      };
    })
  );

  res.json(results.filter(Boolean));
});

export default router;

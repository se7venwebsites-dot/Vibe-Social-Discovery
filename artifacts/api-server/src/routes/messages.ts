import { Router, type IRouter } from "express";
import { db, messagesTable, usersTable, matchesTable } from "@workspace/db";
import { eq, and, or, asc, desc } from "drizzle-orm";

const router: IRouter = Router();

router.post("/messages", async (req, res) => {
  const { senderId, receiverId, content, isSwipeMessage } = req.body;
  if (!senderId || !receiverId || !content) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const [msg] = await db
    .insert(messagesTable)
    .values({
      senderId: parseInt(senderId),
      receiverId: parseInt(receiverId),
      content,
      isSwipeMessage: isSwipeMessage === true,
    })
    .returning();

  res.json({
    id: msg.id,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    content: msg.content,
    isRead: msg.isRead,
    isSwipeMessage: msg.isSwipeMessage,
    createdAt: msg.createdAt?.toISOString() ?? new Date().toISOString(),
  });
});

router.get("/messages/swipe/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const msgs = await db
    .select()
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.receiverId, userId),
        eq(messagesTable.isSwipeMessage, true)
      )
    )
    .orderBy(desc(messagesTable.createdAt));

  const matches = await db
    .select()
    .from(matchesTable)
    .where(or(eq(matchesTable.user1Id, userId), eq(matchesTable.user2Id, userId)));
  const matchedIds = new Set(matches.map(m => m.user1Id === userId ? m.user2Id : m.user1Id));

  const result = await Promise.all(
    msgs.map(async (m) => {
      const [sender] = await db.select({
        id: usersTable.id,
        name: usersTable.name,
        age: usersTable.age,
        photoUrl: usersTable.photoUrl,
        city: usersTable.city,
      }).from(usersTable).where(eq(usersTable.id, m.senderId));
      return {
        id: m.id,
        senderId: m.senderId,
        content: m.content,
        isRead: m.isRead,
        createdAt: m.createdAt?.toISOString() ?? new Date().toISOString(),
        isMatched: matchedIds.has(m.senderId),
        sender: sender || null,
      };
    })
  );

  res.json(result);
});

router.get("/messages/unread/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const unread = await db
    .select()
    .from(messagesTable)
    .where(
      and(
        eq(messagesTable.receiverId, userId),
        eq(messagesTable.isRead, false)
      )
    );
  res.json({ count: unread.length });
});

router.get("/messages/:userId/:otherId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const otherId = parseInt(req.params.otherId);

  await db
    .update(messagesTable)
    .set({ isRead: true })
    .where(
      and(
        eq(messagesTable.senderId, otherId),
        eq(messagesTable.receiverId, userId),
        eq(messagesTable.isRead, false)
      )
    );

  const msgs = await db
    .select()
    .from(messagesTable)
    .where(
      or(
        and(eq(messagesTable.senderId, userId), eq(messagesTable.receiverId, otherId)),
        and(eq(messagesTable.senderId, otherId), eq(messagesTable.receiverId, userId))
      )
    )
    .orderBy(asc(messagesTable.createdAt));

  res.json(
    msgs.map((m) => ({
      id: m.id,
      senderId: m.senderId,
      receiverId: m.receiverId,
      content: m.content,
      isRead: m.isRead,
      createdAt: m.createdAt?.toISOString() ?? new Date().toISOString(),
    }))
  );
});

export default router;

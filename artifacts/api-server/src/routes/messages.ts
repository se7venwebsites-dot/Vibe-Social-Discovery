import { Router, type IRouter } from "express";
import { db, messagesTable } from "@workspace/db";
import { eq, and, or, asc } from "drizzle-orm";

const router: IRouter = Router();

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

router.post("/messages", async (req, res) => {
  const { senderId, receiverId, content } = req.body;
  if (!senderId || !receiverId || !content) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const [msg] = await db
    .insert(messagesTable)
    .values({ senderId: parseInt(senderId), receiverId: parseInt(receiverId), content })
    .returning();

  res.json({
    id: msg.id,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    content: msg.content,
    isRead: msg.isRead,
    createdAt: msg.createdAt?.toISOString() ?? new Date().toISOString(),
  });
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

export default router;

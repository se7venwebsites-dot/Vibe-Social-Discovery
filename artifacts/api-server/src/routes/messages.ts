import { Router, type IRouter } from "express";
import { db, messagesTable, usersTable, matchesTable, friendRequestsTable, blocksTable } from "@workspace/db";
import { eq, and, or, asc, desc } from "drizzle-orm";

const router: IRouter = Router();

router.post("/messages", async (req, res) => {
  const { senderId, receiverId, content, isSwipeMessage, type, mediaUrl } = req.body;
  if (!senderId || !receiverId) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const sId = parseInt(senderId);
  const rId = parseInt(receiverId);

  const blockCheck = await db.select({ id: blocksTable.id }).from(blocksTable).where(
    or(
      and(eq(blocksTable.userId, sId), eq(blocksTable.blockedUserId, rId)),
      and(eq(blocksTable.userId, rId), eq(blocksTable.blockedUserId, sId))
    )
  );
  if (blockCheck.length > 0) {
    res.status(403).json({ error: "Użytkownik jest zablokowany" });
    return;
  }

  const msgType = type || "text";
  const msgContent = content || (msgType === "photo" ? "📷 Zdjęcie" : msgType === "voice" ? "🎤 Wiadomość głosowa" : "");
  if (!msgContent && !mediaUrl) {
    res.status(400).json({ error: "content or mediaUrl required" });
    return;
  }

  const [msg] = await db
    .insert(messagesTable)
    .values({
      senderId: sId,
      receiverId: rId,
      content: msgContent,
      type: msgType,
      mediaUrl: mediaUrl || null,
      isSwipeMessage: isSwipeMessage === true,
    })
    .returning();

  try {
    const reverseMsg = await db.select({ id: messagesTable.id }).from(messagesTable).where(
      and(eq(messagesTable.senderId, rId), eq(messagesTable.receiverId, sId))
    ).limit(1);

    if (reverseMsg.length > 0) {
      const u1 = Math.min(sId, rId);
      const u2 = Math.max(sId, rId);

      const matchExists = await db.select({ id: matchesTable.id }).from(matchesTable).where(
        and(eq(matchesTable.user1Id, u1), eq(matchesTable.user2Id, u2))
      );
      if (matchExists.length === 0) throw new Error("skip");

      const existingFriend = await db.select().from(friendRequestsTable).where(
        or(
          and(eq(friendRequestsTable.fromUserId, u1), eq(friendRequestsTable.toUserId, u2)),
          and(eq(friendRequestsTable.fromUserId, u2), eq(friendRequestsTable.toUserId, u1))
        )
      );
      if (existingFriend.length === 0) {
        await db.insert(friendRequestsTable).values({
          fromUserId: u1,
          toUserId: u2,
          status: "accepted",
        }).onConflictDoNothing();
      } else if (existingFriend[0].status !== "accepted") {
        await db.update(friendRequestsTable)
          .set({ status: "accepted" })
          .where(eq(friendRequestsTable.id, existingFriend[0].id));
      }
    }
  } catch {}

  try {
    const [receiver] = await db.select({ pushToken: usersTable.pushToken, name: usersTable.name }).from(usersTable).where(eq(usersTable.id, rId));
    const [sender] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, sId));
    if (receiver?.pushToken && sender) {
      const pushBody = msgType === "photo" ? "📷 Wysłał(a) zdjęcie" : msgType === "voice" ? "🎤 Wysłał(a) wiadomość głosową" : msgContent;
      fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: receiver.pushToken,
          title: sender.name,
          body: pushBody,
          data: { type: "message", senderId: sId, receiverId: rId },
          sound: "default",
        }),
      }).catch(() => {});
    }
  } catch {}

  res.json({
    id: msg.id,
    senderId: msg.senderId,
    receiverId: msg.receiverId,
    content: msg.content,
    type: msg.type,
    mediaUrl: msg.mediaUrl,
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
      type: m.type,
      mediaUrl: m.mediaUrl,
      isRead: m.isRead,
      createdAt: m.createdAt?.toISOString() ?? new Date().toISOString(),
    }))
  );
});

export default router;

import { Router, type IRouter } from "express";
import { db, reportsTable, blocksTable } from "@workspace/db";
import { eq, and, or } from "drizzle-orm";

const router: IRouter = Router();

router.post("/reports", async (req, res) => {
  const { fromUserId, reportedUserId, reason, details } = req.body;
  if (!fromUserId || !reportedUserId || !reason) {
    res.status(400).json({ error: "fromUserId, reportedUserId, and reason required" });
    return;
  }

  const [report] = await db.insert(reportsTable).values({
    fromUserId: parseInt(fromUserId),
    reportedUserId: parseInt(reportedUserId),
    reason,
    details: details || null,
  }).returning();

  res.json({ success: true, report });
});

router.post("/blocks", async (req, res) => {
  const { userId, blockedUserId } = req.body;
  if (!userId || !blockedUserId) {
    res.status(400).json({ error: "userId and blockedUserId required" });
    return;
  }
  const uId = parseInt(userId);
  const bId = parseInt(blockedUserId);

  const existing = await db.select().from(blocksTable).where(
    and(eq(blocksTable.userId, uId), eq(blocksTable.blockedUserId, bId))
  );
  if (existing.length > 0) {
    res.json({ success: true, alreadyBlocked: true });
    return;
  }

  const [block] = await db.insert(blocksTable).values({ userId: uId, blockedUserId: bId }).returning();
  res.json({ success: true, block });
});

router.delete("/blocks/:userId/:blockedUserId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const blockedUserId = parseInt(req.params.blockedUserId);
  await db.delete(blocksTable).where(
    and(eq(blocksTable.userId, userId), eq(blocksTable.blockedUserId, blockedUserId))
  );
  res.json({ success: true });
});

router.get("/blocks/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const blocks = await db.select().from(blocksTable).where(
    or(eq(blocksTable.userId, userId), eq(blocksTable.blockedUserId, userId))
  );
  res.json(blocks);
});

export default router;

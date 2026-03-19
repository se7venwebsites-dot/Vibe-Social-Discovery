import { Router, type IRouter } from "express";
import { db, boostsTable, usersTable } from "@workspace/db";
import { eq, and, gt, inArray } from "drizzle-orm";

const router: IRouter = Router();

const BOOST_TYPES = [
  { id: "spotlight", label: "Spotlight", duration: 5 * 60 * 1000, price: "4,99 zł" },
  { id: "attention", label: "Zwróć uwagę", duration: 0, price: "4,99 zł" },
  { id: "superlike", label: "Super Like", duration: 0, price: "2,99 zł" },
  { id: "rewind", label: "Drugie Szanse", duration: 0, price: "3,99 zł" },
  { id: "megaboost", label: "Mega Boost", duration: 30 * 60 * 1000, price: "9,99 zł" },
];

router.get("/boosts/types", (_req, res) => {
  res.json(BOOST_TYPES);
});

router.post("/boosts/buy", async (req, res) => {
  const { userId, type, targetUserId } = req.body;
  if (!userId || !type) { res.status(400).json({ error: "userId and type required" }); return; }

  const boostDef = BOOST_TYPES.find(b => b.id === type);
  if (!boostDef) { res.status(400).json({ error: "Unknown boost type" }); return; }

  const expiresAt = boostDef.duration > 0 ? new Date(Date.now() + boostDef.duration) : null;

  const [boost] = await db.insert(boostsTable).values({
    userId: parseInt(userId),
    type,
    targetUserId: targetUserId ? parseInt(targetUserId) : null,
    expiresAt,
  }).returning();

  res.json({ success: true, boost });
});

router.get("/boosts/active/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "invalid userId" }); return; }

  const now = new Date();
  const active = await db.select().from(boostsTable).where(
    and(
      eq(boostsTable.userId, userId),
      gt(boostsTable.expiresAt, now)
    )
  );
  res.json(active);
});

router.get("/boosts/spotlight-users", async (_req, res) => {
  const now = new Date();
  const active = await db.select({ userId: boostsTable.userId }).from(boostsTable).where(
    and(
      eq(boostsTable.type, "spotlight"),
      gt(boostsTable.expiresAt, now)
    )
  );
  const megaActive = await db.select({ userId: boostsTable.userId }).from(boostsTable).where(
    and(
      eq(boostsTable.type, "megaboost"),
      gt(boostsTable.expiresAt, now)
    )
  );
  const ids = [...new Set([...megaActive.map(b => b.userId), ...active.map(b => b.userId)])];
  res.json(ids);
});

router.get("/boosts/attention/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  if (isNaN(userId)) { res.status(400).json({ error: "invalid userId" }); return; }

  const notifications = await db.select({
    id: boostsTable.id,
    fromUserId: boostsTable.userId,
    createdAt: boostsTable.createdAt,
  }).from(boostsTable).where(
    and(
      eq(boostsTable.type, "attention"),
      eq(boostsTable.targetUserId, userId)
    )
  );

  if (notifications.length === 0) { res.json([]); return; }

  const fromIds = [...new Set(notifications.map(n => n.fromUserId))];
  const users = await db.select({
    id: usersTable.id,
    name: usersTable.name,
    age: usersTable.age,
    photoUrl: usersTable.photoUrl,
    city: usersTable.city,
  }).from(usersTable).where(
    fromIds.length === 1
      ? eq(usersTable.id, fromIds[0])
      : inArray(usersTable.id, fromIds)
  );

  const result = notifications.map(n => ({
    id: n.id,
    fromUser: users.find(u => u.id === n.fromUserId) || null,
    createdAt: n.createdAt,
  }));

  res.json(result);
});

router.delete("/boosts/attention/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(boostsTable).where(eq(boostsTable.id, id));
  res.json({ success: true });
});

export default router;

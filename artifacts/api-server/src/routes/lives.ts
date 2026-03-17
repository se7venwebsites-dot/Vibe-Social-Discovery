import { Router, type IRouter } from "express";
import { db, livesTable, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/lives", async (req, res) => {
  const activeLives = await db.select().from(livesTable).where(eq(livesTable.isActive, true));
  if (activeLives.length === 0) { res.json([]); return; }

  const results = await Promise.all(activeLives.map(async (live) => {
    const [host] = await db.select().from(usersTable).where(eq(usersTable.id, live.hostId));
    return {
      id: live.id,
      title: live.title,
      isActive: live.isActive,
      viewerCount: live.viewerCount,
      createdAt: live.createdAt?.toISOString(),
      host: host ? {
        id: host.id,
        name: host.name,
        username: host.username,
        photoUrl: host.photoUrl,
        age: host.age,
        city: host.city,
      } : null,
    };
  }));

  res.json(results.filter(l => l.host));
});

router.post("/lives", async (req, res) => {
  const { hostId, title } = req.body;
  if (!hostId) { res.status(400).json({ error: "hostId required" }); return; }

  await db.update(livesTable).set({ isActive: false }).where(
    and(eq(livesTable.hostId, parseInt(hostId)), eq(livesTable.isActive, true))
  );

  const [live] = await db.insert(livesTable).values({
    hostId: parseInt(hostId),
    title: title || "Live",
    isActive: true,
    viewerCount: 0,
  }).returning();

  res.json({ id: live.id, hostId: live.hostId, title: live.title, isActive: live.isActive });
});

router.patch("/lives/:id/end", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.update(livesTable).set({ isActive: false }).where(eq(livesTable.id, id));
  res.json({ success: true });
});

router.patch("/lives/:id/viewers", async (req, res) => {
  const id = parseInt(req.params.id);
  const { delta } = req.body;
  const [live] = await db.select().from(livesTable).where(eq(livesTable.id, id));
  if (!live) { res.status(404).json({ error: "Live not found" }); return; }
  const newCount = Math.max(0, live.viewerCount + (parseInt(delta) || 0));
  await db.update(livesTable).set({ viewerCount: newCount }).where(eq(livesTable.id, id));
  res.json({ viewerCount: newCount });
});

export default router;

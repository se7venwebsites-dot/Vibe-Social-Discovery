import { Router, type IRouter } from "express";
import { db, friendRequestsTable, usersTable, messagesTable, matchesTable } from "@workspace/db";
import { eq, and, or, inArray } from "drizzle-orm";

const router: IRouter = Router();

function toUserDto(u: typeof usersTable.$inferSelect) {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    age: u.age,
    bio: u.bio,
    photoUrl: u.photoUrl,
    photos: u.photos ?? [],
    isPremium: u.isPremium,
    city: u.city,
    interests: u.interests ?? [],
  };
}

router.post("/friends/request", async (req, res) => {
  const { fromUserId, toUserId } = req.body;
  if (!fromUserId || !toUserId) { res.status(400).json({ error: "Missing fields" }); return; }
  const fId = parseInt(fromUserId);
  const tId = parseInt(toUserId);
  if (fId === tId) { res.status(400).json({ error: "Cannot friend yourself" }); return; }

  const existing = await db.select().from(friendRequestsTable).where(
    or(
      and(eq(friendRequestsTable.fromUserId, fId), eq(friendRequestsTable.toUserId, tId)),
      and(eq(friendRequestsTable.fromUserId, tId), eq(friendRequestsTable.toUserId, fId))
    )
  );
  if (existing.length > 0) {
    res.json({ success: true, request: existing[0] });
    return;
  }

  const [req2] = await db.insert(friendRequestsTable).values({ fromUserId: fId, toUserId: tId, status: "pending" }).returning();
  res.json({ success: true, request: req2 });
});

router.get("/friends/requests/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const requests = await db.select().from(friendRequestsTable).where(
    and(eq(friendRequestsTable.toUserId, userId), eq(friendRequestsTable.status, "pending"))
  );
  if (requests.length === 0) { res.json([]); return; }
  const fromIds = requests.map(r => r.fromUserId);
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, fromIds));
  res.json(requests.map(r => {
    const u = users.find(u => u.id === r.fromUserId);
    return { requestId: r.id, fromUser: u ? toUserDto(u) : null };
  }).filter(r => r.fromUser));
});

router.patch("/friends/request/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { status } = req.body;
  if (!["accepted", "declined"].includes(status)) { res.status(400).json({ error: "Invalid status" }); return; }
  const [updated] = await db.update(friendRequestsTable).set({ status }).where(eq(friendRequestsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Request not found" }); return; }

  if (status === "accepted") {
    const u1 = Math.min(updated.fromUserId, updated.toUserId);
    const u2 = Math.max(updated.fromUserId, updated.toUserId);
    const [existing] = await db.select().from(matchesTable).where(
      and(eq(matchesTable.user1Id, u1), eq(matchesTable.user2Id, u2))
    );
    if (!existing) {
      await db.insert(matchesTable).values({ user1Id: u1, user2Id: u2 }).onConflictDoNothing();
    }
  }
  res.json({ success: true, status });
});

router.get("/friends/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId);
  const accepted = await db.select().from(friendRequestsTable).where(
    and(
      or(eq(friendRequestsTable.fromUserId, userId), eq(friendRequestsTable.toUserId, userId)),
      eq(friendRequestsTable.status, "accepted")
    )
  );
  if (accepted.length === 0) { res.json([]); return; }
  const friendIds = accepted.map(r => r.fromUserId === userId ? r.toUserId : r.fromUserId);
  const users = await db.select().from(usersTable).where(inArray(usersTable.id, friendIds));
  res.json(users.map(toUserDto));
});

export default router;

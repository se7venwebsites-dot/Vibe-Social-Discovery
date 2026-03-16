import { Router, type IRouter } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.post("/premium/activate", async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const [updated] = await db
    .update(usersTable)
    .set({ isPremium: true })
    .where(eq(usersTable.id, parseInt(userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({
    id: updated.id,
    name: updated.name,
    age: updated.age,
    bio: updated.bio,
    photoUrl: updated.photoUrl,
    isPremium: updated.isPremium,
    city: updated.city,
    interests: updated.interests ?? [],
  });
});

export default router;

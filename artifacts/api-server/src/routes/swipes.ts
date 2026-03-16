import { Router, type IRouter } from "express";

const router: IRouter = Router();

const swipeCounts = new Map<number, number>();

router.get("/swipes/count/:userId", (req, res) => {
  const userId = parseInt(req.params.userId);
  const count = swipeCounts.get(userId) ?? 0;
  res.json({ count, userId });
});

router.post("/swipes/reset/:userId", (req, res) => {
  const userId = parseInt(req.params.userId);
  swipeCounts.set(userId, 0);
  res.json({ count: 0, userId });
});

export function incrementSwipeCount(userId: number): number {
  const current = swipeCounts.get(userId) ?? 0;
  const next = current + 1;
  swipeCounts.set(userId, next);
  return next;
}

export default router;

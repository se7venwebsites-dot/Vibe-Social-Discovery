import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import likesRouter from "./likes";
import premiumRouter from "./premium";
import swipesRouter from "./swipes";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(likesRouter);
router.use(premiumRouter);
router.use(swipesRouter);

export default router;

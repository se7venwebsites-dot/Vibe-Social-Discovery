import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import likesRouter from "./likes";
import premiumRouter from "./premium";
import matchesRouter from "./matches";
import messagesRouter from "./messages";
import friendsRouter from "./friends";
import livesRouter from "./lives";

const router: IRouter = Router();

router.use(healthRouter);
router.use(usersRouter);
router.use(likesRouter);
router.use(premiumRouter);
router.use(matchesRouter);
router.use(messagesRouter);
router.use(friendsRouter);
router.use(livesRouter);

export default router;

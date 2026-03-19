import { Router, type IRouter } from "express";
import healthRouter from "./health";
import usersRouter from "./users";
import likesRouter from "./likes";
import premiumRouter from "./premium";
import matchesRouter from "./matches";
import messagesRouter from "./messages";
import friendsRouter from "./friends";
import livesRouter from "./lives";
import authRouter from "./auth";
import iceServersRouter from "./ice-servers";
import boostsRouter from "./boosts";
import storiesRouter from "./stories";
import reportsRouter from "./reports";

const router: IRouter = Router();

router.use(authRouter);
router.use(healthRouter);
router.use(usersRouter);
router.use(likesRouter);
router.use(premiumRouter);
router.use(matchesRouter);
router.use(messagesRouter);
router.use(friendsRouter);
router.use(livesRouter);
router.use(iceServersRouter);
router.use(boostsRouter);
router.use(storiesRouter);
router.use(reportsRouter);

export default router;

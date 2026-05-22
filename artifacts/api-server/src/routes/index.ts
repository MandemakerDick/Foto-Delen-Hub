import { Router, type IRouter } from "express";
import healthRouter from "./health";
import clubsRouter from "./clubs";
import themesRouter from "./themes";
import photographersRouter from "./photographers";
import photosRouter from "./photos";
import statsRouter from "./stats";
import commentsRouter from "./comments";
import authRouter from "./auth";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clubsRouter);
router.use(themesRouter);
router.use(photographersRouter);
router.use(photosRouter);
router.use(statsRouter);
router.use(commentsRouter);
router.use(authRouter);

export default router;

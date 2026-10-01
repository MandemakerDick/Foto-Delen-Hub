/**
 * Root API router — mounts all feature routers under /api.
 *
 * Routes are matched in registration order; within each router, more specific
 * paths (e.g. /photos/recent) must be registered before wildcard ones
 * (e.g. /photos/:id) to avoid shadowing.
 */
import { Router, type IRouter, type ErrorRequestHandler } from "express";
import { UploadUnavailableError } from "../lib/upload-staging";
import { ImageLifecycleError } from "../lib/image-lifecycle";
import healthRouter from "./health";
import clubsRouter from "./clubs";
import themesRouter from "./themes";
import photographersRouter from "./photographers";
import photosRouter from "./photos";
import statsRouter from "./stats";
import commentsRouter from "./comments";
import authRouter from "./auth";
import storageRouter from "./storage";
import adminsRouter from "./admins";
import invitesRouter from "./invites";
import reviewSessionsRouter from "./review-sessions";
import urlImportRouter from "./url-import";
import feedbackRouter from "./feedback";

const router: IRouter = Router();

router.use(healthRouter);
router.use(clubsRouter);
router.use(themesRouter);
router.use(photographersRouter);
router.use(photosRouter);
router.use(statsRouter);
router.use(commentsRouter);
router.use(authRouter);
router.use(storageRouter);
router.use(adminsRouter);
router.use(invitesRouter);
router.use(reviewSessionsRouter);
router.use(urlImportRouter);
router.use(feedbackRouter);

const uploadErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof ImageLifecycleError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  if (error instanceof UploadUnavailableError) {
    res.status(409).json({ error: error.message });
    return;
  }
  next(error);
};
router.use(uploadErrorHandler);

export default router;

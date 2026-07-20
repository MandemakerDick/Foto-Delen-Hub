import { Router, type IRouter, type Request, type Response } from "express";
import { Readable } from "stream";
import {
  RequestUploadUrlBody,
  RequestUploadUrlResponse,
} from "@workspace/api-zod";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { getAuth } from "@clerk/express";
import { db, photosTable, adminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getPhotographerIdForClerkUser } from "../lib/db-helpers";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/**
 * Resolves the access decision for a private object path.
 *
 * - If the path belongs to a photo (found in photos table):
 *     → allow only the owning photographer (via Clerk) or an admin.
 * - If the path is not a photo (e.g. an avatar):
 *     → allow any authenticated user (Clerk or session admin).
 * - Unauthenticated requests always get 401.
 *
 * Returns "ok" | "unauthenticated" | "forbidden".
 */
async function checkObjectAccess(
  req: Request,
  objectPath: string,
): Promise<"ok" | "unauthenticated" | "forbidden"> {
  // Identify the requester
  const { userId } = getAuth(req as any);
  const sessionAdminId = (req as any).session?.adminId as number | undefined;

  const isAuthenticated = !!userId || !!sessionAdminId;
  if (!isAuthenticated) return "unauthenticated";

  // Session admins always have full access
  if (sessionAdminId) return "ok";

  // For Clerk users: check if they are an admin
  if (userId) {
    const [adminRow] = await db
      .select({ id: adminsTable.id })
      .from(adminsTable)
      .where(eq(adminsTable.clerkUserId, userId))
      .limit(1);
    if (adminRow) return "ok";
  }

  // Look up the photo by its stored imageUrl to find the owner
  const [photo] = await db
    .select({ photographerId: photosTable.photographerId })
    .from(photosTable)
    .where(eq(photosTable.imageUrl, objectPath))
    .limit(1);

  if (!photo) {
    // Not a photo (e.g. avatar) — any authenticated user may view
    return "ok";
  }

  // It is a photo: only the owning photographer may access it
  if (!userId) return "forbidden";

  const myPhotographerId = await getPhotographerIdForClerkUser(userId);
  if (myPhotographerId !== null && myPhotographerId === photo.photographerId) {
    return "ok";
  }

  return "forbidden";
}

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 */
router.post("/storage/uploads/request-url", async (req: Request, res: Response) => {
  const parsed = RequestUploadUrlBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Missing or invalid required fields" });
    return;
  }

  try {
    const { name, size, contentType } = parsed.data;

    const uploadURL = await objectStorageService.getObjectEntityUploadURL();
    const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

    res.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * Always public — no auth or ACL checks.
 */
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response) => {
  try {
    const raw = req.params.filePath;
    const filePath = Array.isArray(raw) ? raw.join("/") : raw;
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    const response = await objectStorageService.downloadObject(file);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve public object" });
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve private object entities.
 * - Photos: only the owning photographer or an admin.
 * - Other objects (avatars etc.): any authenticated user.
 */
router.get("/storage/objects/*path", async (req: Request, res: Response) => {
  try {
    const raw = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
    const objectPath = `/objects/${wildcardPath}`;

    const access = await checkObjectAccess(req, objectPath);
    if (access === "unauthenticated") {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (access === "forbidden") {
      res.status(403).json({ error: "You do not have permission to access this file" });
      return;
    }

    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(objectFile);

    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    // Inline disposition — browser displays rather than prompts save
    res.setHeader("Content-Disposition", "inline");

    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log.warn({ err: error }, "Object not found");
      res.status(404).json({ error: "Object not found" });
      return;
    }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve object" });
  }
});

export default router;

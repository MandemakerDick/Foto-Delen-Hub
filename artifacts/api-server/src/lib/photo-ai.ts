import {
  db,
  photoAiAnalysesTable,
  photosTable,
} from "@workspace/db";
import { eq, inArray, isNull, or } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

const AI_MODEL = "gpt-5.4-mini";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_CONCURRENT_ANALYSES = 2;
const objectStorageService = new ObjectStorageService();

type AiAnalysis = {
  tags: string[];
  description: string;
};

type PhotoForAnalysis = {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string;
};

const scheduledPhotoIds = new Set<number>();
const analysisQueue: number[] = [];
let activeAnalyses = 0;

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length >= 2 && tag.length <= 50),
    ),
  ).slice(0, 12);
}

function parseAiAnalysis(content: string): AiAnalysis {
  const parsed = JSON.parse(content) as {
    tags?: unknown;
    description?: unknown;
  };
  const tags = normalizeTags(parsed.tags);
  const description =
    typeof parsed.description === "string"
      ? parsed.description.trim().slice(0, 600)
      : "";

  if (tags.length === 0 || description.length < 10) {
    throw new Error("AI response did not contain usable tags and a description");
  }

  return { tags, description };
}

async function responseToImageDataUrl(response: Response): Promise<string> {
  if (!response.ok) {
    throw new Error(`Image download failed with HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error(`Unsupported photo content type: ${contentType || "unknown"}`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (contentLength > MAX_IMAGE_BYTES) {
    throw new Error("Photo is too large for AI analysis");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) {
    throw new Error("Photo is empty or too large for AI analysis");
  }

  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

async function loadPhotoAsDataUrl(imageUrl: string): Promise<string> {
  const objectPrefix = "/api/storage/objects/";
  if (imageUrl.startsWith(objectPrefix)) {
    const objectPath = `/objects/${imageUrl.slice(objectPrefix.length)}`;
    const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
    return responseToImageDataUrl(await objectStorageService.downloadObject(objectFile));
  }

  const publicPrefix = "/api/storage/public-objects/";
  if (imageUrl.startsWith(publicPrefix)) {
    const filePath = decodeURIComponent(imageUrl.slice(publicPrefix.length));
    const objectFile = await objectStorageService.searchPublicObject(filePath);
    if (!objectFile) throw new Error("Public photo object was not found");
    return responseToImageDataUrl(await objectStorageService.downloadObject(objectFile));
  }

  const parsedUrl = new URL(imageUrl);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Unsupported photo URL");
  }

  const response = await fetch(parsedUrl, {
    headers: { "User-Agent": "PhotoMatrix AI photo indexer" },
    signal: AbortSignal.timeout(25_000),
  });
  return responseToImageDataUrl(response);
}

async function requestAiAnalysis(photo: PhotoForAnalysis): Promise<AiAnalysis> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Managed OpenAI integration is not configured");
  }

  const imageDataUrl = await loadPhotoAsDataUrl(photo.imageUrl);
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_completion_tokens: 350,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You index photographs for search. Return only valid JSON with a concise English description and 5-12 concise lowercase English tags. Describe only visible content. Do not identify people or infer sensitive traits such as ethnicity, religion, health, politics, or sexuality.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this photo for search. Existing title: ${photo.title}. Existing photographer statement: ${photo.description ?? "none"}. Return {"description":"one factual sentence","tags":["tag"]}.`,
            },
            {
              type: "image_url",
              image_url: { url: imageDataUrl, detail: "low" },
            },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `AI analysis failed with HTTP ${response.status}: ${body.slice(0, 200)}`,
    );
  }

  const completion = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = completion.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI analysis returned no content");
  return parseAiAnalysis(content);
}

async function analyzePhoto(photoId: number): Promise<void> {
  const [photo] = await db
    .select({
      id: photosTable.id,
      title: photosTable.title,
      description: photosTable.description,
      imageUrl: photosTable.imageUrl,
    })
    .from(photosTable)
    .where(eq(photosTable.id, photoId));

  if (!photo) {
    logger.warn({ photoId }, "Skipping AI analysis because the photo no longer exists");
    return;
  }

  await db
    .update(photoAiAnalysesTable)
    .set({ status: "processing", error: null })
    .where(eq(photoAiAnalysesTable.photoId, photoId));

  try {
    const analysis = await requestAiAnalysis(photo);
    await db
      .update(photoAiAnalysesTable)
      .set({
        tags: analysis.tags,
        description: analysis.description,
        status: "complete",
        error: null,
        model: AI_MODEL,
        processedAt: new Date(),
      })
      .where(eq(photoAiAnalysesTable.photoId, photoId));
    logger.info({ photoId, tagCount: analysis.tags.length }, "AI photo analysis completed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown AI analysis error";
    await db
      .update(photoAiAnalysesTable)
      .set({
        status: "failed",
        error: message.slice(0, 1000),
        model: AI_MODEL,
        processedAt: new Date(),
      })
      .where(eq(photoAiAnalysesTable.photoId, photoId));
    logger.warn({ err: error, photoId }, "AI photo analysis failed");
  }
}

function drainAnalysisQueue(): void {
  while (activeAnalyses < MAX_CONCURRENT_ANALYSES && analysisQueue.length > 0) {
    const photoId = analysisQueue.shift();
    if (photoId === undefined) return;

    activeAnalyses++;
    void analyzePhoto(photoId).finally(() => {
      activeAnalyses--;
      scheduledPhotoIds.delete(photoId);
      drainAnalysisQueue();
    });
  }
}

export async function enqueuePhotoAiAnalysis(photoId: number): Promise<void> {
  await db
    .insert(photoAiAnalysesTable)
    .values({ photoId, status: "pending" })
    .onConflictDoUpdate({
      target: photoAiAnalysesTable.photoId,
      set: { status: "pending", error: null },
    });

  if (scheduledPhotoIds.has(photoId)) return;
  scheduledPhotoIds.add(photoId);
  analysisQueue.push(photoId);
  drainAnalysisQueue();
}

export async function enqueuePhotosMissingAiAnalysis(limit = 25): Promise<number[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const photos = await db
    .select({ id: photosTable.id })
    .from(photosTable)
    .leftJoin(
      photoAiAnalysesTable,
      eq(photoAiAnalysesTable.photoId, photosTable.id),
    )
    .where(
      or(
        isNull(photoAiAnalysesTable.id),
        eq(photoAiAnalysesTable.status, "failed"),
      ),
    )
    .limit(safeLimit);

  for (const photo of photos) {
    await enqueuePhotoAiAnalysis(photo.id);
  }
  return photos.map((photo) => photo.id);
}

export async function resumePendingPhotoAiAnalyses(limit = 25): Promise<number[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const analyses = await db
    .select({ photoId: photoAiAnalysesTable.photoId })
    .from(photoAiAnalysesTable)
    .where(inArray(photoAiAnalysesTable.status, ["pending", "processing"]))
    .limit(safeLimit);

  for (const analysis of analyses) {
    await enqueuePhotoAiAnalysis(analysis.photoId);
  }
  return analyses.map((analysis) => analysis.photoId);
}
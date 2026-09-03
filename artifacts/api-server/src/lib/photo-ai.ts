import {
  db,
  photoAiAnalysesTable,
  photosTable,
  themesTable,
} from "@workspace/db";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { ObjectStorageService } from "./objectStorage";
import { logger } from "./logger";

const AI_MODEL = "gpt-5.4-mini";
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_CONCURRENT_ANALYSES = 2;
export const HIGH_THEME_CONFIDENCE = 0.85;
const SEARCH_EXPANSION_TTL_MS = 10 * 60 * 1000;
const SEARCH_STOP_WORDS = new Set([
  "and",
  "bij",
  "de",
  "een",
  "en",
  "het",
  "in",
  "met",
  "of",
  "on",
  "the",
  "van",
  "voor",
  "with",
]);
const objectStorageService = new ObjectStorageService();
const searchExpansionCache = new Map<
  string,
  { terms: string[]; expiresAt: number }
>();

type AiAnalysis = {
  tags: string[];
  description: string;
  themeSuggestion: ThemeSuggestion | null;
};

type ThemeCandidate = {
  id: number;
  name: string;
  description: string | null;
};

export type ThemeSuggestion = {
  themeId: number;
  confidence: number;
  reason: string;
};

type PhotoForAnalysis = {
  id: number;
  title: string;
  description: string | null;
  imageUrl: string;
  themeId: number | null;
  themeAutoApply?: boolean | null;
};

const scheduledPhotoIds = new Set<number>();
const analysisQueue: number[] = [];
let activeAnalyses = 0;

export function normalizeTags(value: unknown): string[] {
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

export function parseAiAnalysis(
  content: string,
  themes: ThemeCandidate[] = [],
): AiAnalysis {
  const parsed = JSON.parse(content) as {
    tags?: unknown;
    description?: unknown;
    themeId?: unknown;
    themeConfidence?: unknown;
    themeReason?: unknown;
  };
  const tags = normalizeTags(parsed.tags);
  const description =
    typeof parsed.description === "string"
      ? parsed.description.trim().slice(0, 600)
      : "";

  if (tags.length === 0 || description.length < 10) {
    throw new Error("AI response did not contain usable tags and a description");
  }

  const themeId = Number(parsed.themeId);
  const confidence = Number(parsed.themeConfidence);
  const candidate = themes.find((theme) => theme.id === themeId);
  const reason =
    typeof parsed.themeReason === "string"
      ? parsed.themeReason.trim().slice(0, 240)
      : "";
  const themeSuggestion =
    candidate &&
    Number.isInteger(themeId) &&
    Number.isFinite(confidence) &&
    confidence >= 0 &&
    confidence <= 1 &&
    reason.length > 0
      ? { themeId, confidence, reason }
      : null;

  return { tags, description, themeSuggestion };
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

async function requestAiAnalysis(
  photo: PhotoForAnalysis,
  themes: ThemeCandidate[],
): Promise<AiAnalysis> {
  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Managed OpenAI integration is not configured");
  }

  const imageDataUrl = await loadPhotoAsDataUrl(photo.imageUrl);
  const themeList = themes.map(({ id, name, description }) => ({
    id,
    name,
    description: description ?? "",
  }));
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
            "You index photographs for search and classify them into an existing theme when appropriate. Return only valid JSON with a concise English description, 5-12 concise lowercase English tags, and a theme suggestion. Describe only visible content. Do not identify people or infer sensitive traits such as ethnicity, religion, health, politics, or sexuality. Only use a theme ID from the supplied list; if none fits, use themeId null, themeConfidence 0, and themeReason ''. Confidence must be a number from 0 to 1 and should reflect how clearly the photo fits the selected theme.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this photo for search. Existing title: ${photo.title}. Existing photographer statement: ${photo.description ?? "none"}. Available themes: ${JSON.stringify(themeList)}. Return {"description":"one factual sentence","tags":["tag"],"themeId":123,"themeConfidence":0.91,"themeReason":"short factual reason"} or use null/0/'' when no theme is a good fit.`,
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
   return parseAiAnalysis(content, themes);
}

export async function expandPhotoSearchQuery(query: string): Promise<string[]> {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];

  const cached = searchExpansionCache.get(normalizedQuery);
  if (cached && cached.expiresAt > Date.now()) return cached.terms;

  const baseUrl = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL?.replace(/\/$/, "");
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error("Managed OpenAI integration is not configured");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_completion_tokens: 250,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Expand photo-search queries for bilingual English/Dutch retrieval. Return only JSON as {\"terms\":[...]}. Include the original concept plus concise English and Dutch translations, synonyms, and directly related visible concepts. Return 6-14 terms, each under 60 characters. Do not add unrelated broad concepts.",
        },
        {
          role: "user",
          content: normalizedQuery,
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Search expansion failed with HTTP ${response.status}: ${body.slice(0, 200)}`,
    );
  }

  const result = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = result.choices?.[0]?.message?.content;
  if (!content) throw new Error("Search expansion returned no content");

  const parsed = JSON.parse(content) as { terms?: unknown };
  const generatedTerms = Array.isArray(parsed.terms) ? parsed.terms : [];
  const rawTerms = [
    normalizedQuery,
    ...generatedTerms
      .filter((term): term is string => typeof term === "string")
      .map((term) => term.trim().toLowerCase())
      .filter((term) => term.length >= 2 && term.length <= 60),
  ];
  const individualWords = rawTerms.flatMap((term) =>
    term
      .split(/[^\p{L}\p{N}]+/u)
      .filter((word) => word.length >= 3 && !SEARCH_STOP_WORDS.has(word)),
  );
  const terms = Array.from(
    new Set([...rawTerms, ...individualWords]),
  ).slice(0, 20);

  if (terms.length === 0) {
    throw new Error("Search expansion returned no usable terms");
  }

  searchExpansionCache.set(normalizedQuery, {
    terms,
    expiresAt: Date.now() + SEARCH_EXPANSION_TTL_MS,
  });
  return terms;
}

async function analyzePhoto(photoId: number): Promise<void> {
  const [photo] = await db
    .select({
      id: photosTable.id,
      title: photosTable.title,
      description: photosTable.description,
      imageUrl: photosTable.imageUrl,
      themeId: photosTable.themeId,
      themeAutoApply: photoAiAnalysesTable.themeAutoApply,
    })
    .from(photosTable)
    .leftJoin(
      photoAiAnalysesTable,
      eq(photoAiAnalysesTable.photoId, photosTable.id),
    )
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
    const themes = await db
      .select({
        id: themesTable.id,
        name: themesTable.name,
        description: themesTable.description,
      })
      .from(themesTable);
    const analysis = await requestAiAnalysis(photo, themes);
    const themeSuggestion = analysis.themeSuggestion;
    const shouldAutoApplyTheme =
      photo.themeId == null &&
      photo.themeAutoApply !== false &&
      themeSuggestion !== null &&
      themeSuggestion.confidence >= HIGH_THEME_CONFIDENCE;

    let didAutoApplyTheme = false;
    if (shouldAutoApplyTheme && themeSuggestion) {
      const updatedPhotos = await db
        .update(photosTable)
        .set({ themeId: themeSuggestion.themeId })
        .where(
          and(
            eq(photosTable.id, photoId),
            isNull(photosTable.themeId),
          ),
        )
        .returning({ id: photosTable.id });
      didAutoApplyTheme = updatedPhotos.length > 0;
    }

    await db
      .update(photoAiAnalysesTable)
      .set({
        tags: analysis.tags,
        description: analysis.description,
        status: "complete",
        error: null,
        model: AI_MODEL,
        processedAt: new Date(),
        themeSuggestionId: themeSuggestion?.themeId ?? null,
        themeSuggestionConfidence: themeSuggestion?.confidence ?? null,
        themeSuggestionReason: themeSuggestion?.reason ?? null,
        themeSuggestionStatus: didAutoApplyTheme
          ? "auto_applied"
          : themeSuggestion
            ? "pending"
            : null,
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

export async function enqueuePhotoAiAnalysis(
  photoId: number,
  options: { autoApplyTheme?: boolean } = {},
): Promise<void> {
  const autoApplyTheme = options.autoApplyTheme ?? true;
  await db
    .insert(photoAiAnalysesTable)
    .values({ photoId, status: "pending", themeAutoApply: autoApplyTheme })
    .onConflictDoUpdate({
      target: photoAiAnalysesTable.photoId,
      set: {
        status: "pending",
        error: null,
        themeAutoApply: autoApplyTheme,
        themeSuggestionStatus: null,
      },
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
    await enqueuePhotoAiAnalysis(photo.id, { autoApplyTheme: false });
  }
  return photos.map((photo) => photo.id);
}

export async function resumePendingPhotoAiAnalyses(limit = 25): Promise<number[]> {
  const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
  const analyses = await db
    .select({
      photoId: photoAiAnalysesTable.photoId,
      themeAutoApply: photoAiAnalysesTable.themeAutoApply,
    })
    .from(photoAiAnalysesTable)
    .where(inArray(photoAiAnalysesTable.status, ["pending", "processing"]))
    .limit(safeLimit);

  for (const analysis of analyses) {
    await enqueuePhotoAiAnalysis(analysis.photoId, {
      autoApplyTheme: analysis.themeAutoApply,
    });
  }
  return analyses.map((analysis) => analysis.photoId);
}
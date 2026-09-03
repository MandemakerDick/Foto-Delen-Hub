import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";

const state = vi.hoisted(() => ({
  selectRows: [] as Record<string, unknown>[],
  inserts: [] as unknown[],
  updates: [] as Record<string, unknown>[],
}));

const dbTables = {
  photoAiAnalysesTable: {
    id: "ai.id",
    photoId: "ai.photoId",
    status: "ai.status",
    themeAutoApply: "ai.themeAutoApply",
    themeSuggestionStatus: "ai.themeSuggestionStatus",
  },
  photosTable: {
    id: "photo.id",
    title: "photo.title",
    description: "photo.description",
    imageUrl: "photo.imageUrl",
    themeId: "photo.themeId",
  },
  themesTable: {
    id: "theme.id",
    name: "theme.name",
    description: "theme.description",
  },
};

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => {
      const query = {
        from: vi.fn(() => query),
        leftJoin: vi.fn(() => query),
        where: vi.fn(() => query),
        limit: vi.fn(() => query),
        then: (
          resolve: (value: Record<string, unknown>[]) => unknown,
          reject: (reason: unknown) => unknown,
        ) => Promise.resolve(state.selectRows).then(resolve, reject),
      };
      return query;
    }),
    insert: vi.fn(() => ({
      values: vi.fn((values: unknown) => {
        state.inserts.push(values);
        return {
          onConflictDoUpdate: vi.fn().mockResolvedValue([]),
        };
      }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: Record<string, unknown>) => {
        state.updates.push(values);
        return {
          where: vi.fn().mockResolvedValue([]),
        };
      }),
    })),
  },
  ...dbTables,
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
  and: vi.fn((...conditions: unknown[]) => conditions),
  inArray: vi.fn((left: unknown, right: unknown) => ({ left, right })),
  isNull: vi.fn((value: unknown) => ({ value })),
  or: vi.fn((...conditions: unknown[]) => conditions),
}));

const {
  enqueuePhotoAiAnalysis,
  expandPhotoSearchQuery,
  normalizeTags,
  parseAiAnalysis,
  resumePendingPhotoAiAnalyses,
} = await import("./lib/photo-ai");

function imageResponse() {
  return new Response(new Uint8Array([1, 2, 3]), {
    status: 200,
    headers: { "content-type": "image/jpeg", "content-length": "3" },
  });
}

function aiResponse(content: string) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

function photoRow(id = 1) {
  return {
    id,
    title: "Test photo",
    description: null,
    imageUrl: "https://example.com/photo.jpg",
  };
}

async function waitForUpdate(status: string, timeoutMs = 2_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (state.updates.some((update) => update.status === status)) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`Timed out waiting for ${status} update`);
}

beforeEach(() => {
  state.selectRows = [photoRow()];
  state.inserts.length = 0;
  state.updates.length = 0;
  vi.restoreAllMocks();
  vi.stubEnv("AI_INTEGRATIONS_OPENAI_BASE_URL", "https://managed-openai.test/v1");
  vi.stubEnv("AI_INTEGRATIONS_OPENAI_API_KEY", "test-key");
});

describe("AI response validation", () => {
  it("normalizes, deduplicates, and limits generated tags", () => {
    expect(normalizeTags([" Mountains ", "mountains", "Sunrise", "x", 42])).toEqual([
      "mountains",
      "sunrise",
    ]);
  });

  it("rejects malformed or unusable model responses", () => {
    expect(() => parseAiAnalysis("not json")).toThrow();
    expect(() => parseAiAnalysis(JSON.stringify({ tags: [], description: "" }))).toThrow(
      "usable tags",
    );
  });

  it("accepts only confidence-scored suggestions from the supplied theme library", () => {
    const themes = [
      { id: 7, name: "Architecture", description: "Buildings and structures" },
    ];
    const valid = parseAiAnalysis(
      JSON.stringify({
        tags: ["building", "geometry"],
        description: "A geometric building facade fills the frame.",
        themeId: 7,
        themeConfidence: 0.91,
        themeReason: "The image prominently features architectural geometry.",
      }),
      themes,
    );
    const invented = parseAiAnalysis(
      JSON.stringify({
        tags: ["building", "geometry"],
        description: "A geometric building facade fills the frame.",
        themeId: 999,
        themeConfidence: 0.99,
        themeReason: "Invented theme",
      }),
      themes,
    );

    expect(valid.themeSuggestion).toEqual({
      themeId: 7,
      confidence: 0.91,
      reason: "The image prominently features architectural geometry.",
    });
    expect(invented.themeSuggestion).toBeNull();
  });
});

describe("photo AI queue", () => {
  it("downloads a photo, stores validated tags, and marks the analysis complete", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(imageResponse())
      .mockResolvedValueOnce(
        aiResponse(
          JSON.stringify({
            tags: [" Mountains ", "mountains", "Sunrise"],
            description: "Snowy mountains glow beneath a warm sunrise.",
          }),
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    await enqueuePhotoAiAnalysis(1);
    await waitForUpdate("complete");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const aiRequest = fetchMock.mock.calls[1]?.[1] as RequestInit;
    const requestBody = JSON.parse(String(aiRequest.body));
    expect(requestBody.model).toBe("gpt-5.4-mini");
    expect(requestBody.messages[1].content[1].image_url.url).toMatch(
      /^data:image\/jpeg;base64,/,
    );
    expect(state.updates).toContainEqual(
      expect.objectContaining({
        status: "complete",
        tags: ["mountains", "sunrise"],
        description: "Snowy mountains glow beneath a warm sunrise.",
      }),
    );
  });

  it("expands a Dutch query into English and Dutch photo-search concepts", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      aiResponse(
        JSON.stringify({
          terms: ["vliegtuig", "aircraft", "airplane", "jet", "luchtvaart"],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const terms = await expandPhotoSearchQuery("Vliegtuig");

    expect(terms).toEqual([
      "vliegtuig",
      "aircraft",
      "airplane",
      "jet",
      "luchtvaart",
    ]);
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(String(request.body));
    expect(body.model).toBe("gpt-5.4-mini");
    expect(body.messages[1].content).toBe("vliegtuig");
  });

  it("marks a failed analysis when the model response is unusable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(imageResponse()).mockResolvedValueOnce(
        aiResponse(JSON.stringify({ tags: [], description: "" })),
      ),
    );

    await enqueuePhotoAiAnalysis(2);
    await waitForUpdate("failed");

    expect(state.updates).toContainEqual(
      expect.objectContaining({
        status: "failed",
        error: "AI response did not contain usable tags and a description",
      }),
    );
  });

  it("never runs more than two analyses concurrently", async () => {
    let activeRequests = 0;
    let maxActiveRequests = 0;
    const fetchMock = vi.fn(async (_input: Request | string | URL, init?: RequestInit) => {
      if (init?.method !== "POST") return imageResponse();
      activeRequests++;
      maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
      await new Promise((resolve) => setTimeout(resolve, 30));
      activeRequests--;
      return aiResponse(
        JSON.stringify({
          tags: ["test", "photo"],
          description: "A test photo used for queue verification.",
        }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([
      enqueuePhotoAiAnalysis(10),
      enqueuePhotoAiAnalysis(11),
      enqueuePhotoAiAnalysis(12),
    ]);
    const deadline = Date.now() + 2_000;
    while (state.updates.filter((update) => update.status === "complete").length < 3) {
      if (Date.now() > deadline) throw new Error("Timed out waiting for queued analyses");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(maxActiveRequests).toBe(2);
  });

  it("resumes pending work after a restart without requiring a new upload", async () => {
    state.selectRows = [{ ...photoRow(40), photoId: 40, status: "pending" }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(imageResponse()).mockResolvedValueOnce(
        aiResponse(
          JSON.stringify({
            tags: ["restart", "recovery"],
            description: "A photo analysis resumed after a server restart.",
          }),
        ),
      ),
    );

    await expect(resumePendingPhotoAiAnalyses()).resolves.toEqual([40]);
    await waitForUpdate("complete");

    expect(state.inserts).toContainEqual(
      expect.objectContaining({ photoId: 40, status: "pending" }),
    );
  });
});

describe("photo route wiring", () => {
  it("queues AI indexing after direct uploads and URL imports", async () => {
    const [photoRoutes, importRoutes] = await Promise.all([
      readFile(new URL("./routes/photos.ts", import.meta.url), "utf8"),
      readFile(new URL("./routes/url-import.ts", import.meta.url), "utf8"),
    ]);

    expect(photoRoutes).toMatch(
      /insert\(photosTable\)[\s\S]*enqueuePhotoAiAnalysis\(photo\.id,\s*\{\s*autoApplyTheme:\s*true\s*\}\)/,
    );
    expect(importRoutes).toMatch(
      /insert\(photosTable\)[\s\S]*enqueuePhotoAiAnalysis\(photo\.id,\s*\{\s*autoApplyTheme:\s*true\s*\}\)/,
    );
  });

  it("includes AI descriptions and tags in the public photo search condition", async () => {
    const photoRoutes = await readFile(
      new URL("./routes/photos.ts", import.meta.url),
      "utf8",
    );

    expect(photoRoutes).toContain("ilike(photoAiAnalysesTable.description, pattern)");
    expect(photoRoutes).toContain("photoAiAnalysesTable.tags}::text ILIKE");
    expect(photoRoutes).toContain("expandPhotoSearchQuery(search)");
    expect(photoRoutes).toContain("expandedTermConditions");
    expect(photoRoutes).toContain("relevanceScore");
  });
});
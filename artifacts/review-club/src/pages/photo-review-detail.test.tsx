// @vitest-environment jsdom
/**
 * PhotoReviewDetail page — direct-upload photo regression guard
 *
 * Confirms that the photo detail / review page handles a direct-upload
 * session photo (gallery-less: clubId = null, themeId = null) without
 * crashing, without exposing raw translation keys, and with the star-rating
 * and comment form present for eligible reviewers.
 */

import { describe, it, expect, beforeAll, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { Router } from "wouter";
import { PhotoReviewDetail } from "./photo-review-detail";
import en from "@/i18n/en.json";
import nl from "@/i18n/nl.json";

// ---------------------------------------------------------------------------
// Stub hooks that reach outside the component under test
// ---------------------------------------------------------------------------

vi.mock("@workspace/api-client-react", () => ({
  useGetReviewSession: vi.fn(),
  useListSessionPhotos: vi.fn(),
  useListPhotoReviews: vi.fn(),
  useListSessionReviewers: vi.fn(),
  useGetAdminStatus: vi.fn(),
  useCreatePhotoReview: vi.fn(),
  useUpdatePhotoReview: vi.fn(),
  getListPhotoReviewsQueryKey: vi.fn(() => ["photoReviews"]),
  getListSessionPhotosQueryKey: vi.fn(() => ["sessionPhotos"]),
  getListSessionReviewersQueryKey: vi.fn(() => ["reviewers"]),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useParams: vi.fn(() => ({ id: "1", sessionPhotoId: "99" })),
  };
});

vi.mock("@/hooks/use-date-locale", () => ({
  useDateLocale: () => undefined,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("lucide-react", () => ({
  ArrowLeft: () => null,
  Send: () => null,
}));

// Render StarRating as a labelled element so tests can assert its presence
vi.mock("@/components/star-rating", () => ({
  StarRating: ({ readonly, rating }: { readonly?: boolean; rating?: number }) => (
    <div
      data-testid={readonly ? "star-rating-readonly" : "star-rating-interactive"}
      data-rating={rating ?? 0}
    />
  ),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

// ---------------------------------------------------------------------------
// Shared i18next instance
// ---------------------------------------------------------------------------
const i18n = i18next.createInstance();

beforeAll(async () => {
  await i18n.use(initReactI18next).init({
    lng: "en",
    fallbackLng: false,
    resources: {
      en: { translation: en },
      nl: { translation: nl },
    },
    interpolation: { escapeValue: false },
  });
});

afterEach(cleanup);

// ---------------------------------------------------------------------------
// Import mocked modules so we can set return values per test
// ---------------------------------------------------------------------------
import {
  useGetReviewSession,
  useListSessionPhotos,
  useListPhotoReviews,
  useListSessionReviewers,
  useGetAdminStatus,
  useCreatePhotoReview,
  useUpdatePhotoReview,
  type SessionPhoto,
  type PhotoReview,
} from "@workspace/api-client-react";

const mockedUseGetReviewSession = vi.mocked(useGetReviewSession);
const mockedUseListSessionPhotos = vi.mocked(useListSessionPhotos);
const mockedUseListPhotoReviews = vi.mocked(useListPhotoReviews);
const mockedUseListSessionReviewers = vi.mocked(useListSessionReviewers);
const mockedUseGetAdminStatus = vi.mocked(useGetAdminStatus);
const mockedUseCreatePhotoReview = vi.mocked(useCreatePhotoReview);
const mockedUseUpdatePhotoReview = vi.mocked(useUpdatePhotoReview);

// ---------------------------------------------------------------------------
// Shared fake data helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    clubId: null,       // direct-upload sessions may have no club
    title: "Open Upload Session",
    status: "reviewing",
    createdAt: "2026-01-01T00:00:00Z",
    closedAt: null,
    photoCount: 1,
    submissionDeadline: null,
    scheduledFor: null,
    description: null,
    ...overrides,
  };
}

/**
 * A direct-upload session photo: no gallery, clubId = null, themeId = null.
 * `id` must equal the mocked sessionPhotoId param (99).
 */
function makeDirectUploadPhoto(overrides: Partial<SessionPhoto> = {}): SessionPhoto {
  return {
    id: 99,
    sessionId: 1,
    photoId: 200,
    photographerId: 42,
    sortOrder: 1,
    submittedAt: "2026-01-02T00:00:00Z",
    photoTitle: "Sunset over the dunes",
    photoImageUrl: "https://example.com/uploads/sunset.jpg",
    photographerName: "Jane Doe",
    reviewCount: 2,
    averageRating: 4.5,
    ...overrides,
  };
}

function setupStaticMocks() {
  mockedUseGetAdminStatus.mockReturnValue({
    data: { isAdmin: false, photographerId: null },
    isLoading: false,
  } as ReturnType<typeof useGetAdminStatus>);

  mockedUseListSessionReviewers.mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useListSessionReviewers>);

  mockedUseListPhotoReviews.mockReturnValue({
    data: [],
    isLoading: false,
  } as ReturnType<typeof useListPhotoReviews>);

  mockedUseCreatePhotoReview.mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useCreatePhotoReview>);

  mockedUseUpdatePhotoReview.mockReturnValue({
    mutateAsync: vi.fn(),
  } as unknown as ReturnType<typeof useUpdatePhotoReview>);
}

function renderPhotoReviewDetail() {
  return render(
    <I18nextProvider i18n={i18n}>
      <Router>
        <PhotoReviewDetail />
      </Router>
    </I18nextProvider>
  );
}

// ---------------------------------------------------------------------------
// Helper: render with a direct-upload photo loaded
// ---------------------------------------------------------------------------
function renderWithDirectUploadPhoto(
  photoOverrides: Partial<SessionPhoto> = {},
  sessionOverrides: Record<string, unknown> = {}
) {
  setupStaticMocks();

  mockedUseGetReviewSession.mockReturnValue({
    data: makeSession(sessionOverrides),
    isLoading: false,
  } as ReturnType<typeof useGetReviewSession>);

  mockedUseListSessionPhotos.mockReturnValue({
    data: [makeDirectUploadPhoto(photoOverrides)],
    isLoading: false,
  } as ReturnType<typeof useListSessionPhotos>);

  return renderPhotoReviewDetail();
}

// ---------------------------------------------------------------------------
// Helper: render as a reviewer (admin) so the form is visible
// ---------------------------------------------------------------------------
function renderWithDirectUploadPhotoAsAdmin(photoOverrides: Partial<SessionPhoto> = {}) {
  setupStaticMocks();

  mockedUseGetAdminStatus.mockReturnValue({
    data: { isAdmin: true, photographerId: 42 },
    isLoading: false,
  } as ReturnType<typeof useGetAdminStatus>);

  mockedUseGetReviewSession.mockReturnValue({
    data: makeSession({ status: "reviewing" }),
    isLoading: false,
  } as ReturnType<typeof useGetReviewSession>);

  mockedUseListSessionPhotos.mockReturnValue({
    data: [makeDirectUploadPhoto(photoOverrides)],
    isLoading: false,
  } as ReturnType<typeof useListSessionPhotos>);

  return renderPhotoReviewDetail();
}

// ---------------------------------------------------------------------------
// Tests — title and image
// ---------------------------------------------------------------------------

describe("PhotoReviewDetail — direct-upload photo title and image", () => {
  it("renders the photo title for a direct-upload photo", () => {
    renderWithDirectUploadPhoto();
    expect(screen.getByText("Sunset over the dunes")).toBeInTheDocument();
  });

  it("renders an <img> with the correct src for a direct-upload photo", () => {
    renderWithDirectUploadPhoto();
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/uploads/sunset.jpg");
  });

  it("uses the photo title as the img alt attribute", () => {
    renderWithDirectUploadPhoto();
    expect(screen.getByAltText("Sunset over the dunes")).toBeInTheDocument();
  });

  it("falls back to the untitled label when photoTitle is absent", () => {
    renderWithDirectUploadPhoto({ photoTitle: undefined });
    // en.json common.untitled = "Untitled"
    expect(screen.getAllByText(en.common.untitled).length).toBeGreaterThan(0);
  });

  it("shows a skeleton placeholder when photoImageUrl is absent", () => {
    const { container } = renderWithDirectUploadPhoto({ photoImageUrl: undefined });
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByTestId("skeleton")).toBeInTheDocument();
  });

  it("still shows the title when photoImageUrl is absent", () => {
    renderWithDirectUploadPhoto({ photoImageUrl: undefined });
    expect(screen.getByText("Sunset over the dunes")).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — photographer attribution
// ---------------------------------------------------------------------------

describe("PhotoReviewDetail — photographer attribution", () => {
  it("shows the photographer name", () => {
    renderWithDirectUploadPhoto();
    expect(screen.getByText(/Jane Doe/i)).toBeInTheDocument();
  });

  it("does not render 'null' literally when photographerName is null", () => {
    renderWithDirectUploadPhoto({ photographerName: null });
    expect(screen.queryByText(/\bnull\b/i)).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — no raw translation keys
// ---------------------------------------------------------------------------

describe("PhotoReviewDetail — no raw translation keys exposed", () => {
  it("does not render any dot-separated i18n keys (e.g. 'review.noReviews')", () => {
    const { container } = renderWithDirectUploadPhoto();
    // Raw i18n keys look like "namespace.camelCase"; reject text nodes that match
    const text = container.textContent ?? "";
    const rawKeyPattern = /\b(?:review|common|session)\.[a-zA-Z]+\b/;
    expect(rawKeyPattern.test(text)).toBe(false);
  });

  it("renders translated reviewsTitle instead of a raw key", () => {
    renderWithDirectUploadPhoto();
    // en.json review.reviewsTitle = "Reviews"
    expect(screen.getByText(en.review.reviewsTitle)).toBeInTheDocument();
  });

  it("renders translated noReviews label instead of a raw key when there are no reviews", () => {
    renderWithDirectUploadPhoto();
    // en.json review.noReviews = "No reviews yet."
    expect(screen.getByText(en.review.noReviews)).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Tests — star rating presence
// ---------------------------------------------------------------------------

describe("PhotoReviewDetail — star rating", () => {
  it("renders the read-only star rating for the average score", () => {
    renderWithDirectUploadPhoto();
    // At minimum the readonly summary rating is always rendered
    expect(screen.getByTestId("star-rating-readonly")).toBeInTheDocument();
  });

  it("reflects the average rating from the session photo", () => {
    renderWithDirectUploadPhoto({ averageRating: 4.5 });
    const readonlyRating = screen.getByTestId("star-rating-readonly");
    expect(readonlyRating).toHaveAttribute("data-rating", "4.5");
  });
});

// ---------------------------------------------------------------------------
// Tests — comment form presence (admin / reviewer in 'reviewing' status)
// ---------------------------------------------------------------------------

describe("PhotoReviewDetail — comment form presence", () => {
  it("shows the interactive star rating widget for an admin in reviewing status", () => {
    renderWithDirectUploadPhotoAsAdmin();
    expect(screen.getByTestId("star-rating-interactive")).toBeInTheDocument();
  });

  it("shows the feedback textarea for an admin in reviewing status", () => {
    renderWithDirectUploadPhotoAsAdmin();
    expect(
      screen.getByPlaceholderText(en.review.feedbackPlaceholder)
    ).toBeInTheDocument();
  });

  it("shows the submit-review button for an admin in reviewing status", () => {
    renderWithDirectUploadPhotoAsAdmin();
    expect(
      screen.getByRole("button", { name: new RegExp(en.review.submitBtn, "i") })
    ).toBeInTheDocument();
  });

  it("hides the comment form when the session status is not 'reviewing'", () => {
    renderWithDirectUploadPhoto({}, { status: "open" });
    expect(
      screen.queryByPlaceholderText(en.review.feedbackPlaceholder)
    ).not.toBeInTheDocument();
  });

  it("hides the comment form for a non-reviewer, non-admin member", () => {
    // setupStaticMocks sets isAdmin=false and no reviewers
    renderWithDirectUploadPhoto({}, { status: "reviewing" });
    expect(
      screen.queryByPlaceholderText(en.review.feedbackPlaceholder)
    ).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Helpers — review list
// ---------------------------------------------------------------------------

function makeReview(overrides: Partial<PhotoReview> = {}): PhotoReview {
  return {
    id: 1,
    sessionPhotoId: 99,
    reviewerPhotographerId: 10,
    reviewerName: "Alice Smith",
    reviewerAvatarUrl: null,
    rating: 4,
    comment: "Great composition!",
    createdAt: "2026-03-15T10:00:00Z",
    ...overrides,
  };
}

/**
 * Render the page with one or more seeded reviews visible in the sidebar.
 */
function renderWithReviews(reviewOverrides: Array<Partial<PhotoReview>> = [{}]) {
  setupStaticMocks();

  mockedUseGetReviewSession.mockReturnValue({
    data: makeSession({ status: "reviewing" }),
    isLoading: false,
  } as ReturnType<typeof useGetReviewSession>);

  mockedUseListSessionPhotos.mockReturnValue({
    data: [makeDirectUploadPhoto({ reviewCount: reviewOverrides.length })],
    isLoading: false,
  } as ReturnType<typeof useListSessionPhotos>);

  mockedUseListPhotoReviews.mockReturnValue({
    data: reviewOverrides.map((o, idx) =>
      makeReview({ id: idx + 1, ...o })
    ),
    isLoading: false,
  } as ReturnType<typeof useListPhotoReviews>);

  return renderPhotoReviewDetail();
}

// ---------------------------------------------------------------------------
// Tests — review list rendering
// ---------------------------------------------------------------------------

describe("PhotoReviewDetail — review list", () => {
  it("renders the reviewer name for each seeded review", () => {
    renderWithReviews([{ reviewerName: "Alice Smith" }, { reviewerName: "Bob Jones", id: 2, rating: 3 }]);
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    expect(screen.getByText("Bob Jones")).toBeInTheDocument();
  });

  it("renders a formatted date (not a raw ISO string) for each review", () => {
    renderWithReviews([{ createdAt: "2026-03-15T10:00:00Z" }]);
    // The component formats with date-fns "PP" (e.g. "Mar 15, 2026").
    // We verify the raw ISO string is not shown and something date-like is present.
    const { container } = renderWithReviews([{ createdAt: "2026-03-15T10:00:00Z" }]);
    const text = container.textContent ?? "";
    // Raw ISO substring must not appear as a visible text node
    expect(text).not.toContain("2026-03-15T10:00:00Z");
    // A human-readable year should be present
    expect(text).toMatch(/2026/);
  });

  it("renders one readonly star-rating widget per review", () => {
    renderWithReviews([{ rating: 5 }, { rating: 2, id: 2 }]);
    // The component renders one readonly StarRating for the average score header
    // plus one per review entry — so total should be 1 + reviewCount.
    const ratings = screen.getAllByTestId("star-rating-readonly");
    // At least the per-review ones (2) plus the summary one (1) = 3
    expect(ratings.length).toBeGreaterThanOrEqual(3);
  });

  it("reflects the correct rating value on each review's star widget", () => {
    renderWithReviews([{ rating: 5 }, { rating: 2, id: 2 }]);
    const ratings = screen.getAllByTestId("star-rating-readonly");
    // Collect data-rating values; the per-review ratings (5 and 2) must both be present
    const ratingValues = Array.from(ratings).map(el => el.getAttribute("data-rating"));
    expect(ratingValues).toContain("5");
    expect(ratingValues).toContain("2");
  });

  it("renders the review comment text", () => {
    renderWithReviews([{ comment: "Excellent lighting and depth." }]);
    expect(screen.getByText(/"Excellent lighting and depth\."/i)).toBeInTheDocument();
  });

  it("does not render raw i18n keys when reviews are present", () => {
    const { container } = renderWithReviews([{ reviewerName: "Carol White", rating: 3 }]);
    const text = container.textContent ?? "";
    const rawKeyPattern = /\b(?:review|common|session)\.[a-zA-Z]+\b/;
    expect(rawKeyPattern.test(text)).toBe(false);
  });

  it("does not render the 'no reviews' placeholder when reviews are present", () => {
    renderWithReviews([{ reviewerName: "Dave Brown" }]);
    expect(screen.queryByText(en.review.noReviews)).not.toBeInTheDocument();
  });

  it("shows skeleton placeholders while reviews are loading", () => {
    setupStaticMocks();

    mockedUseGetReviewSession.mockReturnValue({
      data: makeSession(),
      isLoading: false,
    } as ReturnType<typeof useGetReviewSession>);

    mockedUseListSessionPhotos.mockReturnValue({
      data: [makeDirectUploadPhoto()],
      isLoading: false,
    } as ReturnType<typeof useListSessionPhotos>);

    mockedUseListPhotoReviews.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useListPhotoReviews>);

    renderPhotoReviewDetail();
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("handles a review with a null comment gracefully (no crash)", () => {
    expect(() =>
      renderWithReviews([{ comment: null }])
    ).not.toThrow();
  });

  it("handles a review with a null reviewerName gracefully without showing 'null'", () => {
    renderWithReviews([{ reviewerName: null }]);
    expect(screen.queryByText(/\bnull\b/i)).not.toBeInTheDocument();
  });
});

# PhotoMatrix

A photography club platform where members share their work, organised by clubs and themes.

---

## Application

### 📷 PhotoMatrix

A public-facing portfolio platform where photographers can share their work, organised by clubs and themes. Members sign in with Clerk, manage their own photos and profile, and can propose new themes.

**Key features:**
- Photo gallery with theme and club filters
- Photographer profiles with club memberships (many-to-many)
- Preferred themes per photographer (many-to-many)
- Theme-based collections with contributor counts
- Photo upload with URL import support
- Likes and comments on photos
- Members can follow photographers and view liked photos
- Theme proposal workflow (photographer proposes → admin approves or rejects → email notification sent)
- Photographers can withdraw their own pending proposals
- Invite-token based registration with pre-linked photographer profiles
- Club-based review sessions with photo submissions and peer reviews
- Dutch / English i18n
- Admin panel for managing photographers, clubs, themes, and invites
- Installable as a PWA (Add to Home Screen on Android and iOS)

---

## Screenshots

### PhotoMatrix — Home
![PhotoMatrix home](docs/screenshots/screenshot-photoclub-home.jpg)

### PhotoMatrix — Photographers
![Photographers overview](docs/screenshots/screenshot-photoclub-photographers.jpg)

### PhotoMatrix — Themes
![Themes overview](docs/screenshots/screenshot-photoclub-themes.jpg)

---

## Architecture

```
PhotoMatrix-monorepo/
├── artifacts/
│   ├── photoclub/        # PhotoMatrix — React + Vite frontend
│   ├── api-server/       # Express API (REST)
│   └── tech-deck/        # Technical slide deck (internal reference)
└── lib/
    ├── db/               # Drizzle ORM schema + PostgreSQL client
    ├── api-spec/         # OpenAPI 3.1 specification (openapi.yaml)
    ├── api-zod/          # Zod schemas generated from OpenAPI spec
    └── api-client-react/ # React Query hooks generated from OpenAPI spec
```

**Stack:**
- **Frontend:** React 19, Vite, Tailwind CSS, shadcn/ui, TanStack Query
- **Backend:** Node.js, Express, Drizzle ORM
- **Database:** PostgreSQL (Replit managed)
- **Auth:** Clerk (photographers) + session-based (admins)
- **Storage:** Replit Object Storage (photo uploads and URL imports)
- **Email:** Resend (proposal approval/rejection and photographer invitation emails)
- **Package manager:** pnpm workspaces

---

## Database Schema

### `photographer`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `name` | text | |
| `bio` | text | |
| `email` | text | Admin-maintained contact email, used to pre-fill invitations |
| `avatar_url` | text | |
| `clerk_user_id` | text | Links to Clerk account |
| `created_at` | timestamp | |

### `photographer_club` *(junction)*
| Column | Type | Notes |
|---|---|---|
| `photographer_id` | integer PK | FK → photographer |
| `club_id` | integer PK | FK → club |
| `joined_at` | timestamp | When the DB record was created |
| `member_since` | integer | Year the photographer joined this club (e.g. 2019) |

> A photographer can belong to multiple clubs.

### `photographer_theme` *(junction)*
| Column | Type | Notes |
|---|---|---|
| `photographer_id` | integer PK | FK → photographer |
| `theme_id` | integer PK | FK → theme |
| `added_at` | timestamp | |

> A photographer can have any number of preferred themes.

### `club`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `name` | text | |
| `description` | text | |
| `location` | text | |
| `website_url` | text | |
| `logo_url` | text | |
| `year_established` | integer | |
| `created_at` | timestamp | |

### `theme`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `name` | text | |
| `description` | text | |
| `created_at` | timestamp | |

### `photo`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `title` | text | |
| `description` | text | |
| `image_url` | text | |
| `photographer_id` | integer | FK → photographer |
| `club_id` | integer | Club the photo was submitted under |
| `theme_id` | integer | FK → theme |
| `like_count` | integer | Default 0 |
| `sort_order` | integer | Photographer-controlled display order; `null` falls back to `created_at DESC` |
| `created_at` | timestamp | |

> Each photo belongs to exactly one photographer (direct FK — no junction table). The many-to-many relationships (clubs, themes) are on the *photographer*, not the photo.

### `comment`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `photo_id` | integer | FK → photo |
| `photographer_id` | integer, nullable | FK → photographer; author when linked |
| `body` | text | |
| `created_at` | timestamp | |

### `theme_proposal`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `name` | text | Proposed theme name |
| `description` | text | |
| `proposed_by_photographer_id` | integer | FK → photographer (nullable for admin proposals) |
| `status` | text | `pending` / `approved` / `rejected` |
| `created_at` | timestamp | |

> When approved, a new `theme` row is created and the proposer receives an email notification. Pending proposals can be withdrawn by the proposer.

### `photo_like` *(member reactions)*
| Column | Type | Notes |
|---|---|---|
| `photo_id` | integer | Part of composite PK; references photo |
| `clerk_user_id` | text | Part of composite PK; the member who liked the photo |
| `created_at` | timestamp | |

> The composite primary key prevents one member from liking the same photo more than once. `photo.like_count` remains the public aggregate total.

### `photographer_follow` *(member follows)*
| Column | Type | Notes |
|---|---|---|
| `photographer_id` | integer | Part of composite PK; references photographer |
| `clerk_user_id` | text | Part of composite PK; the member who follows |
| `created_at` | timestamp | |

> Follows are private member-to-photographer relationships. The member is identified by Clerk rather than by a separate local user table.

### `admin`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `clerk_user_id` | text | Optional Clerk link |
| `display_name` | text | |
| `email` | text | |
| `password_hash` | text | For session-based login |
| `is_owner` | boolean | Owner admins cannot be removed |
| `added_at` | timestamp | |

### `invite_token`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `token` | text | Unique registration token |
| `label` | text | Human-readable description |
| `created_by_admin_id` | integer | FK → admin |
| `photographer_id` | integer, nullable | FK → photographer; profile to claim |
| `max_uses` | integer | Null = unlimited |
| `use_count` | integer | |
| `expires_at` | timestamp | |
| `revoked` | boolean | |
| `created_at` | timestamp | |

> Photographer invitations use a single-use token that is normally valid for 30 days. The linked photographer profile lets the recipient claim the correct profile automatically after signing in.

### `review_session`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `club_id` | integer | FK → club |
| `title` | text | |
| `description` | text | |
| `status` | text | `open` / `reviewing` / `closed`; defaults to `open` |
| `created_by_admin_id` | integer | FK → admin |
| `scheduled_for` | timestamp | Optional scheduled review date |
| `submission_deadline` | timestamp | Optional deadline for submissions |
| `max_photos_per_member` | integer | Optional submission limit |
| `created_at` | timestamp | |
| `closed_at` | timestamp | Set when the session is closed |

> A review session belongs to one club. Photographers submit photos while it is open; reviewing locks submissions; closed sessions are archived.

### `session_photo`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `session_id` | integer | FK → review_session |
| `photo_id` | integer | FK → photo |
| `photographer_id` | integer | FK → photographer who submitted it |
| `sort_order` | integer | Presentation order; defaults to 0 |
| `submitted_at` | timestamp | |

### `session_reviewer`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `session_id` | integer | FK → review_session |
| `photographer_id` | integer | FK → photographer designated as reviewer |
| `added_at` | timestamp | |

### `photo_review`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `session_photo_id` | integer | FK → session_photo |
| `reviewer_photographer_id` | integer | FK → photographer who submitted the review |
| `rating` | integer | Rating from 1 to 5 |
| `comment` | text | Optional review comment |
| `created_at` | timestamp | |
| `updated_at` | timestamp | |

---

## Entity Relationship Overview

```
admin ◄──── invite_token

club ◄──── photographer_club ────► photographer ◄──── photographer_theme ────► theme
                (junction)               ▲                  (junction)              ▲
                                         │                               theme_proposal
                                         │                            (──► photographer)
                                photo (──► photographer, ──► club, ──► theme)
                                    ▲
                                comment (──► photo, ──► photographer)

photo ◄──── photo_like ────► Clerk member
photographer ◄──── photographer_follow ────► Clerk member

club ◄──── review_session
review_session ◄──── session_photo ────► photo
review_session ◄──── session_reviewer ────► photographer
session_photo ◄──── photo_review ────► photographer (reviewer)
```

Arrow direction: `A ──► B` means A holds a FK to B (A references B).

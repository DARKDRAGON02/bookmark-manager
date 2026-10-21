# Contributing to Chapter Tracker

Thanks for helping improve Chapter Tracker. Contributions are welcome for source support, reliability, tests, accessibility, documentation, and product improvements.

## Ground rules

- Be respectful and constructive.
- Keep pull requests small and focused.
- Do not commit `.env` files, database files, API tokens, or real user data.
- Do not add code that bypasses paywalls, login requirements, CAPTCHA challenges, rate limits, robots restrictions, or other site protections.
- Prefer an official API or documented metadata feed over HTML scraping.

## Getting started

1. Fork the repository and create a branch with a clear name, such as `add-mangadex-source` or `fix-import-progress`.
2. Install backend and frontend dependencies.
3. Copy the example environment file and use local development values.
4. Make one focused change.
5. Run the relevant checks before opening a pull request.

```bash
# Backend
cd backend
npm install
npm run build
npm test

# Frontend
cd frontend
npm install
npm run build
npm run lint
```

## Adding a new source

Every source should be treated as an independent integration. A successful matcher alone is not enough; the latest-chapter lookup must be reliable, respectful, and tested.

### Currently supported sources

| Source      | URL pattern                      |
| ----------- | -------------------------------- |
| AsuraScans  | `asurascans.com/comics/<series>` |
| KingOfShojo | `kingofshojo.com/manga/<series>` |
| WeebCentral | `weebcentral.com/series/<id>`    |
| TempleToons | `templetoons.com/comic/<series>` |
| LustToon    | `lustoon.com/comic/<series>`     |

WeebCentral's series page only server-renders a window of chapter rows (the newest and oldest) and loads the complete list through an HTMX fragment, so its scraper depends on the newest rows always being present in that window. Chapter-level URLs on WeebCentral and KingOfShojo are not imported; only series URLs are matched.

TempleToons is the only source behind a bot check. A generic request receives a Cloudflare challenge page instead of the comic, so its scraper sends a browser-consistent header set (client hints, `sec-fetch-*`, `priority`) to get the real HTML. A `cf_clearance` value can be supplied through `TEMPLETOONS_COOKIE`, but it expires within tens of minutes and is bound to the issuing IP and header fingerprint, so treat it as a temporary fallback rather than normal configuration. The site marks paid chapters with a "Premium" badge; a chapter link without that badge is reported as unlocked, which lets a stored lock clear once early access ends.

LustToon was the most recent addition. It serves its series pages without a challenge, so a plain request is enough, and it has no per-chapter lock badge. Its scraper therefore leaves `isChapterLocked` undefined, which means the Locked badge never appears for its bookmarks.

### Before writing code

Confirm all of the following:

- The site allows the intended access, or has an official API suitable for it.
- Public chapter metadata is available without bypassing access controls.
- The URL format is stable enough to identify a series.
- The source has a safe request rate and a plan for temporary errors.
- You can provide representative, non-sensitive test fixtures.

### Implementation checklist

1. Add the domain and slug extractor to `backend/src/bookmark/constants/site-matchers.ts`.
2. Create a scraper in `backend/src/bookmark/scraper/`.
3. Register the scraper in `backend/src/bookmark/constants/SCRAPERS.ts`.
4. Add a conservative per-site concurrency limit.
5. Use timeouts and handle `429`, `5xx`, and malformed pages gracefully.
6. If the site sits behind a bot check, document the header set it needs and add any optional environment variable to `.env.example`.
7. Add unit tests for URL parsing and scraper response parsing.
8. Update the supported-sources list in the frontend (`SUPPORTED_SOURCES` in `frontend/src/page/LandingPage.tsx` and `SITE_NAMES` in `frontend/src/utils/format.ts`) and in the README.
9. Explain the source, URL pattern, and validation steps in the pull request.

### Scraper expectations

A scraper should return only public metadata needed by the tracker:

```ts
type ScrapedChapter = {
  number: number;
  image?: string;
} | null;
```

Return `null` when a page cannot be parsed. Do not throw a whole import away because one series cannot be checked.

Use the existing Redis cache and per-site limiter. Do not increase concurrency merely to make benchmarks look better; source stability is more important than a few seconds saved.

## Areas that need help

- Import-progress UI using a job identifier plus Server-Sent Events or polling.
- Accessible mobile testing and keyboard/screen-reader improvements.
- Guest-library backup/export and a clear recovery experience.
- PostgreSQL/Neon production migration and deployment tests.
- Health-check and structured error logging.
- Source integrations that meet the rules above.

## Pull request template

Please include:

```text
## What changed?

## Why?

## How was it tested?

## Source integration details (if applicable)
- Domain:
- URL pattern:
- Official API or page source:
- Rate limit:
- Terms/robots checked:
- Known limitations:
```

## Reporting bugs

Please include the browser, operating system, expected result, actual result, and steps to reproduce. Remove private bookmark URLs, cookies, API keys, and screenshots containing personal information before posting.

## License

By contributing, you agree that your contribution may be distributed under this repository's license once one is added. Until then, ask the maintainer before submitting a substantial contribution.

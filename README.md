# Chapter Tracker

Chapter Tracker imports a browser bookmark export, keeps links from supported manga and manhwa sites, and shows whether a newer chapter is available.

It uses **Firebase Authentication**, allowing the same library to be accessed across supported platforms and devices while keeping the library associated with the authenticated user.

## Live demo

[Open Chapter Tracker](https://bookmark-manager-zeta.vercel.app/)

The deployed frontend has been checked on September 28, 2026:

- The landing page loads correctly.
- Client-side navigation to the Library view works.
- Authentication is handled through Firebase.
- The application supports accessing the same library across platforms/devices when signed in.
- The Vercel SPA routing configuration has been added so application routes can be served correctly on direct navigation and refresh.
- Imports were not tested against a personal bookmark export in the public deployment.

## What it does

- Imports `.html` bookmark exports from Chrome, Firefox, Safari, and Edge.
- Recognizes supported series links, retrieves the latest chapter, and saves the result in a private library.
- Rechecks saved series when the library opens and highlights new chapters.
- Uses **Firebase Authentication** instead of an anonymous browser-only session.
- Allows the authenticated user's library to be accessed across supported platforms and devices.
- Uses per-site request limits and Redis caching to reduce unnecessary scraping.

## How it works

```text
Browser bookmark export
        |
        v
React + Vite frontend
        |
        | Firebase Authentication
        | POST /bookmark/import
        v
NestJS API
  |-- verifies authenticated Firebase user
  |-- reads and filters bookmark links
  |-- matches a supported site and extracts its series slug
  |-- scrapes the latest chapter with safe per-site concurrency
  |-- caches scrape results in Redis for 10 minutes
  '-- saves bookmarks and chapter state in PostgreSQL
        |
        v
Library displays imported series and new-chapter updates
```

### Authentication flow

1. The frontend authenticates the user with **Firebase Authentication**.
2. Firebase provides the authenticated user's identity.
3. The frontend sends authenticated requests to the NestJS API.
4. The backend verifies the Firebase authentication token.
5. The backend associates bookmarks and chapter state with the authenticated user.
6. The same account can access its library from supported platforms/devices.

This replaces the previous browser-specific anonymous guest-session model.

## Supported sources

| Source      | URL pattern                      |
| ----------- | -------------------------------- |
| AsuraScans  | `asurascans.com/comics/<series>` |
| KingOfShojo | `kingofshojo.com/manga/<series>` |
| WeebCentral | `weebcentral.com/series/<id>`    |
| TempleToons | `templetoons.com/comic/<series>` |

WeebCentral series URLs end in a ULID (`01J76XYF5ZDZX41X5S64WQHFXZ`) followed by a human-readable title. The ULID is used as the slug, so renaming a series on the site does not break an existing bookmark.

TempleToons serves comic pages behind a Cloudflare bot check. Its scraper sends a browser-consistent header set to receive the page; a generic request only gets the challenge shell, which contains no chapter links. If the check ever tightens, `TEMPLETOONS_COOKIE` can carry a `cf_clearance` value from a browser session, but it is not normally required.

Links from all other sites are deliberately skipped and reported in the import summary. This avoids saving links that cannot be reliably checked.

## Tech stack

- Frontend: React, Vite, TypeScript, TanStack Query, Axios, Tailwind CSS
- Authentication: **Firebase Authentication**
- Backend: NestJS, TypeScript, Prisma
- Database: PostgreSQL in production (Neon recommended)
- Cache: Redis (Upstash recommended)
- Hosting: Vercel for the frontend and Render for the backend

## Development setup

### Prerequisites

- Node.js 20 or newer
- PostgreSQL (or the existing local SQLite setup while developing before the production migration)
- Redis, or a reachable Upstash Redis database
- Firebase project configured for authentication

### Backend

```bash
cd backend
npm install
cp .env.example .env
npm run prisma:generate
npm run start:dev
```

### Frontend

```bash
cd frontend
npm install
printf 'VITE_API_URL=http://localhost:4000\n' > .env
npm run dev
```

The frontend runs at `http://localhost:5173` and the API normally runs at `http://localhost:4000`.

## Production deployment

Use this deployment shape:

```text
Vercel frontend  ->  Render NestJS API  ->  Neon Postgres
        |                                ->  Upstash Redis
        |
        '-- Firebase Authentication
```

Before deploying, migrate the Prisma datasource from SQLite to PostgreSQL, use the PostgreSQL Prisma driver adapter, and generate a fresh PostgreSQL migration. Never put production credentials in Git.

Set the required backend variables in Render according to `.env.example`.

Set this Vercel build variable:

```text
VITE_API_URL=https://<your-render-api-domain>
```

Use HTTPS for both deployments.

For Vercel, use `frontend` as the project root directory, `npm run build` as the build command, and `dist` as the output directory.

## Source roadmap

Future source support should be added only after checking each site's terms, robots guidance, rate limits, and whether an official API is available. Prefer official platforms and APIs where possible.

Each site needs a URL matcher, scraper, tests, safe rate limit, and fixtures—see [CONTRIBUTING.md](CONTRIBUTING.md).

Recommended candidates:

1. **MangaDex** — investigate its documented API before considering page scraping.
2. **WEBTOON** — a major official webcomic platform with frequent updates.
3. **MANGA Plus by SHUEISHA** — a major official manga platform.
4. **Tapas** — official English webcomics and novels platform.
5. **Tappytoon** — official Korean comics and novels catalogue.
6. **Manta** — official manhwa, manga, and novel platform.
7. **Lezhin Comics** — official webtoon platform.
8. **Toomics** — official webtoon platform.
9. **Comikey** — official manga and webtoon platform.
10. **Pocket Comics** — official webtoon and manga platform.
11. **Naver WEBTOON Korea** — a major Korean webtoon catalogue; assess localization and access constraints first.

Some sources have dynamic pages, authentication, anti-bot controls, paid chapters, or terms that prohibit automated access. Those sources should not be added until there is a compliant way to retrieve public update metadata.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request.

## Privacy and limitations

- Libraries are associated with the authenticated Firebase user rather than a single browser.
- Users can access their library across supported platforms and devices by signing in to the same account.
- The app tracks public chapter metadata; it does not host or distribute comic content.
- A source may still fail a later check if its public page changes or is unavailable.
- Authentication and cross-platform access depend on the Firebase project and configured authentication providers.
- A successful import means links were saved. It does not guarantee that every supported source will remain available for future checks.

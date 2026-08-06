# Bookcsi — API

NestJS + Prisma + MariaDB. What it implements today is Sprint 0: Google sign-in,
a session in an httpOnly cookie, and per-user data isolation. See
[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md).

## Setup

```bash
npm install                      # from the repo root — npm workspaces
npm run db:up                    # MariaDB 11 in Docker, utf8mb4
cp backend/.env.example backend/.env
```

Fill in `backend/.env`:

- `JWT_SECRET` — `openssl rand -base64 48`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google Cloud console → *APIs &
  Services* → *Credentials* → *Create OAuth client ID*, type **Web application**.
  Add `http://localhost:3000/auth/google/callback` under *Authorized redirect
  URIs*, verbatim. The consent screen needs no verification while it is in
  testing mode with your own account listed as a test user.

Then:

```bash
npm run prisma:migrate --workspace backend   # apply migrations
npm run dev:api                              # builds shared/, starts on :3000
npm test --workspace backend
```

`npm install` may report that Prisma's install scripts are not approved — npm
now blocks them by default. `npm approve-scripts prisma @prisma/client
@prisma/engines` records the approval in the root `package.json`; without it
Prisma has no query engine.

## Routes

| Route | |
|---|---|
| `GET /auth/google` | starts the OAuth flow |
| `GET /auth/google/callback` | creates or refreshes the account, sets the cookie, redirects to `WEB_ORIGIN` |
| `GET /auth/me` | the current user, or 401 — the frontend's boot check |
| `POST /auth/logout` | clears the cookie |

Everything else requires a session: `JwtAuthGuard` is registered globally, and
`@Public()` is the only way out. New controllers are protected by default.

## Writing a user-scoped endpoint

`userId` comes from the session and nowhere else:

```ts
@Get(":id")
async findOne(@CurrentUser() user: AuthUser, @Param("id") id: string) {
  return ownedOrNotFound(
    await this.prisma.book.findFirst({ where: { id, userId: user.id } }),
  );
}
```

`ownedOrNotFound` raises 404 rather than 403 on purpose: a 403 would confirm
that the id exists in somebody else's library (S0.3).

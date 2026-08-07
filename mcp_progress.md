# MCP OAuth 2.1 server — progress

Living checklist for implementing `docs/MCP.md`. Maintained by Claude during
the build; check items off as they land, add a short note under a step if the
implementation deviated from the plan. Full plan detail (rationale, flagged
decisions) lives in the conversation that produced this file — this is the
tracking surface, not the spec.

Out of scope for this pass: `Dockerfile`, `.dockerignore`, `docker/kobo-routing.conf`.

**Decisions taken where docs/MCP.md left a gap:**
- `search_library` → `BooksService.findAll` (doc says `.list`, real method is `findAll`).
- `get_reading_stats` → `StatsService.overview` only.
- `get_budget` → `BudgetService.summary` only.
- Consent deny: no backend endpoint — frontend redirects to `redirect_uri?error=access_denied&state=...`.
- Revocation screen: new standalone route `/connectors` + nav entry, not a general Settings page.

---

## Step 1 — Resource-server skeleton ✅

- [x] `API_ORIGIN` added to `backend/src/config/env.ts` (+ `.env`, `.env.example`, `env.spec.ts`)
- [x] `backend/src/mcp/mcp.module.ts` created, registered in `app.module.ts`
- [x] `backend/src/mcp/well-known.controller.ts` — protected-resource + authorization-server metadata routes
- [x] `backend/src/mcp/mcp.controller.ts` — `POST /mcp` stub returning 401 + `WWW-Authenticate`
- [x] Verified: curl against both `.well-known` routes + `/mcp` 401 against the live dev server — correct
      bodies and header. `npm run typecheck` clean. Full `jest` suite: 19 suites / 270 tests passing,
      no regressions.

## Step 2 — Prisma migration ✅

- [x] `McpGrant`, `McpAuthCode`, `McpToken` models + `McpTokenType` enum added to `schema.prisma`
- [x] `backend/src/mcp/token-hash.ts` helper (mint + sha256 hash)
- [x] Migration generated and applied (`20260807221514_add_mcp_oauth`)
- [x] Verified: `prisma generate` clean, typecheck + jest pass (19/19, 270/270). Also ran a throwaway
      script exercising the actual DB: rotation self-relation (`replacedBy`) resolves correctly, and
      deleting a `User` cascades through `McpGrant` → `McpAuthCode`/`McpToken` as intended.

## Step 3 — Authorization server ✅

- [x] `MCP_CLIENT_ID` / `MCP_CLIENT_SECRET` / `MCP_REDIRECT_URIS` / `MCP_CLIENT_DISPLAY_NAME` env vars
- [x] `GET /oauth/authorize` — validates client_id/redirect_uri first (400, never a redirect, if either is
      wrong); other problems redirect back to `redirect_uri` with `?error=...`
- [x] `GET /oauth/authorize/:req` (session-guarded)
- [x] `POST /oauth/authorize/:req/approve` (session-guarded, reuses a non-revoked grant if one exists)
- [x] `POST /oauth/token` — authorization_code (PKCE S256, single-use, redirect_uri re-check) +
      refresh_token (rotation, reuse revokes the whole grant) — RFC 6749 error vocabulary via a
      route-scoped `OAuthTokenErrorFilter`, not the app's own `{code, message}` contract
- [x] `POST /oauth/revoke` (RFC 7009)
- [x] Pending-request storage: a signed short-lived JWT (`req` param), not a 4th persisted table —
      docs/MCP.md §5 counts exactly three entities
- [x] `shared/src/mcp.ts` schemas (`mcpConsentRequestSchema` incl. `state` for the deny redirect, `mcpGrantSchema`)
- [x] `frontend/src/api/mcp.ts` hooks
- [x] `frontend/src/pages/McpConsentPage.tsx` + `/mcp/consent` route (deny redirects client-side with
      `error=access_denied`, no backend deny endpoint — per the plan's flagged decision)
- [x] Verified, multiple ways:
  - `backend/src/mcp/oauth.spec.ts` — 21 supertest cases: full round trip, wrong `code_verifier`,
    expired/reused code, redirect_uri mismatch (authorize *and* token), wrong client secret, refresh
    rotation, refresh reuse revokes the grant, revoke endpoint, RFC 7009's "200 even if unknown" rule
  - A live run against the **real dev server + real MySQL DB** (not mocks): full
    authorize → consent → approve → token → refresh → reuse-detection chain, all assertions passed
  - `frontend/src/pages/McpConsentPage.test.tsx` — 6 RTL cases: renders client name/scope, approve
    navigates to the server's redirect URL, deny builds the `access_denied` redirect client-side with
    `state` echoed, missing/expired `req`, approval failure leaves the user on the page
  - Full repo `npm run test` (backend 20/293, frontend 26/237, kobo-frontend 4/32) and
    `npm run typecheck` across all four workspaces — zero regressions

## Step 4 — MCP transport + first two tools ✅

- [x] `@modelcontextprotocol/sdk@^1.30.0` installed (pre-existing, unrelated `js-yaml`/`@nestjs/swagger`
      audit warning noted, not caused by this dependency)
- [x] `backend/src/mcp/mcp-bearer.guard.ts` — hashes the Bearer token, checks type/expiry/grant-not-revoked,
      attaches `{userId, grantId}` to the request, touches `lastUsedAt` (fire-and-forget) — pulled forward
      from step 6 since it's inherent to a correct guard, not a separate feature
  - Fixed a real bug caught by hand before it shipped: the guard originally wrote the response body
    directly *and* returned `false`, which would double-respond once Nest's own guard-rejection path
    also tried to send something. Fixed by throwing a dedicated `McpAuthError`, caught by a route-scoped
    `McpAuthErrorFilter` (same pattern as `OAuthTokenErrorFilter`) — headers set before the throw survive.
- [x] `backend/src/mcp/mcp-throttler.guard.ts` — grant-keyed, layered on top of (not replacing) the
      global IP-keyed throttler
- [x] `POST /mcp` real transport wiring — stateless `StreamableHTTPServerTransport`
      (`sessionIdGenerator: undefined`), fresh `McpServer` per request, `req.body` passed explicitly,
      Origin header checked against `WEB_ORIGIN` (DNS-rebinding protection)
- [x] `search_library` (wraps `BooksService.findAll`) and `get_book` (wraps `BooksService.findOne`)
      registered, with trimmed response shapes and "when/when-not" tool descriptions per §8
  - **Decision, flagged**: docs/MCP.md §8 lists a `text` filter for `search_library`, but no free-text
    search exists anywhere in `BooksService`/the REST API to wrap (confirmed by reading the controller
    and service in full) — omitted rather than inventing new filtering logic inside an MCP tool handler,
    which would violate §8's own "tools are thin wrappers over existing services" framing. Real text
    search would be a `BooksService`/REST feature first, if ever added.
- [x] Verified, multiple ways:
  - Live run against the **real dev server + real MySQL DB**, using the actual `@modelcontextprotocol/sdk`
    **client** (`Client` + `StreamableHTTPClientTransport`, not a hand-rolled JSON-RPC body) — real
    `initialize` handshake, `tools/list` (confirms exactly `search_library`+`get_book`), `tools/call` for
    both tools against real seeded books, a `favorite:true` filter, and a foreign book id → error result
  - Two real users, two real grants: confirmed `search_library` returns *only* the calling user's books —
    not just "the query includes a userId filter" but an actual second account seeing a disjoint result
  - Raw `fetch` checks: missing Authorization → 401 + `WWW-Authenticate`; garbage token → 401; a token
    revoked mid-session (via `/oauth/revoke`) → 401 on the *next* call, not just a flipped DB row
  - Full `npm run typecheck` + `jest` (20/293) after wiring — needed one fix: `oauth.spec.ts`'s test
    module didn't have `ThrottlerModule` registered (only pulled in transitively via `AppModule` in
    production), which `McpThrottlerGuard`'s DI now needs even for routes that aren't `/mcp` — fixed by
    adding it to the test module, matching `AppModule`'s config

## Step 5 — Remaining tools ✅

- [x] `add_book` (`BooksService.create`), `update_book` (`.update`), `delete_book` (`.remove`),
      `get_reading_stats` (`StatsService.overview`), `get_budget` (`BudgetService.summary`),
      `search_open_library` (`OpenLibraryService.search`)
- [x] `BudgetModule`/`StatsModule`/`OpenLibraryModule` gained `exports: [...]` for their services —
      none of the three exported them before (each only had its own REST controller as a consumer);
      small, additive, same pattern `BooksModule` already used
- [x] Every tool's own catch path uses a shared `errorText()` helper rather than trusting the SDK's
      default `error.message` handling — `AppError.validation([...])`'s message is an *array* (one
      sentence per field), and `HttpException.message` silently drops arrays down to a generic
      "AppError" string. Confirmed for real in the e2e run below: `update_book` with an invalid rating
      surfaces the actual field-named sentence, not a generic failure.
- [x] Trimmed response shapes on `search_library` (id/title/author/status/genre/favorite/rating, not
      the full row); `get_book`/`add_book`/`update_book` return the full `Book` since they're
      single-item detail/confirmation, not a list
- [x] **Decision, flagged**: `search_library`'s `text` filter from docs/MCP.md §8 doesn't exist as a
      real capability anywhere in `BooksService`/REST — omitted rather than adding new filtering logic
      inside an MCP tool (see Step 4 for the full reasoning)
- [x] Verified: full live run against the real server, DB, and the **real Open Library API** (not
      mocked) — `tools/list` returns all 8; `add_book` → `update_book` (incl. the rating cross-field
      rule, proving the array-message fix works) → `search_library` finds it by its new status →
      `delete_book` → `get_book` on the deleted id is now an error; `get_reading_stats`/`get_budget`
      reflect a real seeded book+purchase with correct aggregates; `search_open_library` returns real
      Dune-adjacent results and enforces the 2-character minimum. Full `npm run typecheck` across all
      four workspaces and `jest` (20/293) — zero regressions.

## Step 6 — Revocation screen ✅

- [x] `GET /mcp/grants` (session-guarded, non-revoked only, includes the configured client display
      name), `POST /mcp/grants/:id/revoke` (ownership-scoped `updateMany`, 404 — not 403 — for someone
      else's grant or one that doesn't exist, S0.3-style)
- [x] `lastUsedAt` touched on successful `/mcp` calls — already done in Step 4's bearer guard
- [x] `frontend/src/pages/ConnectorsPage.tsx` + `/connectors` route
- [x] **Decision, flagged — deviates from the original plan text**: no entry in `Header.tsx`'s main
      `NAV` array. That array's own comment describes it as "the whole product's shape," a deliberately
      curated list of content destinations (§D28/§D32) — a connector-revocation screen is account
      security, not a content view, so it's a link in `AccountMenu` (the avatar dropdown), next to
      "Delogare", instead.
- [x] `RevokeGrantDialog.tsx` (modeled directly on `DeleteBookDialog.tsx`), wired through `Modal.tsx`
- [x] `frontend/src/api/mcp.ts` gained `useGrants()` / `useRevokeGrant()`
- [x] Verified, multiple ways:
  - `backend/src/mcp/grants.spec.ts` — 7 supertest cases: session required on both routes, correct
    listing shape, ownership-scoped revoke, 404 for someone else's/nonexistent/already-revoked grants
  - `frontend/src/pages/ConnectorsPage.test.tsx` — 6 RTL cases: list rendering (incl. "nefolosit încă"
    vs a real last-used date), empty state, load failure + retry, confirm-before-revoke, cancel leaves
    it untouched
  - **Live run against the real server + DB**, driving the exact user flow: a real MCP client connects
    and lists 8 tools, `GET /mcp/grants` shows it, `POST /mcp/grants/:id/revoke` (the same endpoint the
    Connectors screen calls) revokes it, and — critically — the *already-connected* live client's next
    call fails, not just a fresh one; confirmed again via raw fetch for the exact 401 + `WWW-Authenticate`
  - Full repo `npm run test` (backend 21/300, frontend 27/243, kobo-frontend 4/32) and
    `npm run typecheck` across all four workspaces — zero regressions

## Step 7 — User-facing documentation ✅

- [x] `docs/MCP_SETUP.md` — API URL / client id / client secret table, Claude Desktop/Code connector
      dialog steps, what the 8 tools let an assistant do, revocation (points at "Aplicații conectate"),
      and a troubleshooting section quoting the server's actual error strings
- [x] Verified: every concrete claim in the doc checked against the live system, not just written and
      trusted —
  - the two error strings quoted in §5 (`redirect_uri is not registered for this client`,
    `invalid_client`) `grep`-matched against `oauth.service.ts` verbatim
  - the consent screen heading quoted in §2 (`{client} vrea acces la biblioteca ta`) matches
    `McpConsentPage.tsx`'s actual rendered text
  - the account-menu label quoted in §4 (`Aplicații conectate`) matches `Header.tsx`'s actual link text
  - **the doc's central claim — "clientul detectează automat că serverul cere OAuth" — run for real**:
    a script given *only* the `/mcp` URL (nothing else, as a user pasting into a connector dialog would
    provide) followed the 401 → `WWW-Authenticate` → protected-resource doc → authorization-server doc
    chain with zero side-channel knowledge, and arrived at the correct `authorization_endpoint`/
    `token_endpoint` — the literal bootstrapping sequence a real connector dialog performs
  - layered on top of the full login → consent → approve → token → tool-call → revoke chain already
    proven live in Steps 3–6

---

## All 7 steps complete.

Final state across the whole repo, all four workspaces:
- `npm run typecheck` — clean (backend, frontend, kobo-frontend, shared)
- `npm run test` — backend 21 suites / 300 tests, frontend 27 suites / 243 tests, kobo-frontend
  4 suites / 32 tests, all passing, zero regressions introduced across the whole build
- Every step additionally verified live against the real dev server + real MySQL database, several
  using the actual `@modelcontextprotocol/sdk` client library rather than hand-rolled JSON-RPC —
  not just unit-level mocks

## Cross-cutting

- [ ] Secrets excluded from logging (`Authorization` header, `/oauth/token` bodies)
- [ ] `npm run test` passes across workspaces after every step

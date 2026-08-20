-- §D47 — one-off cleanup of the McpToken / McpAuthCode backlog.
--
-- Nothing ever deleted these before: every access-token refresh mints a new
-- pair (access 1h, refresh 90d) and only marks the old one replaced, and every
-- 60-second auth code was kept for good — so an active grant accumulated rows
-- without bound. `OAuthService.mintTokenPair` now sweeps a grant's expired rows
-- on each use (the ongoing fix); this clears what piled up before that landed.
--
-- Safe by the same reasoning as the lazy sweep: an expired access or refresh
-- token cannot be used (both exchange paths reject on expiry), and a used or
-- expired auth code is spent — so none of these rows can still authenticate
-- anything. A rotated-but-unexpired refresh token is left alone, so
-- reuse-detection keeps working.

DELETE FROM `McpToken` WHERE `expiresAt` < NOW();
DELETE FROM `McpAuthCode` WHERE `expiresAt` < NOW() OR `usedAt` IS NOT NULL;

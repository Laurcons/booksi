import type { AuditSource } from "@prisma/client";
import type { AuditableRequest } from "./audit-request";

/** `kobo-frontend` tags every request it proxies (`backend-client.ts`) — the only reliable signal, since it forwards the device's own User-Agent unchanged and that string is not something to route on. */
export function resolveSource(request: AuditableRequest): AuditSource {
  if (request.headers["x-client"] === "kobo") {
    return "KOBO";
  }
  if (request.mcpAuth) {
    return "MCP";
  }
  return "WEB";
}

export function resolveActor(request: AuditableRequest): {
  userId: string | null;
  impersonatedBy: string | null;
} {
  if (request.user) {
    return {
      userId: request.user.id,
      impersonatedBy: request.user.impersonatedBy?.id ?? null,
    };
  }
  if (request.mcpAuth) {
    return { userId: request.mcpAuth.userId, impersonatedBy: null };
  }
  return { userId: null, impersonatedBy: null };
}

export function resolveAction(action: string | undefined, request: AuditableRequest): string {
  return action ?? `${request.method} ${request.route?.path ?? request.path}`;
}

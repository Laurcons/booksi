import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "@bookcsi/shared";

/**
 * The only sanctioned source of `userId` (S0.3). It comes from the verified
 * session, never from a body field or a query parameter — a controller that
 * accepts a client-supplied user id has already lost the isolation guarantee.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();

    if (!request.user) {
      // Unreachable behind JwtAuthGuard; a loud failure beats a silent
      // undefined leaking into a `where` clause.
      throw new Error("CurrentUser used on a route without JwtAuthGuard");
    }

    return request.user;
  },
);

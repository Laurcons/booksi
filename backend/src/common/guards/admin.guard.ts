import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { AuthUser } from "@bookcsi/shared";
import { AppError } from "../app-error";

/**
 * Gates the impersonation routes on `AuthController` (§D38). Runs after the
 * global `JwtAuthGuard`, which has already put `AuthUser` on the request — a
 * real session is required to get this far, `isAdmin` is what's being
 * checked here.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();

    if (!request.user?.isAdmin) {
      throw AppError.forbidden();
    }

    return true;
  }
}

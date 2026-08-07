import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import type { Response } from "express";

/** `/mcp`'s 401 — `{error: "unauthorized"}`, not this app's `{code, message}` shape. */
export class McpAuthError extends HttpException {
  constructor() {
    super({ error: "unauthorized" }, HttpStatus.UNAUTHORIZED);
  }
}

/**
 * The global `AppExceptionFilter` rewrites *every* 401 into
 * `{code: "UNAUTHENTICATED", message: "Sesiunea a expirat..."}` — right for
 * the session cookie, wrong here: there is no session in a Bearer failure,
 * and the sentence would tell an MCP client's user to do something that has
 * nothing to do with their actual problem. Route-scoped, same idiom as
 * `OAuthTokenErrorFilter`, so `McpBearerGuard`'s `WWW-Authenticate` header
 * (set on the response before this runs) reaches the client untouched.
 */
@Catch(McpAuthError)
export class McpAuthErrorFilter implements ExceptionFilter {
  catch(exception: McpAuthError, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    res.status(exception.getStatus()).json(exception.getResponse());
  }
}

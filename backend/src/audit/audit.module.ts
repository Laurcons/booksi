import { Global, Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AuditInterceptor } from "./audit.interceptor";
import { AuditService } from "./audit.service";

/**
 * `@Global()` like `PrismaModule`: `AuditService` is called from places that
 * have nothing else to do with each other (auth's login/logout/impersonate
 * events, the MCP tool handlers, the interceptor below) and importing this
 * module into every one of them would only repeat the same line everywhere.
 */
@Global()
@Module({
  providers: [AuditService, { provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
  exports: [AuditService],
})
export class AuditModule {}

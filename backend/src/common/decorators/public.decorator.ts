import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/**
 * Opts a route out of the global `JwtAuthGuard`. Authentication is the default;
 * this decorator is the only exception, and it belongs on auth routes alone.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * Reached only because `main.ts` calls `enableShutdownHooks()` — without it
   * Nest never runs this and a SIGTERM drops the connection pool rather than
   * closing it, which the database sees as a client that vanished.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { AuthModule } from "./auth/auth.module";
import { BooksModule } from "./books/books.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { validateEnv } from "./config/env";
import { PrismaModule } from "./prisma/prisma.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env"],
      validate: validateEnv,
    }),
    PrismaModule,
    AuthModule,
    BooksModule,
  ],
  providers: [
    // Every route requires a session unless it is marked @Public() (S0.3).
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}

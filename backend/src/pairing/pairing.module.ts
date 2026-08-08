import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PairingController } from "./pairing.controller";
import { PairingService } from "./pairing.service";

@Module({
  // `AuthModule` for `AuthService.signSessionToken` / `findById` — consuming
  // a pairing mints exactly the session a Google login would.
  imports: [PrismaModule, AuthModule],
  controllers: [PairingController],
  providers: [PairingService],
})
export class PairingModule {}

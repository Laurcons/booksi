import {
  Controller,
  Get,
  HttpStatus,
  INestApplication,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerException } from "@nestjs/throttler";
import request from "supertest";
import { AuditService } from "../../audit/audit.service";
import { AppError } from "../app-error";
import { AppExceptionFilter } from "./app-exception.filter";

/**
 * §D27 is a convention, and a convention nobody asserts on is a comment.
 *
 * The case worth the most here is the suppression: a 5xx that arrives with a
 * message it should not have. Nothing in the type system stops
 * `new InternalServerErrorException(err.message)` being written, and without
 * this filter Nest would put whatever the driver said onto a user's screen.
 * The test is what turns "we agreed not to do that" into "it cannot happen".
 */
@Controller("boom")
class BoomController {
  @Get("app-error")
  appError(): never {
    throw AppError.validation("error.rating.wrongStatus", "rating");
  }

  @Get("plain")
  plain(): never {
    // The convention's other half: something the user can do nothing about.
    throw new Error("connection to mysql://user:hunter2@db failed");
  }

  @Get("leaky")
  leaky(): never {
    throw new InternalServerErrorException("column `manuallyEditedFields` missing");
  }

  @Get("throttled")
  throttled(): never {
    throw new ThrottlerException();
  }

  @Get("unauthorized")
  unauthorized(): never {
    throw new UnauthorizedException();
  }

  @Get("nest-404")
  nest404(): never {
    throw new NotFoundException();
  }
}

describe("AppExceptionFilter (§D27)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BoomController],
      providers: [
        { provide: APP_FILTER, useClass: AppExceptionFilter },
        // A stub, not the real `AuditModule`: this filter's audit-logging
        // side effect isn't what's under test here, and pulling in
        // `AuditModule` would mean pulling in `PrismaModule`/`ConfigModule`
        // too, for a test that's otherwise deliberately just
        // `BoomController` and the filter.
        { provide: AuditService, useValue: { log: jest.fn() } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    // Nothing should be logged to the test output; the filter logs on purpose,
    // and the point of the assertions below is that it logs *instead of*
    // answering.
    app.useLogger(false);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  /**
   * §D44 — `BoomController` is unauthenticated, so there is no stored preference
   * and the header decides. Asking for Romanian explicitly is what keeps the
   * assertions below about *wording* rather than about which language a request
   * with no opinion happens to get.
   */
  const get = (path: string) =>
    request(app.getHttpServer())
      .get(`/boom/${path}`)
      .set("Accept-Language", "ro-RO,ro;q=0.9");

  it("passes an AppError through with its code and its words", async () => {
    const res = await get("app-error").expect(400);

    expect(res.body).toEqual({
      statusCode: 400,
      code: "VALIDATION_FAILED",
      // Field-prefixed and in an array — the shape a schema failure has, because
      // to the client this is the same kind of error (§D44).
      message: ["rating: Ratingul se poate da doar cărților terminate sau abandonate"],
    });
  });

  it("words an error in the language the request asked for (§D44)", async () => {
    // The same route, the same failure, two readers. Nothing here is
    // authenticated, so `Accept-Language` is the whole of the decision.
    const ro = await request(app.getHttpServer())
      .get("/boom/app-error")
      .set("Accept-Language", "ro")
      .expect(400);
    const en = await request(app.getHttpServer())
      .get("/boom/app-error")
      .set("Accept-Language", "en")
      .expect(400);

    expect(String(ro.body.message)).toContain("Ratingul se poate da");
    expect(String(en.body.message)).toContain("Only a book you have finished");
    // The code is the client's contract and does not move with the wording.
    expect(ro.body.code).toBe(en.body.code);
  });

  it("falls back to English when the request expresses no preference", async () => {
    // No session and no header: `DEFAULT_LOCALE`. Romanian accounts never reach
    // this path — they carry `locale` on the row.
    const res = await request(app.getHttpServer())
      .get("/boom/app-error")
      .expect(400);

    expect(String(res.body.message)).toContain("Only a book you have finished");
  });

  it("turns a plain Error into a bare 500", async () => {
    const res = await get("plain").expect(500);

    expect(res.body.code).toBeUndefined();
    // The credentials in the thrown message must not be anywhere near this.
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
    expect(res.body.message).toMatch(/Ceva n-a mers bine pe server/);
  });

  it("suppresses a 5xx that arrived carrying a message", async () => {
    // The half Nest's default filter gets wrong: it would have sent this
    // sentence verbatim.
    const res = await get("leaky").expect(500);

    expect(res.body.code).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("manuallyEditedFields");
    expect(res.body.message).toMatch(/Ceva n-a mers bine pe server/);
  });

  it("gives rate limiting a code, since waiting is something you can do", async () => {
    const res = await get("throttled").expect(HttpStatus.TOO_MANY_REQUESTS);

    expect(res.body).toMatchObject({ code: "RATE_LIMITED" });
    expect(res.body.message).toMatch(/Așteaptă/);
  });

  it("names a 401 so the client can route on it rather than read it", async () => {
    // Raised by passport and by Nest's own guards, never by our code, so this
    // filter is the only place it can acquire a code.
    const res = await get("unauthorized").expect(401);

    expect(res.body).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("leaves an uncoded 4xx alone", async () => {
    // A route that does not exist is not something we have words for, and
    // Nest's own body is already fit to send.
    const res = await get("nest-404").expect(404);

    expect(res.body.code).toBeUndefined();
    expect(res.body.statusCode).toBe(404);
  });
});

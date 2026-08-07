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
    throw AppError.validation(["title: Titlul e obligatoriu"]);
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
      providers: [{ provide: APP_FILTER, useClass: AppExceptionFilter }],
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

  const get = (path: string) => request(app.getHttpServer()).get(`/boom/${path}`);

  it("passes an AppError through with its code and its words", async () => {
    const res = await get("app-error").expect(400);

    expect(res.body).toEqual({
      statusCode: 400,
      code: "VALIDATION_FAILED",
      message: ["title: Titlul e obligatoriu"],
    });
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

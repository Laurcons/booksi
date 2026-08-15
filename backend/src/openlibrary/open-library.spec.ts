import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";
import { AuthModule } from "../auth/auth.module";
import { AuthService } from "../auth/auth.service";
import { SESSION_COOKIE } from "../auth/session";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { AuditModule } from "../audit/audit.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PrismaService } from "../prisma/prisma.service";
import { OpenLibraryModule } from "./open-library.module";

const storedUser = {
  id: "user-1",
  googleId: "google-1",
  email: "cineva@example.com",
  name: "Cineva",
  avatarUrl: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  tokenVersion: 0,
};

/** A real PNG header, so the sniffing under test has something to sniff. */
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);

/**
 * Sprint 4, the external half.
 *
 * `fetch` is mocked rather than pointed at a local double, because what these
 * tests are mostly about is the shapes Open Library actually sends — a work
 * with no author, a lookup that answers `{}` instead of 404, a cover host that
 * returns a grey rectangle unless told not to. Those are facts about their
 * API, and stating them here is the only place they are written down.
 */
describe("Open Library routes (Sprint 4)", () => {
  let app: INestApplication;
  let authService: AuthService;

  const prisma = { $connect: jest.fn(), auditLog: { create: jest.fn().mockResolvedValue(undefined) }, user: { findUnique: jest.fn() } };
  const fetchMock = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              NODE_ENV: "test",
              PORT: 3000,
              DATABASE_URL: "mysql://x:y@localhost:3306/z",
              GOOGLE_CLIENT_ID: "test-client-id",
              GOOGLE_CLIENT_SECRET: "test-client-secret",
              GOOGLE_CALLBACK_URL: "http://localhost:3000/auth/google/callback",
              JWT_SECRET: "test-secret-long-enough",
              WEB_ORIGIN: "http://localhost:5173",
            }),
          ],
        }),
        PrismaModule,
        AuditModule,
        AuthModule,
        OpenLibraryModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    await app.init();

    authService = app.get(AuthService);

    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(storedUser);
  });

  const session = () =>
    `${SESSION_COOKIE}=${authService.signSessionToken(storedUser)}`;

  const as = (url: string) =>
    request(app.getHttpServer()).get(url).set("Cookie", session());

  /** The URL the service asked Open Library for. */
  const requestedUrl = (call = 0) => String(fetchMock.mock.calls[call][0]);

  const answerWith = (body: unknown, status = 200) => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    );
  };

  describe("GET /openlibrary/search (S4.1)", () => {
    it("returns works, with the default edition attached rather than chosen (§D7)", async () => {
      answerWith({
        docs: [
          {
            key: "/works/OL45804W",
            title: "Dune",
            author_name: ["Frank Herbert", "Brian Herbert"],
            first_publish_year: 1965,
            cover_edition_key: "OL7353617M",
          },
        ],
      });

      const res = await as("/openlibrary/search?q=dune").expect(200);

      expect(res.body).toEqual([
        {
          workKey: "OL45804W",
          editionKey: "OL7353617M",
          title: "Dune",
          // The first author only: `author` is one column, and a work lists
          // every author of every edition it has.
          author: "Frank Herbert",
          firstPublishYear: 1965,
          thumbnailUrl: "/openlibrary/covers/OL7353617M",
        },
      ]);
    });

    it("keeps a work that has no author, year or default edition", async () => {
      // Not a malformed response — an ordinary one. A result dropped for
      // missing an edition would be a book the user searched for and cannot
      // find, with no explanation available.
      answerWith({ docs: [{ key: "/works/OL1W", title: "Ceva" }] });

      const res = await as("/openlibrary/search?q=ceva").expect(200);

      expect(res.body).toEqual([
        {
          workKey: "OL1W",
          editionKey: null,
          title: "Ceva",
          author: null,
          firstPublishYear: null,
          thumbnailUrl: null,
        },
      ]);
    });

    it("never hands back a covers.openlibrary.org URL", async () => {
      answerWith({
        docs: [
          { key: "/works/OL1W", title: "Dune", cover_edition_key: "OL7353617M" },
        ],
      });

      const res = await as("/openlibrary/search?q=dune").expect(200);

      // The rule the whole proxy exists for: hand the browser a foreign URL
      // and "the frontend never touches Open Library" stops being true the
      // moment anything renders it.
      expect(res.body[0].thumbnailUrl).not.toContain("openlibrary.org");
      expect(res.body[0].thumbnailUrl).toBe("/openlibrary/covers/OL7353617M");
    });

    it("asks for ten results and only the fields it reads", async () => {
      answerWith({ docs: [] });

      await as("/openlibrary/search?q=dune").expect(200);

      expect(requestedUrl()).toContain("limit=10");
      expect(requestedUrl()).toContain(
        "fields=key,title,author_name,first_publish_year,cover_edition_key",
      );
    });

    it("refuses a single character", async () => {
      await as("/openlibrary/search?q=d").expect(400);

      // And does not spend somebody else's request finding that out.
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("answers 503 when Open Library cannot be reached", async () => {
      fetchMock.mockRejectedValue(new Error("ETIMEDOUT"));

      const res = await as("/openlibrary/search?q=dune").expect(503);

      // The degradation criterion: the client shows this and leaves the manual
      // form alone. A 500 would read as our bug and say nothing useful.
      expect(res.body.message).toContain("manual");
    });

    it("answers 502 when Open Library replies with an error", async () => {
      answerWith({}, 500);

      await as("/openlibrary/search?q=dune").expect(502);
    });

    it("answers 502 when the response is not the shape we know", async () => {
      answerWith({ docs: [{ title: "no key at all" }] });

      await as("/openlibrary/search?q=dune").expect(502);
    });
  });

  describe("GET /openlibrary/editions/:key (S4.1, §D7)", () => {
    const dune = {
      "OLID:OL7353617M": {
        title: "Dune",
        authors: [{ name: "Frank Herbert" }],
        number_of_pages: 620,
        key: "/books/OL7353617M",
        identifiers: {
          isbn_10: ["0441013597"],
          isbn_13: ["9780441013593"],
        },
        publishers: [{ name: "Ace Books" }],
        publish_date: "1990",
        physical_dimensions: "18 x 11 x 3 cm",
      },
    };

    it("fills the form from the edition", async () => {
      answerWith(dune);

      const res = await as("/openlibrary/editions/OL7353617M").expect(200);

      expect(res.body).toEqual({
        title: "Dune",
        author: "Frank Herbert",
        // ISBN-13 in preference to ISBN-10: both identify the book, and only
        // one of them is still being issued.
        isbn: "9780441013593",
        totalPages: 620,
        publisher: "Ace Books",
        publicationYear: 1990,
        format: "18 x 11 x 3 cm",
        olEditionKey: "OL7353617M",
        thumbnailUrl: "/openlibrary/covers/OL7353617M",
      });
    });

    it("pulls the year out of a free-text publish date", async () => {
      answerWith({
        "OLID:OL7353617M": { title: "Dune", publish_date: "August 1965" },
      });

      const res = await as("/openlibrary/editions/OL7353617M").expect(200);

      expect(res.body.publicationYear).toBe(1965);
    });

    it("leaves the year null when nothing four digits long is in the date", async () => {
      answerWith({
        "OLID:OL7353617M": { title: "Dune", publish_date: "cop." },
      });

      const res = await as("/openlibrary/editions/OL7353617M").expect(200);

      expect(res.body.publicationYear).toBeNull();
    });

    it("joins several authors rather than picking one", async () => {
      // Verified against the live API: the edition behind *Sandworms of Dune*
      // really does list two people, and printing one would be wrong.
      answerWith({
        "OLID:OL7353617M": {
          title: "Dune",
          authors: [{ name: "Frank Herbert" }, { name: "Brian Herbert" }],
        },
      });

      const res = await as("/openlibrary/editions/OL7353617M").expect(200);

      expect(res.body.author).toBe("Frank Herbert, Brian Herbert");
    });

    it("drops a transliteration of the author it already has", async () => {
      // Also from the live API: ISBN 9780441013593 comes back with
      // `["Frank Herbert", "Френк Герберт"]`, and a plain join reads as though
      // Dune had two authors. A real co-authored book lists its authors in one
      // script, so a mixed list is one author written twice.
      answerWith({
        "OLID:OL7353617M": {
          title: "Dune",
          authors: [{ name: "Frank Herbert" }, { name: "Френк Герберт" }],
        },
      });

      const res = await as("/openlibrary/editions/OL7353617M").expect(200);

      expect(res.body.author).toBe("Frank Herbert");
    });

    it("keeps every author when none of them is Latin", async () => {
      // A Russian edition is not a mixed list, and dropping its authors
      // because of the script they are written in would be the same mistake
      // pointed the other way.
      answerWith({
        "OLID:OL7353617M": {
          title: "Дюна",
          authors: [{ name: "Френк Герберт" }, { name: "Брайан Герберт" }],
        },
      });

      const res = await as("/openlibrary/editions/OL7353617M").expect(200);

      expect(res.body.author).toBe("Френк Герберт, Брайан Герберт");
    });

    it("rejects anything that is not an edition key", async () => {
      // The key is interpolated into a URL that then gets fetched, so this is
      // a validation rule with a job rather than a formality.
      for (const key of ["OL45804W", "..%2F..%2Fetc", "nonsense"]) {
        await as(`/openlibrary/editions/${key}`).expect(400);
      }

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not store anything — the cover is downloaded at POST /books", async () => {
      answerWith(dune);

      await as("/openlibrary/editions/OL7353617M").expect(200);

      // One call, for the metadata. A selection the user abandons in the form
      // must not have left a blob behind.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(requestedUrl()).toContain("/api/books");
    });
  });

  describe("GET /openlibrary/isbn/:isbn (S4.2)", () => {
    it("looks up an ISBN-13 with the punctuation stripped", async () => {
      answerWith({
        "ISBN:9780441013593": { title: "Dune", number_of_pages: 620 },
      });

      const res = await as("/openlibrary/isbn/978-0-441-01359-3").expect(200);

      expect(res.body.title).toBe("Dune");
      // §D13's normaliser, the same one the local duplicate check uses — so
      // both ends of the app agree on what "the same ISBN" means.
      expect(requestedUrl()).toContain("bibkeys=ISBN%3A9780441013593");
    });

    it("accepts ISBN-10 too", async () => {
      answerWith({ "ISBN:0441013597": { title: "Dune" } });

      await as("/openlibrary/isbn/0441013597").expect(200);
    });

    it("answers 404 with a clear message when nothing matches", async () => {
      // Open Library says "no such book" with an empty object and a 200, which
      // would otherwise arrive as a suggestion full of nulls.
      answerWith({});

      const res = await as("/openlibrary/isbn/9780441013593").expect(404);

      expect(res.body.message).toContain("manual");
    });

    it("rejects a number that is not 10 or 13 digits long", async () => {
      await as("/openlibrary/isbn/12345").expect(400);

      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("does not check the control digit", async () => {
      // A mistyped ISBN should come back as "we could not find it", which is
      // both truer and more useful than "invalid ISBN".
      answerWith({ "ISBN:9780441013594": { title: "Ceva" } });

      await as("/openlibrary/isbn/9780441013594").expect(200);
    });
  });

  describe("GET /openlibrary/covers/:key (S4.1)", () => {
    it("serves the image from our own origin", async () => {
      fetchMock.mockResolvedValue(new Response(PNG, { status: 200 }));

      const res = await as("/openlibrary/covers/OL7353617M").expect(200);

      // Labelled by what the bytes are, not by the `.jpg` in the URL we asked
      // for — this gets served back from our origin under that label.
      expect(res.headers["content-type"]).toBe("image/png");
      expect(res.headers["cache-control"]).toContain("max-age=86400");
      expect(Buffer.from(res.body)).toEqual(PNG);
    });

    it("asks for default=false, so a missing cover is a 404 and not a grey box", async () => {
      fetchMock.mockResolvedValue(new Response(PNG, { status: 200 }));

      await as("/openlibrary/covers/OL7353617M").expect(200);

      // Without it the covers host answers 200 with a placeholder, and that
      // placeholder would be stored as though it were a real cover.
      expect(requestedUrl()).toContain("default=false");
      expect(requestedUrl()).toContain("-S.jpg");
    });

    it("answers 404 when the edition has no cover", async () => {
      fetchMock.mockResolvedValue(new Response(null, { status: 404 }));

      await as("/openlibrary/covers/OL7353617M").expect(404);
    });

    it("refuses to serve something that is not an image", async () => {
      fetchMock.mockResolvedValue(
        new Response(Buffer.from("<html>error page</html>"), { status: 200 }),
      );

      await as("/openlibrary/covers/OL7353617M").expect(404);
    });
  });

  it("requires a session on every route, including the image proxy", async () => {
    // An unauthenticated proxy is an open image relay for whoever finds it.
    const server = request(app.getHttpServer());

    await server.get("/openlibrary/search?q=dune").expect(401);
    await server.get("/openlibrary/editions/OL7353617M").expect(401);
    await server.get("/openlibrary/isbn/9780441013593").expect(401);
    await server.get("/openlibrary/covers/OL7353617M").expect(401);
  });
});

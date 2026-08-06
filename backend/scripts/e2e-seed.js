/**
 * Puts the database into a known state for the end-to-end run and prints the
 * session token that reaches it, as `{"userId":…,"token":…}` on stdout.
 *
 * **Why it lives in `backend/`.** It needs Prisma and `JWT_SECRET`, and the
 * frontend is not allowed either — `shared/enums.ts` says outright that the web
 * client never depends on the ORM. So the Playwright suite shells out to this
 * instead of importing it, and the boundary holds.
 *
 * **What it stands in for.** Only the Google login. There is no `@Public()`
 * route that mints a session, and a real OAuth round trip needs a human at a
 * Google prompt — so the token is signed here with the app's own secret. The
 * guard cannot tell it apart from a real one, which is the point: everything
 * past the cookie is the real system.
 *
 * Destructive, but only within its own user: the deletes are scoped to the
 * synthetic `e2e-seed` account, so running this against a development database
 * that also holds real books leaves them alone.
 */
const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const fs = require("node:fs");
const path = require("node:path");

const SEED_GOOGLE_ID = "e2e-seed";

/**
 * Read directly rather than through `@nestjs/config`: this is a script, not an
 * application, and booting a Nest context to learn two values is not a trade
 * worth making.
 */
function readEnv() {
  const file = path.join(__dirname, "..", ".env");

  if (!fs.existsSync(file)) {
    throw new Error(`backend/.env is missing — copy backend/.env.example first`);
  }

  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const at = line.indexOf("=");
        return [
          line.slice(0, at).trim(),
          line
            .slice(at + 1)
            .trim()
            .replace(/^"|"$/g, ""),
        ];
      }),
  );
}

/**
 * Five wishlist books, three of them priced, and two books that are not wishes
 * at all.
 *
 * The shape is the assertion. 42 + 89.50 + 208.50 is 340.00 over 3 of 5, so the
 * total and its coverage are both wrong in a visible way if either the filter
 * or the SQL sum drifts — and the two non-wishlist books are there to be
 * *excluded*, which a sum over the whole library would quietly get wrong.
 */
const BOOKS = [
  { title: "Solaris", author: "Stanisław Lem", genre: "SCIFI", status: "WISHLIST", estimatedPrice: "42.00", totalPages: 204 },
  { title: "Orbitor", author: "Mircea Cărtărescu", genre: "FICTION", status: "WISHLIST", estimatedPrice: "89.50", totalPages: 420 },
  { title: "Gödel, Escher, Bach", author: "Douglas Hofstadter", genre: "SCIENCE", status: "WISHLIST", estimatedPrice: "208.50", totalPages: 777 },
  // Unpriced: counted by the coverage line, absent from the sum.
  { title: "Cartea șoaptelor", author: "Varujan Vosganian", genre: "HISTORICAL", status: "WISHLIST" },
  { title: "Maitreyi", author: "Mircea Eliade", genre: "ROMANCE", status: "WISHLIST" },
  // Not wishes. The second one carries an estimate *and* a paid price, so a
  // total that ignored the status filter would come out 65.00 too high.
  { title: "Dune", author: "Frank Herbert", genre: "SCIFI", status: "READING", pagesRead: 143, totalPages: 620, paidPrice: "59.90", estimatedPrice: "65.00", purchasedOn: new Date("2026-07-01"), startedOn: new Date("2026-07-20") },
  { title: "Fundația", author: "Isaac Asimov", genre: "SCIFI", status: "FINISHED", pagesRead: 255, totalPages: 255, rating: 5, paidPrice: "38.00", purchasedOn: new Date("2026-05-02"), finishedOn: new Date("2026-06-11") },
];

async function main() {
  const env = readEnv();
  const prisma = new PrismaClient({
    datasources: { db: { url: env.DATABASE_URL } },
  });

  try {
    const user = await prisma.user.upsert({
      where: { googleId: SEED_GOOGLE_ID },
      update: {},
      create: {
        googleId: SEED_GOOGLE_ID,
        email: "e2e@example.com",
        name: "Cititorul de test",
      },
    });

    await prisma.book.deleteMany({ where: { userId: user.id } });
    await prisma.book.createMany({
      data: BOOKS.map((book) => ({ ...book, userId: user.id })),
    });

    // `ver` is not optional: `JwtStrategy` compares it against the stored
    // `tokenVersion` and refuses a token that omits it, which is what makes
    // logout able to revoke. A seed that signed without it would produce a
    // cookie the guard rejects, and every spec would fail on an unexplained
    // 401.
    const token = jwt.sign(
      { sub: user.id, ver: user.tokenVersion },
      env.JWT_SECRET,
      { expiresIn: "1d" },
    );

    process.stdout.write(JSON.stringify({ userId: user.id, token }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

import { expect, openEditForm, test } from "./fixtures.js";

/**
 * S4.3's resize, which only a real browser can execute.
 *
 * jsdom has neither `createImageBitmap` nor a canvas, so in the unit suite
 * `resizeCover` always takes its fallback path and uploads the original file.
 * The arithmetic is covered by `coverTargetSize`'s own tests; the *drawing* —
 * decode, scale, re-encode — has no coverage anywhere else, and it is the part
 * §D18 depends on: covers are kept as blobs inside the database on the
 * argument that they are tens of kilobytes each.
 *
 * So this test uploads something genuinely large and asserts the bytes on the
 * wire are small. It is the only place that claim is checked.
 *
 * Requires the stack to be up — see `npm run test:e2e`.
 */

test.describe("uploading a cover (S4.3)", () => {
  test("resizes a camera-sized photograph before it goes", async ({
    page,
    seed: _seed,
  }) => {
    const original = await hugePng();

    // Past the server's 5MB ceiling, so if the resize does not happen this
    // upload is refused outright rather than merely being wasteful.
    expect(original.byteLength).toBeGreaterThan(5 * 1024 * 1024);

    await page.goto("/");

    // Any book will do; the upload lives in the edit dialog because the route
    // addresses a book by id.
    await openEditForm(page, "Dune");

    await page.getByLabel(/Încarcă o imagine/).setInputFiles({
      name: "poza.png",
      mimeType: "image/png",
      buffer: original,
    });

    // Succeeding at all is already most of the claim: the server refuses
    // anything over 5MB, so an unresized upload could not have got here.
    await expect(page.getByText("Coperta a fost înlocuită.")).toBeVisible({
      timeout: 20_000,
    });

    // Measured where it matters — the bytes now in the database. The request
    // body cannot be read back for this: Playwright does not capture a `Blob`
    // post body, and the stored size is the number §D18's argument is about
    // anyway.
    const src = await page.getByAltText(/Coperta cărții/).getAttribute("src");
    const stored = await page.request.get(src as string);
    const size = (await stored.body()).byteLength;

    expect(size).toBeLessThan(500 * 1024);
    expect(size).toBeLessThan(original.byteLength / 10);
  });

  test("shows the new cover immediately, past a year-long cache (§D26)", async ({
    page,
    seed: _seed,
  }) => {
    await page.goto("/");
    await openEditForm(page, "Dune");

    await page.getByLabel(/Încarcă o imagine/).setInputFiles({
      name: "poza.png",
      mimeType: "image/png",
      buffer: await hugePng(),
    });

    await expect(page.getByText("Coperta a fost înlocuită.")).toBeVisible({
      timeout: 15_000,
    });

    // The book in hand still carries the old version, and that URL is
    // `immutable` for a year — drawing it again would look like nothing
    // happened.
    const cover = page.getByAltText(/Coperta cărții/);
    await expect(cover).toHaveAttribute("src", /\/covers\/.+\?v=\d+/);
  });
});

/**
 * A large PNG built without an image library: a minimal, valid, *uncompressed*
 * PNG of 2000×2000 random-ish pixels. Deflate's stored blocks let this be
 * assembled with nothing but zlib's framing, and the result is around 12MB —
 * comfortably past the 5MB ceiling if it were sent as-is, which is the point.
 */
async function hugePng(): Promise<Buffer> {
  const { deflateSync } = await import("node:zlib");
  const size = 2000;

  const raw = Buffer.alloc(size * (size * 3 + 1));
  let offset = 0;
  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0; // filter: none
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      raw[offset] = (x * 7 + y) % 255;
      raw[offset + 1] = (x * 13 + y * 3) % 255;
      raw[offset + 2] = (x * 29 + y * 5) % 255;
      offset += 3;
    }
  }

  const chunk = (type: string, data: Buffer): Buffer => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.byteLength);
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 0 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }

  return (crc ^ 0xffffffff) >>> 0;
}

import fs from "node:fs";
import path from "node:path";

/**
 * §D43 — a video of a barcode, for the browser to "see".
 *
 * Chromium can replace a camera with the contents of a Y4M file
 * (`--use-file-for-fake-video-capture`), which is what makes an honest test of
 * this feature possible: the app opens a real `MediaStream`, a real decoder
 * reads real frames, and the only synthetic thing is the light.
 *
 * **Generated rather than committed.** A checked-in video would be a few hundred
 * kilobytes of binary whose contents nobody could review — and the interesting
 * part is precisely *how* the bars are laid out, which is source. So the EAN-13
 * encoding is written out below and the file is produced during global setup,
 * into the gitignored `test-results/`.
 *
 * No image or video library is involved. Y4M is a header and then raw planes,
 * and a black-and-white image needs only the luma plane — the two chroma planes
 * are a constant, which is what "no colour" means in I420.
 */

/** The three alphabets of EAN-13, as the specification gives them. */
const L = [
  "0001101", "0011001", "0010011", "0111101", "0100011",
  "0110001", "0101111", "0111011", "0110111", "0001011",
];

const G = [
  "0100111", "0110011", "0011011", "0100001", "0011101",
  "0111001", "0000101", "0010001", "0001001", "0010111",
];

/** The right-hand alphabet is the left-hand one inverted, and is defined that way. */
const R = L.map((pattern) => [...pattern].map((bit) => (bit === "0" ? "1" : "0")).join(""));

/**
 * Which of the two left-hand alphabets each of digits 2–7 uses.
 *
 * This is where the thirteenth digit hides: EAN-13 only has room to draw twelve,
 * so the first one is not printed as bars at all — it is encoded in this choice
 * of parities. A decoder recovers it by recognising the pattern.
 */
const PARITY = [
  "LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG",
  "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL",
];

/** The 95 modules of an EAN-13 symbol: 1 is a bar, 0 is a space. */
export function ean13Modules(isbn: string): string {
  const digits = [...isbn.replace(/[^0-9]/g, "")].map(Number);

  if (digits.length !== 13) {
    throw new Error(`EAN-13 needs 13 digits, got ${String(digits.length)}`);
  }

  const parity = PARITY[digits[0]];

  const left = digits
    .slice(1, 7)
    .map((digit, index) => (parity[index] === "L" ? L[digit] : G[digit]))
    .join("");

  const right = digits.slice(7).map((digit) => R[digit]).join("");

  // Start guard, left half, centre guard, right half, end guard.
  return `101${left}01010${right}101`;
}

const WIDTH = 480;
const HEIGHT = 240;
const MODULE_PX = 4;
const BAR_HEIGHT = 150;
/** Frames in the file. Chromium loops it, so this only has to outlast a decode. */
const FRAMES = 10;

/**
 * Write a Y4M whose every frame is the barcode, centred on white.
 *
 * The margins are not decoration: EAN-13 requires a quiet zone either side, and
 * a decoder handed a symbol flush against the edge of the frame will refuse it.
 * Centring a 380px symbol in 480px leaves 50px each side, comfortably more than
 * the ten modules the specification asks for.
 */
export function writeBarcodeVideo(isbn: string, file: string): string {
  const modules = ean13Modules(isbn);
  const barsWidth = modules.length * MODULE_PX;
  const left = Math.floor((WIDTH - barsWidth) / 2);
  const top = Math.floor((HEIGHT - BAR_HEIGHT) / 2);

  // Luma: 235 for white and 16 for black rather than 255/0 — those are the
  // limits of the studio-swing range a camera actually produces, and staying
  // inside it keeps this a plausible frame rather than an ideal one.
  const luma = Buffer.alloc(WIDTH * HEIGHT, 235);

  for (let y = top; y < top + BAR_HEIGHT; y += 1) {
    for (let x = 0; x < barsWidth; x += 1) {
      if (modules[Math.floor(x / MODULE_PX)] === "1") {
        luma[y * WIDTH + left + x] = 16;
      }
    }
  }

  // Neutral chroma at quarter resolution: I420 stores one U and one V sample
  // per 2×2 block of luma.
  const chroma = Buffer.alloc((WIDTH / 2) * (HEIGHT / 2), 128);

  const parts: Buffer[] = [
    Buffer.from(`YUV4MPEG2 W${String(WIDTH)} H${String(HEIGHT)} F25:1 Ip A1:1 C420\n`),
  ];

  for (let frame = 0; frame < FRAMES; frame += 1) {
    parts.push(Buffer.from("FRAME\n"), luma, chroma, chroma);
  }

  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat(parts));

  return file;
}

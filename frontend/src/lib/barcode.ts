/**
 * §D43 — decoding one barcode, from whichever engine this browser can offer.
 *
 * Two engines, one interface. `BarcodeDetector` is built into some browsers and
 * costs nothing; where it is missing, `barcode-detector`'s ponyfill supplies the
 * same API on top of a WebAssembly build of ZXing. The split matters because of
 * *which* browsers: the native one is present on Android Chrome and on Chrome
 * for macOS, and absent on iOS Safari, Firefox, and Chrome for Windows and
 * Linux. A book barcode is something a person scans holding a phone, and on
 * iOS every browser is Safari's engine — so the fallback is not an edge case,
 * it is the likeliest path.
 *
 * **The wasm is loaded lazily and served from our own origin.** Both halves are
 * deliberate. It is a megabyte, so it must not sit in the bundle every visitor
 * downloads to read their library; and `zxing-wasm` would otherwise fetch it
 * from a CDN at runtime, which is exactly the "zero cereri către alte gazde"
 * rule (docs/kobo_design.md §Buget de pagină) that the whole Open Library proxy
 * exists to honour. Vite emits it under `/assets` instead, where nginx already
 * serves it `immutable`.
 */

/**
 * The part of `BarcodeDetector` this app uses. Declared rather than imported
 * from `lib.dom`, because TypeScript's DOM library does not have it — it is not
 * a standard yet, which is the same reason the ponyfill exists at all.
 */
export interface BarcodeScanner {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}

/**
 * The only format worth asking for. Book barcodes are EAN-13 in the Bookland
 * range, and narrowing the list is not just tidiness: every extra symbology is
 * more work per frame on a phone, and more ways to lock onto something that is
 * not the ISBN. `isScannedIsbn` in `shared/` then rejects whatever EAN-13 is not
 * a book's — an ISSN, most of all.
 */
const FORMATS = ["ean_13"] as const;

/**
 * Why scanning is unavailable, when it is — each of these needs different words
 * on screen, which is why this is a reason rather than a boolean.
 *
 * `insecure-context` is the one worth naming explicitly. `navigator.mediaDevices`
 * is simply `undefined` outside a secure context, so the honest failure is
 * indistinguishable from "this browser has no camera API" unless it is checked
 * for separately — and it has a cause a developer can act on. It is also the
 * shape local testing takes: the app on `http://localhost:5173` is a secure
 * context by origin and scans fine, while the same app reached from a phone at
 * `http://192.168.x.x:5173` has no camera at all.
 */
export type ScanUnavailable = "insecure-context" | "no-camera-api";

export function scanUnavailableReason(): ScanUnavailable | null {
  // `isSecureContext` is the direct question; asking it first keeps the answer
  // specific rather than reporting the symptom.
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "insecure-context";
  }

  if (
    typeof navigator === "undefined" ||
    navigator.mediaDevices?.getUserMedia === undefined
  ) {
    return "no-camera-api";
  }

  return null;
}

interface NativeBarcodeDetector {
  new (options: { formats: readonly string[] }): BarcodeScanner;
  getSupportedFormats(): Promise<string[]>;
}

/**
 * The native detector, but only if it can actually read a book.
 *
 * A `BarcodeDetector` that exists is not the same as one that does EAN-13: the
 * supported list comes from the underlying platform, so it varies by OS and
 * version. Asking is cheap and the alternative is a scanner that opens the
 * camera and never matches anything.
 */
async function nativeScanner(): Promise<BarcodeScanner | null> {
  const Detector = (globalThis as { BarcodeDetector?: NativeBarcodeDetector })
    .BarcodeDetector;

  if (Detector === undefined) {
    return null;
  }

  try {
    const supported = await Detector.getSupportedFormats();

    if (!FORMATS.every((format) => supported.includes(format))) {
      return null;
    }

    return new Detector({ formats: FORMATS });
  } catch {
    // A detector that throws while being asked what it can do is not one to
    // hand a camera to; the ponyfill below is a working answer either way.
    return null;
  }
}

/**
 * A scanner, whichever kind this browser can give us.
 *
 * The dynamic `import()` is what keeps the megabyte out of the main bundle —
 * Vite splits it into its own chunk, fetched when someone first presses the
 * scan button on a browser that needs it, and never by anyone else.
 */
export async function loadScanner(): Promise<BarcodeScanner> {
  const native = await nativeScanner();

  if (native !== null) {
    return native;
  }

  const [{ BarcodeDetector, setZXingModuleOverrides }, { default: wasmUrl }] =
    await Promise.all([
      import("barcode-detector/ponyfill"),
      // `?url` asks Vite for the emitted asset's path rather than its contents,
      // which is what turns the CDN default into a file on our own origin.
      import("zxing-wasm/reader/zxing_reader.wasm?url"),
    ]);

  setZXingModuleOverrides({ locateFile: () => wasmUrl });

  // Spread rather than passed through: the ponyfill's signature asks for a
  // mutable array, and `FORMATS` is `as const` so that the native path above
  // can compare against it without copying.
  return new BarcodeDetector({ formats: [...FORMATS] });
}

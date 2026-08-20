import { screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IsbnScanner } from "./IsbnScanner";
import { renderWithQuery } from "../../test/helpers";

/**
 * §D43 — the scanner, with the camera and the decoder both stubbed.
 *
 * jsdom has neither `getUserMedia` nor `BarcodeDetector`, so there is no
 * version of this file that exercises a real camera; `e2e/isbn-scan.spec.ts`
 * does that against Chromium with a fake video device. What is worth pinning
 * here is everything around the decode: which codes are accepted, and — the
 * part that has no other coverage anywhere — that the camera is released on
 * every path out, including the one where the stream arrives after the
 * component is gone.
 */

const VALID = "9780441013593"; // Dune
const ISSN = "9771234567003"; // valid EAN-13, not a book
const BAD_CHECKSUM = "9780441013594";

let detected: string[] = [];
let stopped: number;
let getUserMedia: ReturnType<typeof vi.fn>;

vi.mock("../../lib/barcode", async () => {
  const actual =
    await vi.importActual<typeof import("../../lib/barcode")>("../../lib/barcode");

  return {
    ...actual,
    // The decoder is the seam: the component's job is what it does with the
    // answer, not how the answer was computed.
    loadScanner: () =>
      Promise.resolve({
        detect: () =>
          Promise.resolve(detected.map((rawValue) => ({ rawValue }))),
      }),
  };
});

/** A stream whose tracks count their own stops, which is the assertion. */
function fakeStream(): MediaStream {
  return {
    getTracks: () => [
      {
        stop: () => {
          stopped += 1;
        },
      },
    ],
  } as unknown as MediaStream;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  detected = [];
  stopped = 0;
  getUserMedia = vi.fn(() => Promise.resolve(fakeStream()));

  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("navigator", {
    ...navigator,
    mediaDevices: { getUserMedia },
  });

  // jsdom implements neither, and `play()` rejecting is not what is under test.
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", {
    configurable: true,
    get: () => 4,
  });
  // On `HTMLVideoElement`, not `HTMLMediaElement`: jsdom defines `videoWidth` on
  // the subclass, and an own property there shadows anything put on the parent —
  // so the parent version is never read and every frame looks 0px wide.
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
    configurable: true,
    get: () => 640,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function renderScanner() {
  const onFound = vi.fn();
  const onClose = vi.fn();
  const view = renderWithQuery(<IsbnScanner onFound={onFound} onClose={onClose} />);

  return { onFound, onClose, ...view };
}

describe("IsbnScanner — what it reports (§D43)", () => {
  it("reports a book's ISBN", async () => {
    detected = [VALID];
    const { onFound } = renderScanner();

    await waitFor(() => expect(onFound).toHaveBeenCalledWith(VALID));
  });

  it("ignores an ISSN with a valid checksum", async () => {
    detected = [ISSN];
    const { onFound } = renderScanner();

    await screen.findByText(/Arată codul de bare/);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onFound).not.toHaveBeenCalled();
  });

  it("ignores a misread barcode", async () => {
    detected = [BAD_CHECKSUM];
    const { onFound } = renderScanner();

    await screen.findByText(/Arată codul de bare/);
    await vi.advanceTimersByTimeAsync(1000);

    expect(onFound).not.toHaveBeenCalled();
  });

  it("picks the book's barcode out of a frame holding two", async () => {
    // The real shape of the problem: the price add-on is right next to the ISBN
    // and both are in view.
    detected = ["54495", VALID];
    const { onFound } = renderScanner();

    await waitFor(() => expect(onFound).toHaveBeenCalledWith(VALID));
  });

  it("reports once, not once per frame", async () => {
    detected = [VALID];
    const { onFound } = renderScanner();

    await waitFor(() => expect(onFound).toHaveBeenCalled());
    await vi.advanceTimersByTimeAsync(2000);

    expect(onFound).toHaveBeenCalledTimes(1);
  });

  it("asks for the rear camera", async () => {
    detected = [];
    renderScanner();

    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    expect(getUserMedia).toHaveBeenCalledWith({
      video: { facingMode: "environment" },
    });
  });
});

describe("IsbnScanner — releasing the camera (§D43)", () => {
  it("stops the stream when it unmounts", async () => {
    detected = [];
    const { unmount } = renderScanner();

    await screen.findByText(/Arată codul de bare/);
    unmount();

    expect(stopped).toBe(1);
  });

  it("stops the stream after a successful scan", async () => {
    detected = [VALID];
    const { onFound } = renderScanner();

    await waitFor(() => expect(onFound).toHaveBeenCalled());

    // Stopped by the scan itself, before the parent has had a chance to
    // unmount it — otherwise the light stays on until the dialog closes.
    expect(stopped).toBe(1);
  });

  it("stops a stream that arrives after it has already unmounted", async () => {
    // The leak this guards: `getUserMedia` resolves when the user answers the
    // permission prompt, which can be long after they closed the dialog. There
    // is no component left to run a cleanup, so the async path has to check.
    detected = [];
    let grant: (stream: MediaStream) => void = () => undefined;
    getUserMedia.mockImplementation(
      () =>
        new Promise<MediaStream>((resolve) => {
          grant = resolve;
        }),
    );

    const { unmount } = renderScanner();
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());

    unmount();
    grant(fakeStream());

    await waitFor(() => expect(stopped).toBe(1));
  });
});

describe("IsbnScanner — when it cannot run (§D43)", () => {
  it("says so plainly when the permission is refused", async () => {
    const denied = new Error("nope");
    denied.name = "NotAllowedError";
    getUserMedia.mockRejectedValue(denied);

    renderScanner();

    expect(await screen.findByText(/N-am primit acces la cameră/)).toBeInTheDocument();
  });

  it("distinguishes no camera from a refusal", async () => {
    const missing = new Error("none");
    missing.name = "NotFoundError";
    getUserMedia.mockRejectedValue(missing);

    renderScanner();

    expect(await screen.findByText(/Nu găsesc nicio cameră/)).toBeInTheDocument();
  });

  it("names HTTPS as the reason outside a secure context", async () => {
    // The failure a developer hits first, testing from a phone against a LAN
    // address: `mediaDevices` is simply absent, and without this the message
    // would blame the browser.
    vi.stubGlobal("isSecureContext", false);

    renderScanner();

    expect(await screen.findByText(/doar pe HTTPS/)).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("never opens the camera when there is no API for it", async () => {
    vi.stubGlobal("navigator", { ...navigator, mediaDevices: undefined });

    renderScanner();

    expect(
      await screen.findByText(/Browserul acesta nu dă acces la cameră/),
    ).toBeInTheDocument();
  });
});

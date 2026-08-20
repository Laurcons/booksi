import { useEffect, useRef, useState } from "react";
import { isScannedIsbn } from "@bookcsi/shared";
import {
  loadScanner,
  scanUnavailableReason,
  type ScanUnavailable,
} from "../../lib/barcode";
import { useT } from "../../i18n/locale-context";
import type { MessageKey } from "../../i18n/catalog";

/**
 * §D43 — the camera, pointed at the back of a book.
 *
 * It reports an ISBN and nothing else. Everything that happens next — the
 * duplicate warning, the Open Library lookup, the fields filling in — is S4.2,
 * already built and reached simply by writing the digits into the ISBN input.
 * That is the whole reason this component is worth so little code: it is a
 * different way to type thirteen characters, not a second import path.
 *
 * **A section inside the dialog, not a layer over it.** The form already lives
 * in `Modal` with a focus trap; a second overlay would be two traps arguing
 * about the same focus. This renders in the flow above the ISBN field instead,
 * which also keeps the field visible while scanning, so the value appearing in
 * it is the feedback.
 */

/** How often a frame is examined. */
const FRAME_INTERVAL_MS = 250;

type State =
  | { kind: "starting" }
  | { kind: "scanning" }
  | { kind: "unavailable"; reason: ScanUnavailable }
  | { kind: "denied" }
  | { kind: "no-camera" }
  | { kind: "broken" };

export function IsbnScanner({
  onFound,
  onClose,
}: {
  /** A valid, Bookland-prefixed ISBN-13. Never anything else. */
  onFound: (isbn: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<State>({ kind: "starting" });

  /**
   * `onFound` in a ref so the effect below does not depend on it.
   *
   * The caller passes an inline arrow — anything else would be unusual in this
   * codebase — so a dependency on it would re-run the effect on every render of
   * the form, which means stopping and restarting the camera on every keystroke
   * in a neighbouring field.
   */
  const found = useRef(onFound);
  found.current = onFound;

  useEffect(() => {
    const unavailable = scanUnavailableReason();

    if (unavailable !== null) {
      setState({ kind: "unavailable", reason: unavailable });
      return;
    }

    /**
     * Everything that has to be torn down, and the flag that says whether the
     * teardown has already happened.
     *
     * `cancelled` is not defensive noise. `getUserMedia` resolves *after* the
     * user answers the permission prompt, which can easily be after this
     * component is gone — they press the button, think better of it, and close
     * the dialog while the prompt is still up. The stream then arrives with
     * nobody left to stop it, and the camera light stays on until the tab is
     * closed. So the cleanup marks itself as having run, and the async path
     * checks that before keeping anything.
     */
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;

    const stop = () => {
      cancelled = true;
      clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    const start = async () => {
      try {
        // The rear camera, where a phone has two. A `facingMode` that cannot be
        // honoured is not an error — a laptop simply gives its only camera.
        const opened = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });

        if (cancelled) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }

        stream = opened;

        const scanner = await loadScanner();

        if (cancelled) {
          opened.getTracks().forEach((track) => track.stop());
          return;
        }

        const element = video.current;

        if (element === null) {
          stop();
          return;
        }

        element.srcObject = opened;
        // iOS Safari will not play an inline stream without this pair, and
        // silently shows a black rectangle instead.
        element.muted = true;
        await element.play().catch(() => undefined);

        setState({ kind: "scanning" });

        timer = setInterval(() => {
          // A frame before the first one has decoded has zero width, and
          // `detect` on it throws rather than returning nothing.
          if (element.readyState < 2 || element.videoWidth === 0) {
            return;
          }

          void scanner
            .detect(element)
            .then((codes) => {
              const hit = codes.find((code) => isScannedIsbn(code.rawValue));

              if (hit === undefined || cancelled) {
                return;
              }

              // Stop before reporting: the caller closes this component, and a
              // frame decoded in between would report a second time.
              stop();
              found.current(hit.rawValue);
            })
            .catch(() => {
              // One unreadable frame is the ordinary case — glare, motion, a
              // hand in the way. The next one is 250ms away.
            });
        }, FRAME_INTERVAL_MS);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setState(failureState(error));
      }
    };

    void start();

    return stop;
  }, []);

  return (
    <div className="space-y-2 rounded-lg border border-line bg-surface-1 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-2">{t(MESSAGE[state.kind](state))}</p>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
        >
          {t("common.close")}
        </button>
      </div>

      {/* Kept mounted through `starting` so that `video.current` exists by the
          time the stream is ready, and dropped once scanning is impossible so
          the panel does not show a black rectangle under an error. */}
      {(state.kind === "starting" || state.kind === "scanning") && (
        <video
          ref={video}
          // Without `playsInline` iOS takes the video fullscreen, which covers
          // the form the scan is filling in.
          playsInline
          muted
          aria-label={t("scan.videoLabel")}
          className="aspect-video w-full rounded-md bg-surface-3 object-cover"
        />
      )}
    </div>
  );
}

/**
 * Which failure it was. Worth distinguishing: a refused permission is undone in
 * the browser's own UI and the user has to be told that is where to go, while a
 * missing camera is nothing they can act on at all.
 */
function failureState(error: unknown): State {
  const name = error instanceof Error ? error.name : "";

  if (name === "NotAllowedError" || name === "SecurityError") {
    return { kind: "denied" };
  }

  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return { kind: "no-camera" };
  }

  return { kind: "broken" };
}

/**
 * A catalog key per state (§D44 — it was one Romanian sentence per state before).
 * Each of these says what happened *and* leaves the manual field alone: Sprint
 * 4's degradation rule is that the typed path stays completely usable, and a
 * scanner is the most skippable convenience in the form.
 */
const MESSAGE: Record<State["kind"], (state: State) => MessageKey> = {
  starting: () => "scan.starting",
  scanning: () => "scan.instruction",
  unavailable: (state) =>
    state.kind === "unavailable" && state.reason === "insecure-context"
      ? "scan.needsHttps"
      : "scan.unsupported",
  denied: () => "scan.denied",
  "no-camera": () => "scan.noCamera",
  broken: () => "scan.failed",
};

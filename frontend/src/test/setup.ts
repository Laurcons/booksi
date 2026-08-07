import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

/**
 * jsdom has no `ResizeObserver`, and Recharts' `ResponsiveContainer` (S6.2)
 * constructs one on mount. The stub reports nothing, which is the truth in a
 * DOM with no layout — the chart renders at zero size and the tests assert on
 * its table view instead, which is the accessible surface anyway.
 */
class NoLayoutResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

globalThis.ResizeObserver ??=
  NoLayoutResizeObserver as unknown as typeof ResizeObserver;

// Vitest does not unmount between tests on its own, and a leftover dialog from
// the previous test is the classic source of a passing suite that tests
// nothing.
afterEach(() => {
  cleanup();
  // Every suite stubs `fetch`; leaking one into the next file would make the
  // order of the tests part of their meaning.
  vi.unstubAllGlobals();
});

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// Vitest does not unmount between tests on its own, and a leftover dialog from
// the previous test is the classic source of a passing suite that tests
// nothing.
afterEach(() => {
  cleanup();
  // Every suite stubs `fetch`; leaking one into the next file would make the
  // order of the tests part of their meaning.
  vi.unstubAllGlobals();
});

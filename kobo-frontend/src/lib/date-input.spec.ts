import { describe, expect, it } from "vitest";
import { normalizeDateInput } from "./date-input";

describe("normalizeDateInput", () => {
  it("is null for an empty field — a cleared date, not an error", () => {
    expect(normalizeDateInput("")).toBeNull();
    expect(normalizeDateInput("   ")).toBeNull();
  });

  it("passes the labelled format straight through", () => {
    expect(normalizeDateInput("2026-08-06")).toBe("2026-08-06");
  });

  it("accepts the everyday Romanian day-first format with dots", () => {
    expect(normalizeDateInput("6.8.2026")).toBe("2026-08-06");
  });

  it("accepts the same format with slashes and zero-padding", () => {
    expect(normalizeDateInput("06/08/2026")).toBe("2026-08-06");
  });

  it("passes an unrecognizable shape through unchanged, for the API to reject", () => {
    expect(normalizeDateInput("nu știu")).toBe("nu știu");
  });

  it("does not invent validity — an unreal day passes through for the server to catch", () => {
    // 31 February; this module only reshapes the string, it does not judge it.
    expect(normalizeDateInput("31.02.2026")).toBe("2026-02-31");
  });
});

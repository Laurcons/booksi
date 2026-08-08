import { describe, expect, it } from "vitest";
import { STATUS_VALUES } from "@bookcsi/shared";
import { render } from "./html";
import { statusPill, statusStyle } from "./status-style";

describe("statusStyle", () => {
  it("gives every status a border style, per §Status", () => {
    for (const status of STATUS_VALUES) {
      expect(statusStyle(status).border).toEqual(expect.any(String));
    }
  });

  it("marks Citesc as the one solid, thick border — the active state", () => {
    expect(statusStyle("READING").border).toContain("solid");
    expect(statusStyle("READING").border).not.toContain("dotted");
  });

  it("marks Terminat as double, distinct from every other status", () => {
    const others = STATUS_VALUES.filter((s) => s !== "FINISHED").map(
      (s) => statusStyle(s).border,
    );

    expect(statusStyle("FINISHED").border).toContain("double");
    expect(others.some((b) => b.includes("double"))).toBe(false);
  });

  it("is the only pill whose ink is not the primary black", () => {
    const secondary = STATUS_VALUES.filter(
      (s) => statusStyle(s).color !== statusStyle("WISHLIST").color,
    );

    expect(secondary).toEqual(["ABANDONED"]);
  });
});

describe("statusPill", () => {
  it("carries the Romanian label, never the enum value", () => {
    expect(render(statusPill("READING"))).toContain("Citesc");
    expect(render(statusPill("READING"))).not.toContain("READING");
  });

  it("has no background fill — the border alone carries the state", () => {
    expect(render(statusPill("READING"))).not.toMatch(/background/);
  });
});

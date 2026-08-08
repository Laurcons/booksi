import { describe, expect, it } from "vitest";
import { html } from "./html";
import { renderPage } from "./page";

describe("renderPage", () => {
  const rendered = renderPage({
    title: "Test",
    body: html`<h1>Titlu</h1>
      <p>Text.</p>
      <a class="btn" href="/undeva">Continuă</a>`,
  });

  it("ships zero JavaScript — §Buget de pagină's one absolute rule", () => {
    expect(rendered).not.toContain("<script");
  });

  it("stays well under the 50KB HTML+CSS budget for a single page", () => {
    expect(Buffer.byteLength(rendered, "utf8")).toBeLessThan(50 * 1024);
  });

  it("declares no custom properties — none exist on the device (§P4)", () => {
    expect(rendered).not.toMatch(/--[a-z-]+\s*:/);
  });

  it("writes no transparency — dithering makes rgba unpredictable (§Culoare)", () => {
    expect(rendered).not.toContain("rgba(");
  });

  it("sizes the touch target at the measured 9mm minimum, not a guess", () => {
    expect(rendered).toContain("min-height: 106px");
    expect(rendered).toContain("min-width: 106px");
  });

  it("draws rules and accents at their corrected (webPx) width, not a bare 1px", () => {
    expect(rendered).not.toMatch(/border(-top)?: 1px solid/);
    expect(rendered).toContain("border-top: 3px solid");
  });

  it("includes the page content untouched", () => {
    expect(rendered).toContain("<h1>Titlu</h1>");
    expect(rendered).toContain('class="btn" href="/undeva"');
  });
});

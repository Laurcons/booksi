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

  it("sizes the touch target at the recalibrated 9mm minimum, not a guess", () => {
    expect(rendered).toContain("min-height: 53px");
    expect(rendered).toContain("min-width: 53px");
  });

  it("draws rules and accents at their corrected (webPx) width, not a bare 1px", () => {
    expect(rendered).not.toMatch(/border(-top)?: 1px solid/);
    expect(rendered).toContain("border-top: 2px solid");
  });

  it("includes the page content untouched", () => {
    expect(rendered).toContain("<h1>Titlu</h1>");
    expect(rendered).toContain('class="btn" href="/undeva"');
  });

  it("renders no nav band when no page is marked active — the pairing pages' case", () => {
    expect(rendered).not.toContain("<nav");
  });
});

describe("the primary-button treatment", () => {
  const rendered = renderPage({
    title: "Test",
    body: html`<a class="btn btn-primary" href="/undeva">Salvează</a>`,
  });

  it("is the one place a fill and a rounded corner replace the outline", () => {
    expect(rendered).toContain(".btn-primary");
    expect(rendered).toMatch(/\.btn-primary\s*\{[^}]*background: #E3B04B/);
    expect(rendered).toMatch(/\.btn-primary\s*\{[^}]*border-radius: \d+px/);
  });

  it("shadows flat, with no blur — §P3 measured the device cannot render one", () => {
    // Three lengths (offset-x, offset-y, blur) with blur pinned at 0 — a
    // fourth, non-zero value here would be a shadow this panel cannot show.
    expect(rendered).toMatch(/box-shadow: \d+px \d+px 0 #000000/);
  });
});

describe("the active nav marker", () => {
  it("is the accent colour, not plain black, now that §Culoare allows it here", () => {
    const rendered = renderPage({ title: "Test", activeNav: "Cărți", body: html`<p>x</p>` });

    expect(rendered).toMatch(/\.nav a\[aria-current="page"\]\s*\{[^}]*border-color: #E3B04B/);
  });
});

describe("renderPage with a nav band", () => {
  const rendered = renderPage({
    title: "Test",
    activeNav: "Cărți",
    body: html`<p>Text.</p>`,
  });

  it("marks the active destination with aria-current, and no other", () => {
    expect(rendered).toContain('<a href="/books" aria-current="page">Cărți</a>');
    expect(rendered).not.toMatch(/aria-current="false"/);
    expect(rendered).not.toMatch(/aria-current=""/);
  });

  it("shows every unbuilt destination as disabled text, not a dead link", () => {
    expect(rendered).toContain("<span>Galerie</span>");
    expect(rendered).not.toContain('href="null"');
  });
});

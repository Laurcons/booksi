import { describe, expect, it } from "vitest";
import { escapeHtml, html, raw, render } from "./html";

describe("html", () => {
  it("escapes an interpolated value", () => {
    const title = '<script>alert("x")</script>';

    expect(render(html`<h1>${title}</h1>`)).toBe(
      "<h1>&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;</h1>",
    );
  });

  it("escapes single quotes, because attributes are written both ways", () => {
    // A book title with an apostrophe inside a single-quoted attribute is the
    // realistic version of this: `title='...'` would end early.
    expect(escapeHtml("L'Étranger")).toBe("L&#39;Étranger");
  });

  it("passes nested markup through without double-escaping it", () => {
    const inner = html`<em>Dune</em>`;

    expect(render(html`<p>${inner}</p>`)).toBe("<p><em>Dune</em></p>");
  });

  it("joins an array, so a list of rows needs no join at the call site", () => {
    const items = ["a", "b"].map((letter) => html`<li>${letter}</li>`);

    expect(render(html`<ul>${items}</ul>`)).toBe("<ul><li>a</li><li>b</li></ul>");
  });

  it("renders a missing page count as nothing, not as the word null", () => {
    // §D4: `totalPages` is absent often enough that the template should not
    // have to guard every read of it.
    expect(render(html`<span>${null}</span>`)).toBe("<span></span>");
    expect(render(html`<span>${undefined}</span>`)).toBe("<span></span>");
  });

  it("keeps zero, which is a real page count", () => {
    expect(render(html`<span>${0}</span>`)).toBe("<span>0</span>");
  });

  it("drops false so a conditional can be written inline", () => {
    const showBar = false;

    expect(render(html`<p>${showBar && html`<b>bar</b>`}</p>`)).toBe("<p></p>");
  });

  it("trusts raw(), which is the only way to inject markup", () => {
    expect(render(html`${raw("<br />")}`)).toBe("<br />");
  });
});

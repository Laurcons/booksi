/**
 * The one page on this surface besides `/probe` that ships a script — see
 * `docs/kobo_design.md` §Buget de pagină for the amended rule this satisfies:
 * progressive enhancement only, ES5, no `fetch`/`Promise`, and only on top of
 * a page that is already complete without it.
 *
 * That last part is load-bearing here specifically. The HTML this script
 * enhances renders all thirteen fields in one scrolling page — that is the
 * whole form, and it stays correct with this script entirely absent. What
 * the script adds is sectioning: it groups the existing `.wizard-section`
 * blocks, shows one at a time, and wires Next/Back between them, so a
 * capable browser gets a page that never scrolls instead of one long one.
 * Nothing here talks to the network — the only request this page ever makes
 * is the form's own native submit, on whichever section holds the button.
 *
 * ES5, not the ES3 discipline `probe-script.ts` holds itself to: that
 * document was written to survive not knowing anything about the engine.
 * This one is written *after* knowing — `/probe`'s report confirmed
 * `addEventListener`, `querySelectorAll`, `createElement`/`appendChild`, and
 * plain `var`/`function` all parse and run on the device, so there is no
 * reason to write more defensively than that confirmed floor. What stays
 * banned is everything the report found missing: `let`/`const`, arrow
 * functions, template literals, `class`, destructuring, spread, and
 * `async`/`await` — a parse error in any of those takes the whole script
 * down, silently, which is exactly why the no-JS form underneath it is the
 * real page and this is only ever an enhancement on top.
 */
export const BOOK_FORM_SCRIPT = `
(function () {
  if (!document.querySelectorAll) { return; }

  var sections = document.querySelectorAll(".wizard-section");
  if (sections.length < 2) { return; }

  var total = sections.length;
  var current = 0;
  var i;

  // A validation failure re-renders the whole page with every error already
  // in place, in whichever section its field lives — including one this
  // script is about to hide. Opening on the first section that actually has
  // an error in it, rather than always starting over at the first section,
  // is what keeps that error visible instead of one tap away from silent.
  for (i = 0; i < sections.length; i += 1) {
    if (sections[i].querySelectorAll(".field-error").length > 0) {
      current = i;
      break;
    }
  }

  var nav = document.createElement("div");
  nav.className = "wizard-nav";

  var backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "btn";
  backBtn.appendChild(document.createTextNode("‹ Înapoi"));

  var stepLabel = document.createElement("span");
  stepLabel.className = "wizard-step";

  var nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "btn btn-primary";
  nextBtn.appendChild(document.createTextNode("Înainte ›"));

  nav.appendChild(backBtn);
  nav.appendChild(stepLabel);
  nav.appendChild(nextBtn);
  sections[0].parentNode.insertBefore(nav, sections[0]);

  function show(index) {
    var i;
    for (i = 0; i < sections.length; i += 1) {
      sections[i].className = i === index ? "wizard-section" : "wizard-section wizard-hidden";
    }
    stepLabel.innerHTML = "Pasul " + (index + 1) + " din " + total;
    backBtn.style.visibility = index === 0 ? "hidden" : "visible";
    nextBtn.style.display = index === total - 1 ? "none" : "inline-block";
  }

  backBtn.addEventListener("click", function () {
    if (current > 0) {
      current -= 1;
      show(current);
    }
  });

  nextBtn.addEventListener("click", function () {
    if (current < total - 1) {
      current += 1;
      show(current);
    }
  });

  show(current);
})();
`;

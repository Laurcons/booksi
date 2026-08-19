## Mistakes

### react-hook-form's `register().ref` on a custom input whose displayed text isn't the stored value

Built `CategoryPicker` (searchable category combobox) and wired react-hook-form's
`register("genre")` straight onto its visible `<input>` — `ref={genreField.ref}`,
matching the existing `AuthorInput` pattern. Passed automated tests and typecheck.

Broke only in an actual browser: after picking a category, typing into an
*unrelated* field elsewhere in the form crashed the whole dialog with
`TypeError: Cannot read properties of undefined (reading 'trim')`.

**Root cause:** RHF treats a ref it holds as a source of truth it may read
straight from the DOM element's `.value`, not just something it writes to.
`AuthorInput` gets away with the same wiring because the input's displayed
text *is* the stored value (free-text author name) — reading the DOM back
never disagrees with what was set. `CategoryPicker` displays a Romanian label
while storing an enum code, so once RHF read the DOM node's `.value` back
(triggered by a re-render from a sibling field's onChange), it fed the label
string back as the field's value — and `GENRE_LABEL["Ghiduri și hărți
turistice, atlase"]` isn't a valid lookup.

**Fix:** give RHF's `ref`/`name` a separate hidden `<input type="hidden">`
that always holds the real value (`value={value}`, no independent state) —
never the visible display-text input. See `CategoryPicker.tsx`.

**Lesson:** when register()-ing a custom RHF field, check whether the
*visible* input's DOM value ever diverges from the field's real value. If it
can (a picker, a formatted display, anything non-free-text), the ref must go
on a separate element holding the real value, not on the display input — and
this has to be verified by actually driving it in a browser across a
multi-field form, since unit tests that mount one component in isolation
won't reproduce a bug that only fires on a sibling field's re-render.

### Changing where a click leads breaks assertions *after* the flow, not just the click

Moved the book title from "opens the edit dialog" to "opens `/books/:id`", and
updated every e2e spec that clicked a title — via a shared `openEditForm`
helper, so the click path itself was handled everywhere at once.

One test still failed, and not at the click: `wishlist.spec.ts › follows an
edited price` edits a price, saves, then asserts the wishlist total. Saving
used to close a dialog and leave the user on the wishlist; now it leaves them
on the book's page, where that locator matches nothing.

**Lesson:** a navigation change has two blast radii. The obvious one is every
call site that triggers it — easy to grep, easy to fix in one helper. The
quiet one is every assertion that runs *after* the flow completes and assumed
where the user would be standing. Grep for the click, then re-read what each
of those tests does next.

### Verification scripts need the same care as the code they verify

The Playwright script I wrote to drive the feature in a browser had three
faults that cost more time than the feature did:

- **Not idempotent.** It deleted a book, so the second run failed on a missing
  fixture. A driver script gets run repeatedly by definition — reseed inside
  it, or look data up rather than assuming it.
- **Hardcoded seeded ids.** The seed mints fresh cuids each run, so the ids
  went stale the moment I reseeded. Look them up by title from the API.
- **Over-literal assertions.** Compared `innerText().trim()` against
  `"← Înapoi la galerie"` when the arrow is its own `<span>` and the DOM
  yields `"←\nÎnapoi la galerie"`. Six false failures that looked like real
  ones. Normalise whitespace before comparing rendered text.

### Verifying late, and in one big batch, reads as being stuck

Noticed by the user, not by me: "why is it taking so long?"

The code was finished and green — 348 backend, 301 frontend, typecheck and
lint clean. What followed was a long silent stretch that produced no visible
progress, because I sat down to write a ten-check Playwright driver (five
entry points, reload, two fallbacks, an edit round-trip, a delete) before
running a single one of them. Then it failed three times on its own bugs —
a stale hardcoded id, a non-idempotent delete, an over-literal string compare
— so the first actual signal about the *feature* arrived several minutes after
the feature was done.

Compounding it: `chromium-cli` (what the `run` skill assumes) is not installed
here, and a driver script written into the scratchpad cannot resolve
`playwright` from `node_modules` — import it by absolute path, or run the
script from inside the workspace.

**Lesson:** get one end-to-end check running before broadening. Load the page,
screenshot it, look at it — *then* add the other nine assertions. The first
check is also what shakes out the harness's own bugs, and shaking them out
against one assertion is far cheaper than against ten. When a verification
pass will run long regardless, say so before starting it rather than going
quiet: "code's green, now driving it in a browser, ~5 min" costs one line and
buys the user the choice to skip it.

### A port health check that passes against somebody else's server

Started the API, then polled `curl http://localhost:3000/books` until it
answered and declared it up. It answered immediately — with an HTML page from
an unrelated Next.js app that already owned :3000 on this machine. The bookcsi
API had never bound at all. The first real signal was a
`SyntaxError: Unexpected token '<'` from a JSON parse, three commands later,
which reads as a broken endpoint rather than as the wrong process.

**Lesson:** "something is listening" is not "my service is listening". Check
for a response only *your* service can produce — an authenticated route
answering `401`, a known JSON shape, `/docs-json` — not merely a non-zero
status code. And on a shared dev machine, check the port is free (`lsof
-nP -iTCP:<port> -sTCP:LISTEN`) before assuming the default is yours; here the
fix was moving the API to :3100 and pointing `VITE_API_URL` at it.

### `npm install` quietly rewrote package-lock.json into the diff

A fresh clone needed `npm install` before anything could run. The local npm
(10.8.2) rewrote `package-lock.json` on the way — dropping 108 lines and adding
`license` fields — and that churn then sat in `git status` alongside the feature
work, ready to be committed as if it were part of it.

**Lesson:** after running `npm install` in a repo you did not set up, check
whether the lockfile moved, and `git checkout -- package-lock.json` if the
change is not yours. A lockfile edit belongs to a dependency change, never to a
feature.

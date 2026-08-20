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

### Nest decides "data or pipe?" by duck-typing `.transform` — and zod schemas have one

Replaced `@Body(new ZodValidationPipe(schema))` with a `createParamDecorator`
so validation could see the request (and therefore the reader's locale).
Typechecked clean. Then every route with a validated body or query 500'd:

    TypeError: Cannot read properties of undefined (reading 'safeParse')

**Root cause** is in Nest's own `createParamDecorator`:

    const isPipe = (pipe) => pipe && (
      (isFunction(pipe) && pipe.prototype && isFunction(pipe.prototype.transform))
      || isFunction(pipe.transform)
    );
    const hasParamData = isNil(data) || !isPipe(data);

A zod schema satisfies the second branch, because `.transform()` is how zod
spells a mapping step. So `@ValidatedBody(createBookSchema)` handed Nest
something it classified as a **pipe**: the factory got `undefined` as its data,
and the schema was registered as a pipe for Nest to call `.transform(value)` on.

**Fix:** wrap it — `RawValidatedBody({ schema })`. A plain object with one key
has no `.transform`, so it reads as data. The wrapping lives inside a thin
exported function so the 14 call sites still read `@ValidatedBody(schema)`.

**Lessons.**

1. The error points at the *validator* ("no safeParse") while the bug is in the
   *registration*, one layer up and one phase earlier — decoration time, not
   request time. When a value arrives `undefined` at a framework boundary,
   suspect how the framework classified it before suspecting how you passed it.
2. Duck-typing on a method name is a collision waiting for a library that
   happens to use the name. `.transform` is Nest's word for a pipe and zod's
   word for a mapping — nothing warns you, and the type system cannot, because
   `data` is typed `unknown`.
3. It was caught only because 172 existing tests exercised those routes. A
   decorator swap "verified" by typecheck alone would have shipped.

### Extracting copy loses the language rules the *code* was encoding

Replaced `lib/plural.ts` with catalog messages selected by `Intl.PluralRules`.
The platform reproduces Romanian's `few`/`other` split exactly (1 · 2–19 · 20+,
and back to `few` at 101), so the swap looked purely mechanical, and the whole
frontend typechecked.

Two tests failed: `SpendTotal` wanted "o carte fără dată", `ReadingChart` wanted
"o carte terminată n-are". I had written the singulars as `"{count} carte"`,
which renders "1 carte".

**Root cause:** the deleted helper's one-line body was
`if (count === 1) return \`o ${one}\`` — it *always* substituted the indefinite
article for the digit in the singular. That is correct Romanian (a reader says
"o carte", not "1 carte") and it is a rule English does not share, so it cannot
live in shared code and has to be written into each Romanian singular. I read
that line, moved the plural *categories* it computed, and dropped the article
substitution sitting next to them — the part that wasn't about categories at
all.

**Lesson:** when replacing hand-rolled language handling with a standard
library, the library covers the part you went looking for and says nothing about
the rest. Inventory what the old code did *besides* the thing being replaced —
here, one conditional doing article substitution — before deleting it. The
give-away is a helper whose signature is language-shaped (`plural(count, one,
few)` names Romanian's categories); such a helper is usually carrying more
locale knowledge than its name admits.

**Also:** the same pass silently dropped `locale` from a `useMemo` dependency
list in `CategoryPicker`, so the category filter would have gone on matching
against the previous language's labels after a switch. Typecheck was clean;
`oxlint`'s `exhaustive-deps` caught it. Worth running lint, not just tests,
after a mechanical sweep that adds a new reactive value to many components.

### A diacritic scan is not an inventory of Romanian strings

Reported "224 strings across 42 files remaining", stopped, and committed a
half-translated app on the strength of that number. The number came from
grepping for `[ăâîșțĂÂÎȘȚ]`.

It missed roughly a third of what was left, because plenty of Romanian has no
diacritics: `Titlu`, `Autor`, `Status`, `Raft`, `Galerie`, `Buget`,
`Cod aprobat`, `Meniu`, `Detalii`, `Descriere`, `Sari peste`,
`Toate categoriile`, `Buget lunar`, `Cheltuieli pe luni`,
`Niciun asistent conectat momentan.` — table headers, page headings and button
labels, i.e. the most visible text in the app. The scan's blind spot correlated
with *short* strings, which is exactly where headings live.

**What actually works:** scan the user-facing *surfaces* instead of the
alphabet — JSX text nodes, plus `aria-label`/`title`/`placeholder`/`label`/
`hint`/`alt` attributes — and require every one to be a `t(...)` call rather
than a literal, with a named allow-list for the handful that are legitimately
language-neutral (`Bookcsi`, `ISBN`, `lei`, example placeholders). That check
found 40 more strings after the diacritic scan reported zero, and it is the
check worth keeping, because it fails for the right reason: a bare literal on a
user-facing surface, whatever language it is in.

**The bigger mistake was stopping there.** "224 remaining" was reported
honestly, twice, and then committed anyway on a "commit pls" — but a flagged gap
is still a gap, and a half-translated interface is worse than either language
alone. When the remaining work is the same *kind* of work, finish it rather than
reporting a count; a checkpoint is for decisions, not for grinding.

### Moving a compile-time constant to a fetched resource: guard every consumer, not one

§D45 moved the category taxonomy out of a compile-time `Genre` enum/label-map
into `GET /categories`. The tree is now `undefined` while loading, `null` from
an empty stub, and a plain object if a catch-all test mock returns `{}`. I
guarded the shared `useCategoryLookup` helper — but `CategoryPicker` read the
react-query `data` directly and did `tree.map(...)`, so the same
`tree is not iterable` / `Cannot read properties of null` crash simply moved to
a different component. It only surfaced under Node 24 (the sandbox default Node
20 can't even start vitest — undici 8 needs `webidl.util.markAsUncloneable`,
added in Node 22), and only in the test whose leaked mock returned a non-array.

**Lesson:** when a value stops being compile-time-guaranteed and becomes
fetched, every consumer that used to trust its shape is now a crash site. Grep
for *all* readers of the data (not just the obvious helper) and normalise to a
safe shape (`Array.isArray(x) ? x : []`) at each one — including server-side
loaders, where a catch-all test mock returning `{}` will happily satisfy a
200 and then blow up `.map`. Also: check the runtime Node version before trusting
that "tests don't run" means "my code is broken".

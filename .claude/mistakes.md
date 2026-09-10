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

### A declared height on a `flex-1` item does nothing

Gave the tabbed book form a constant body height — `sm:h-[27rem]` — on the same
element that carried `flex-1`, then reported the constant-height design point as
implemented. The user noticed the dialog still resized between tabs.

**Root cause:** `flex-1` is `flex: 1 1 0%`, and that `0%` *is* the flex basis,
which overrides `height` for the main axis. The item then sized itself from its
content, so every tab got its own height — exactly the behaviour the fixed
height existed to prevent. Fixed by keeping the height and moving the growth to
the one place it is wanted: `max-sm:flex-1` for the phone sheet, plain height
above `sm`.

**Lesson:** `flex-1` and a main-axis size on the same element are a
contradiction the height loses. And a layout rule stated as a design decision —
"the dialog does not change size" — has to be *measured*, not eyeballed: jsdom
has no layout, so the assertion belongs in a Playwright test
(`frontend/e2e/book-form.spec.ts`) that reads `boundingBox()` on every tab. It
took a human noticing to find this, which is the tell that the missing test was
the real defect.

### A wrapping `<label>` absorbs everything inside it into the field's name

Put a character counter in the label row and the currency inside the money
field, both inside `Field`'s wrapping `<label>`. Six tests failed with "Unable
to find a label with the text of: Plătit".

**Root cause:** a `<label>` that wraps its control takes its accessible name
from *all* its text, so the fields were called "Descriere 743 / 10.000" and
"Plătit lei". The tests were right and the markup was wrong — a screen reader
would have read those names out too. Fixed by giving those fields an id and
pointing the label at it, which leaves the name as the one word the field is
called.

**Lesson:** when a field grows any trailing content — a counter, a unit, a clear
button — the wrapping-label pattern stops working. Reach for `htmlFor` + `id`
the moment a label contains anything besides the label.

### react-hook-form reports a fully disabled radio group as `null`

Made the star rating *disabled* rather than hidden on statuses that cannot carry
one (the "disabled, not hidden" rule), and the whole form became unsavable from
every tab: `rating` failed validation with "invalid option".

**Root cause:** RHF reads a radio group's value off the DOM and skips disabled
inputs. With all five stars plus the "no rating" radio disabled, it finds
nothing readable and reports `null` — which the form schema's
`enum | ""` union rejected, so `handleSubmit` never ran its valid branch. Fixed
by accepting `null` in the form schema and folding it into "nobody chose a
star"; what actually goes out is still decided by the status gate.

**Lesson:** disabling a control changes what RHF *reads*, not just what the user
can touch. Any field whose value RHF derives from DOM state — radio groups above
all — needs its schema to tolerate the disabled case, and a test that saves the
form while that field is disabled.

### Subscribing to `formState.isDirty` changed what the form *sent*

Needed "has anything changed" for §D49 and reached for the obvious API:
destructured `isDirty` out of `formState` alongside `dirtyFields`. A test that
had nothing to do with the feature failed — a save that should have posted
`{status: "FINISHED"}` posted `{status: "FINISHED", rating: null}`.

**Root cause:** RHF's `formState` is a Proxy, and *reading* a key subscribes to
it, which makes RHF compute that piece of state where it previously skipped it.
Computing whole-form dirtiness reads the all-disabled star radio group as `null`
(the mistake two entries up), compares it against the `""` default, and writes
`dirtyFields.rating` — so `onlyDirty` started including a field the user never
touched. `Object.keys(dirtyFields).length > 0` answers the same question off
state that was already subscribed, and does not.

**Lesson:** in react-hook-form, adding a field to the `formState` destructure is
not a read — it is a behaviour change. When one appears to fix nothing and break
something elsewhere, check whether an existing subscription already answers the
question.

### A signal that arrives with a transition has to leave with one

Shipped §D49's refusal ring as a class toggled on for 600ms and then off. It
appeared correctly and then vanished between two frames, which the user read as
a rendering glitch rather than as a signal that had finished.

**Root cause:** nothing on the panel declared `transition-*`, so both edges of
the class change were instantaneous. The fix is not one duration but two —
`duration-0` while the ring is on, `duration-500` once it comes off — because
the eye wants a state like this to arrive with the click and leave on its own
time. It interpolates at all only because Tailwind v4 composes `ring` and
`shadow` into one `box-shadow` with fixed slots.

**Lesson:** when a class is added and removed by a timer to *say* something,
decide the two edges separately and write both down. "It looked right when it
appeared" tests half of it.

### `break-words` does nothing when the box is sized by its own content

Fixed a long title spilling out of the drawn cover with `break-words`, said so
in a comment, and it did not work — the e2e test I wrote afterwards measured
176px of spill on each side.

**Root cause:** `overflow-wrap: break-word` is ignored while a box's *intrinsic*
size is being computed, and the lettering is a grid item under
`place-items-center`, so its width is max-content. The unbreakable word made the
box itself ~300px wide and it overflowed the 96px cover on both sides rather
than wrapping inside it. `overflow-wrap: anywhere` (`wrap-anywhere`) is the one
that counts for intrinsic sizing.

**Lesson:** reach for `wrap-anywhere` when the element's width comes from its
content, and keep `break-words` for text in a box whose width is already
decided. And a CSS fix asserted only by reading the diff is not a fix — this one
looked right in the comment and was wrong on screen.
### Tailwind's `inset-x`/`mx` are logical, and a vertical writing mode rotates them

Spent three rounds "confirming" the shelf's rotated spine titles were centred —
a hand-written CSS repro of `Shelf.tsx` measured dead-centre on both axes, so I
kept looking for the offset inside the line box (font metrics, sideways-Latin
baselines, descenders) instead of at the box itself. The user's screenshot was
right and my repro was wrong.

**Root cause of the miss:** I reimplemented `inset-x-0 mx-auto` as
`left:0; right:0; margin-inline:auto` from memory. Tailwind v4 compiles them to
`inset-inline: 0` and `margin-inline: auto` — *logical* properties, resolved
against the element's own `writing-mode: vertical-rl`, so on that element they
address the vertical axis and `left`/`right` are never set at all. My repro
quietly fixed the bug I was hunting.

**Lesson:** never hand-translate utility classes into a CSS repro — that throws
away the exact thing under test. Get the real compiled stylesheet
(`npm run build --workspace frontend`, then load `dist/assets/*.css` in a scratch
page with the class strings copied verbatim) and read the *used* values with
`getComputedStyle`. `left: 0px; right: 9.5px; width: 12.5px` on a 22px spine said
in one line what three rounds of ink measurement could not.

### `resetField` is a silent no-op on a field react-hook-form never registered

§D51's author picker deliberately has no RHF `ref` (the display text is a name,
the stored value an id — the very divergence the first entry in this file
records a crash for). So `authorId` lives in the form via `setValue` alone, with
no input of its own.

Then, to clear it after an author was deleted, I reached for
`resetField("authorId", { defaultValue: null })` — the precise API for "this is
the new baseline, not an edit". It typechecked, it threw nothing, and it did
**nothing at all**: `resetField` looks the field up in RHF's internal `_fields`
and returns early when it is not there. The picker's box emptied (its own
state), while the form went on holding the deleted author's id.

**Fix:** `setValue(name, value)` with **no options**. It sets the value and
leaves `dirtyFields` untouched, which is the same "not an edit" meaning, and it
works whether or not the field is registered. The same bug was waiting in the
Open Library fill, which runs from the *Carte* tab where the biography's
textarea is not even mounted — so a registered field is unregistered there too.

**Lesson:** on a form with unregistered fields — a picker, a hidden value, or
any field on an unmounted tab — `resetField` and anything else that resolves
through `_fields` is unreliable. Prefer `setValue`. And the broader one: an API
that fails by doing nothing needs a test that asserts the *outcome*, not the
call; this surfaced only because a browser pass drove a delete and looked at
what the form still held afterwards.

### A display-only value put through validation can make a form unsavable

The author's *name* is not sent anywhere — the API takes an id — but I made it a
validated form field anyway (`authorName: z.string()`), because it has to
survive the Autor tab unmounting.

A test stub then answered `POST /authors` with a book-shaped object, so
`author.name` was `undefined`, the field failed `z.string()`, and `handleSubmit`
refused to run. No request, no visible error: the message was attached to a
field with no input, on a tab, for a value the reader neither typed nor can see.
The form was simply dead.

This is the same shape as the disabled-rating bug lower down this file, and the
same lesson generalised: **do not put a value through validation unless a person
can act on the verdict.** Fixed by moving the name out of the form entirely,
into `BookFormDialog`'s own `useState` — which does not unmount when tabs
switch, so it never needed to be a form field in the first place.

### `apiFetch` sets `Accept` but not `Content-Type`, and Express then drops the body

Wrote three author mutations as `apiFetch(url, { method: "PATCH", body:
JSON.stringify(input) })` and every one came back 400 "expected object, received
undefined". The payload was correct; the *header* was missing, so Express's JSON
parser never read the body and Nest saw `undefined`.

Every other mutation in the app passes `headers: { "Content-Type":
"application/json" }` by hand, so `apiFetch` had never needed to — twelve call
sites doing it right and no help for the thirteenth.

**Fix:** `apiFetch` now sets it whenever `body` is a string, which is exactly
when `JSON.stringify` produced it; the raw-image upload passes a `Blob` and its
own type, so it is unaffected, and an explicit header still wins.

**Lesson:** when a convention is repeated at every call site rather than
enforced in the shared helper, the helper is the bug. And note where the error
pointed: at the *shape of the payload*, one layer past the actual fault — the
same misdirection as the Nest pipe entry below.

### Focus is not click: a picker that returns focus to its own input goes dead

Picking a suggestion closes the dropdown and focuses the input, so typing can
continue. The list reopened on `onFocus` — and the input was *already* focused,
so a second click on the field fired no `focus` event and did nothing. The only
ways back into the list were to click away and return, or to start typing.

Found by a Playwright test whose click timed out; the screenshot showed a
perfectly correct-looking form with a closed dropdown, which is exactly what a
user would have reported as "the field doesn't open".

**Lesson:** any control that manages its own focus needs `onClick` as well as
`onFocus` to open. `onFocus` alone is only correct for a control the user
arrives at from somewhere else.

### Two correct labels can still break a query — and one of them was mine

`getByLabelText("Autor")` started matching two elements: the picker's input, and
the tab *panel*, which is `aria-labelledby` a tab whose name is also "Autor".
Both are correct markup, and the collision is only in the query — the fix was
`getByRole("textbox", { name: "Autor" })`.

But chasing it turned up a genuine fault next door: the input carried **both**
an `aria-label` and an associated visible `<label>`, saying the same word.
`aria-label` *overrides* a visible label rather than adding to it, so the pair
stays correct only by luck and a screen reader reads the invisible one the
moment they disagree. Removed the `aria-label`. (`CategoryPicker` still has the
same duplication; nothing queries it by label, which is the only reason it has
not surfaced.)

**Lesson:** when a label query matches more than one thing, check whether the
duplication is in the *test* or in the markup before fixing the test. Here it
was both.

### An effect that seeds a form field runs again on every mount — and a tab panel mounts on every visit

The Autor tab poured the fetched biography into the form from a `useEffect`
guarded only on *which author* the response was for. That guard is necessary and
insufficient: the effect also fires on mount, only the active tab is mounted, so
leaving the tab and coming back re-poured the **stored** text over whatever the
reader had typed. Reported by the maintainer as "edit the biography, switch
tabs, your edits are lost".

Two things made it worse than it looked. The same line also fires on the *first*
visit, racing the reader against a `GET` issued when the tab opened — the same
loss in a smaller window. And `setValue` with no options deliberately skips the
dirty update (`shouldDirty||shouldTouch)&&…` in the RHF source), so after the
clobber the field still counted as changed: the tab kept its dot for the edit it
had just erased, and Save wrote the old text back over itself. A test asserting
only the toast had been passing for weeks with the biography going out empty.

The first fix I proposed was a ref remembering whose biography was in the box.
It works, and the maintainer's pushback — "can't this be declarative?" — was
right that it fences the lifecycle off rather than removing it. The seeding is
not synchronisation, it is a **consequence of an event**: it belongs in the
handler that changes the author, where it happens once, when it is true. That
deleted the effect, both faces of the bug, and the guard along with them.

Also worth recording: react-hook-form has no declarative answer here, and it is
worth knowing why before reaching for one. `dirtyFields` compares text to text,
so it cannot express "this baseline belongs to a different entity now" — two
authors with the same biography are indistinguishable to it, and the common case
is *both empty*. `resetField` would move the baseline properly and is unusable
at the one moment it is needed: the biography's textarea is only rendered once an
author is selected, and `resetField` on an unregistered field is a silent no-op.
`useForm({ values, resetOptions: { keepDirtyValues: true } })` is the library's
designated tool and is form-wide, so it would re-seed all nineteen fields on
every book-query invalidation — including the one our own Save triggers.

**Lesson:** an effect that writes state the user can also edit is a clobber
waiting for a remount. Ask what *event* made the new value true and write it
there. And when a value in a form belongs to another entity, the form library's
dirty tracking cannot help — it compares values, and identity is the question.

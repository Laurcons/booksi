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

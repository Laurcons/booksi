import { useState } from "react";
import type { ListBooksQuery } from "@bookcsi/shared";
import { useBooks } from "../api/books";
import { Header } from "../components/Header";
import { LoadFailure, Note } from "../components/Note";
import { BookCard } from "../components/books/BookCard";
import { BookFormDialog } from "../components/books/BookFormDialog";
import { EmptyLibrary } from "../components/books/EmptyLibrary";
import { GalleryFilters } from "../components/books/GalleryFilters";
import { NoMatches } from "../components/books/NoMatches";
import { useOpenBook } from "../lib/book-origin";
import { isFiltered, isSearched } from "../lib/filters";
import { useBookSearch } from "../lib/use-book-search";
import { useT } from "../i18n/locale-context";

/**
 * Sprint 5 — the gallery.
 *
 * A screen of its own rather than a view toggle on the library (§D28): the nav
 * has carried a greyed-out "Galerie" entry since Sprint 1, and this is the
 * sprint that lights it up. The table stays exactly where it was; the two are
 * different jobs — one to read in detail, one to recognise at a glance.
 *
 * No sort control here. S1.2 owns "the table is sortable", S5.1 and S5.3 never
 * ask for it, and the default order (newest first) is the library's own.
 */
const INITIAL_QUERY: ListBooksQuery = { sort: "createdAt", order: "desc" };

export function GalleryPage() {
  const t = useT();
  const [filters, setFilters] = useState<ListBooksQuery>(INITIAL_QUERY);
  const { search, setSearch, q } = useBookSearch();
  /**
   * Only "add" is left here. A card used to open the edit form, because that
   * form was the only thing "the book's details" could mean; since §D40 a card
   * opens the book's page instead, and editing is a button on that page.
   */
  const [adding, setAdding] = useState(false);
  const openBook = useOpenBook("origin.gallery");

  // The filters and the search meet here, and nowhere else: the panel below
  // edits one of them at a time and neither may drop the other.
  const query: ListBooksQuery = { ...filters, q };

  const { data: books, isPending, isError, error, refetch } = useBooks(query);
  const filtering = isFiltered(query);

  const showEverything = () => {
    setFilters(INITIAL_QUERY);
    setSearch("");
  };

  return (
    <div className="min-h-dvh">
      <Header onAddBook={() => setAdding(true)} />

      <main className="mx-auto max-w-7xl space-y-8 px-6 py-12">
        <div>
          <h1 className="font-display text-4xl text-ink">
            {t("nav.gallery")}<span className="text-accent">.</span>
          </h1>
          <p className="mt-2 text-ink-2">
            {t("page.gallery.blurb")}
          </p>
        </div>

        <GalleryFilters
          query={query}
          onChange={setFilters}
          search={search}
          onSearchChange={setSearch}
        />

        {isPending && <Note>{t("loading.gallery")}</Note>}

        {isError && (
          <LoadFailure
            what={t("what.gallery")}
            error={error}
            onRetry={() => void refetch()}
          />
        )}

        {books && books.length > 0 && (
          <>
            {/* Under the filters rather than beside them: with a filter on, how
                many books survived it is the first thing worth knowing. */}
            <p className="text-sm text-ink-3">
              {filtering
                ? t("gallery.countFiltered", { count: books.length })
                : t("gallery.count", { count: books.length })}
            </p>

            <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
              {books.map((book) => (
                <li key={book.id}>
                  <BookCard book={book} onOpen={() => openBook(book)} />
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Two different absences, and telling them apart is the whole point:
            an empty library needs a first book, an empty *filter* needs its
            filters back (§D29). */}
        {books && books.length === 0 && !filtering && (
          <EmptyLibrary onAdd={() => setAdding(true)} />
        )}

        {books && books.length === 0 && filtering && (
          <NoMatches searching={isSearched(query)} onClear={showEverything} />
        )}
      </main>

      {adding && <BookFormDialog onClose={() => setAdding(false)} />}
    </div>
  );
}

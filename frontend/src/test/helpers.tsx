import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { vi } from "vitest";
import type { AuthUser, Book, ErrorCode, Locale } from "@bookcsi/shared";
import { CURRENT_USER_KEY } from "../api/auth";
import { LocaleProvider } from "../i18n/LocaleProvider";

/**
 * The components under test talk to the API through `api/books.ts`, and that is
 * deliberately left in the test: what a form *sends* is half of what it does,
 * and mocking the hooks away would leave the payload untested. So the seam is
 * `fetch` — the last thing before the network — and the assertions are on the
 * request bodies that reach it.
 */

export interface ApiCall {
  url: string;
  method: string;
  body: Record<string, unknown> | undefined;
  headers: Record<string, string>;
  /** Set when the body was not JSON — an uploaded image, say (S4.3). */
  raw: unknown;
}

/**
 * A refusal, for the tests that are about what happens when the API says no.
 *
 * Sprint 4 needs this in a way Sprints 1–3 did not: "Open Library does not
 * know this ISBN" and "Open Library is not answering" are *expected* outcomes
 * with their own behaviour on screen, so a stub that can only succeed cannot
 * express half of what the feature does.
 */
export class StubFailure {
  // Assigned in the body rather than declared as constructor parameters:
  // `erasableSyntaxOnly` is on, and parameter properties are the one piece of
  // TypeScript that emits runtime code.
  readonly status: number;
  readonly message: string;
  readonly code: ErrorCode | undefined;

  constructor(status: number, message: string, code?: ErrorCode) {
    this.status = status;
    this.message = message;
    this.code = code;
  }
}

/**
 * §D27: a coded failure is one the API meant a user to read, and the client
 * shows its message verbatim. Omit the code to stub the other kind — the
 * generic 500, or anything that never reached the API — where the component is
 * expected to substitute words of its own.
 */
export function failWith(
  status: number,
  message: string,
  code?: ErrorCode,
): StubFailure {
  return new StubFailure(status, message, code);
}

export function stubApi(respondWith: (call: ApiCall) => unknown = () => ({})) {
  const calls: ApiCall[] = [];

  vi.stubGlobal(
    "fetch",
    vi.fn((input: unknown, init: RequestInit = {}) => {
      const call: ApiCall = {
        url: String(input),
        method: init.method ?? "GET",
        body:
          typeof init.body === "string"
            ? (JSON.parse(init.body) as Record<string, unknown>)
            : undefined,
        headers: (init.headers ?? {}) as Record<string, string>,
        raw: init.body,
      };
      calls.push(call);

      const answer = respondWith(call);

      // A hand-rolled stand-in rather than a real `Response`: `apiFetch` only
      // ever reads these three, and jsdom's fetch story is not worth the
      // dependency.
      if (answer instanceof StubFailure) {
        return Promise.resolve({
          ok: false,
          status: answer.status,
          json: () =>
            Promise.resolve({
              statusCode: answer.status,
              message: answer.message,
              code: answer.code,
            }),
        });
      }

      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(answer),
      });
    }),
  );

  return calls;
}

/** The single write this suite cares about, decoded. */
export function lastWrite(calls: ApiCall[]): Record<string, unknown> | undefined {
  return calls.filter((call) => call.method !== "GET").at(-1)?.body;
}

/**
 * Renders inside the two providers the app itself supplies.
 *
 * ## Why the session is seeded (§D44)
 *
 * `LocaleProvider` reads the language off the signed-in account, so a component
 * rendered with no session in the cache would fall back to the *device's*
 * language — `navigator.languages` under jsdom, which is English. Every
 * assertion in this suite is about what a Romanian reader sees, so the harness
 * puts a Romanian session in the cache: that is what these tests were always
 * implicitly about, and it is now explicit.
 *
 * Pass `locale: "en"` to render the same component for an English reader, which
 * is how the switch itself is tested.
 */
export function renderWithQuery(
  ui: ReactElement,
  { locale = "ro" as Locale }: { locale?: Locale } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      // Retries turn an assertion failure into a timeout, which says nothing
      // about what went wrong.
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  queryClient.setQueryData(CURRENT_USER_KEY, {
    id: "test-user",
    email: "cineva@example.com",
    name: "Cineva",
    avatarUrl: null,
    isAdmin: false,
    locale,
    impersonatedBy: null,
  } satisfies AuthUser);

  return {
    user: userEvent.setup(),
    ...render(
      <QueryClientProvider client={queryClient}>
        <LocaleProvider>{ui}</LocaleProvider>
      </QueryClientProvider>,
    ),
  };
}

/** A complete book; every test overrides only the field it is about. */
export function makeBook(overrides: Partial<Book> = {}): Book {
  return {
    id: "book-1",
    title: "Dune",
    author: "Frank Herbert",
    isbn: "978-606-4-00000-0",
    totalPages: 620,
    genre: "FICTION",
    publisher: null,
    publicationYear: null,
    volume: null,
    format: null,
    // §D40 — most books have none, which is what the profile's empty state is
    // written for.
    description: null,
    status: "READING",
    favorite: false,
    pagesRead: 143,
    rating: null,
    estimatedPrice: null,
    paidPrice: null,
    purchasedOn: "2026-07-01",
    startedOn: "2026-07-20",
    finishedOn: null,
    // Sprint 4 — a book with no cover, which is still most of them.
    coverUrl: null,
    createdAt: "2026-06-30T10:00:00.000Z",
    updatedAt: "2026-07-20T10:00:00.000Z",
    ...overrides,
  };
}

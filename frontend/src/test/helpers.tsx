import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement } from "react";
import { vi } from "vitest";
import type { Book } from "@bookcsi/shared";

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
      };
      calls.push(call);

      // A hand-rolled stand-in rather than a real `Response`: `apiFetch` only
      // ever reads these three, and jsdom's fetch story is not worth the
      // dependency.
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(respondWith(call)),
      });
    }),
  );

  return calls;
}

/** The single write this suite cares about, decoded. */
export function lastWrite(calls: ApiCall[]): Record<string, unknown> | undefined {
  return calls.filter((call) => call.method !== "GET").at(-1)?.body;
}

export function renderWithQuery(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      // Retries turn an assertion failure into a timeout, which says nothing
      // about what went wrong.
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return {
    user: userEvent.setup(),
    ...render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
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
    genre: "SCIFI",
    status: "READING",
    favorite: false,
    pagesRead: 143,
    rating: null,
    estimatedPrice: null,
    paidPrice: null,
    purchasedOn: "2026-07-01",
    startedOn: "2026-07-20",
    finishedOn: null,
    createdAt: "2026-06-30T10:00:00.000Z",
    updatedAt: "2026-07-20T10:00:00.000Z",
    ...overrides,
  };
}

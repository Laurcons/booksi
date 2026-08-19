import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardStats } from "../components/DashboardStats";
import { renderWithQuery, stubApi } from "../test/helpers";
import { useLocale } from "./locale-context";

/**
 * §D44 — the language the interface is in, end to end.
 *
 * `DashboardStats` stands in for "any screen": it reads copy through `t()` and a
 * number through `formatCount`, which are the two things the locale decides.
 */

const STATS = {
  booksFinished: 4210,
  booksReading: 3,
  pagesRead: 120_000,
  averageRating: 4.2,
};

const MONTH = { month: "2026-08", spent: 340.5, budget: null, remaining: null };

describe("the interface's language", () => {
  it("renders a Romanian account's screens in Romanian", () => {
    renderWithQuery(<DashboardStats stats={STATS} month={MONTH} />, { locale: "ro" });

    expect(screen.getByText("Cărți citite")).toBeInTheDocument();
    // Romanian groups with a dot — the separator that made `formatCount` take a
    // locale in the first place.
    expect(screen.getByText("4.210")).toBeInTheDocument();
  });

  it("renders an English account's screens in English, digits included", () => {
    renderWithQuery(<DashboardStats stats={STATS} month={MONTH} />, { locale: "en" });

    expect(screen.getByText("Books read")).toBeInTheDocument();
    // The same figure, and the reason the two cannot share a formatter: read as
    // English, "4.210" is four and a bit.
    expect(screen.getByText("4,210")).toBeInTheDocument();
  });

  it("leaves the currency alone, because language is not region", () => {
    // A Romanian library priced in lei stays priced in lei when the menus turn
    // English (§D44, `shared/src/money.ts`).
    renderWithQuery(<DashboardStats stats={STATS} month={MONTH} />, { locale: "en" });

    expect(screen.getByText(/340\.50 lei/)).toBeInTheDocument();
  });
});

describe("choosing a language", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("writes the choice to the account, so it follows the user to another browser", async () => {
    // The route answers with the refreshed row, which is what the provider
    // settles on once the request lands.
    const calls = stubApi(() => ({
      id: "test-user",
      email: "cineva@example.com",
      name: "Cineva",
      avatarUrl: null,
      isAdmin: false,
      locale: "en",
      impersonatedBy: null,
    }));

    function Switch() {
      const { locale, setLocale } = useLocale();

      return (
        <button type="button" onClick={() => setLocale("en")}>
          {locale}
        </button>
      );
    }

    const { user } = renderWithQuery(<Switch />, { locale: "ro" });

    expect(screen.getByRole("button")).toHaveTextContent("ro");

    await user.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByRole("button")).toHaveTextContent("en"),
    );

    const write = calls.find((call) => call.method === "PUT");
    expect(write?.url).toContain("/auth/locale");
    expect(write?.body).toEqual({ locale: "en" });
  });
});

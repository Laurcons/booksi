import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router";
import { RequireAuth } from "./components/RequireAuth";
import { LocaleProvider } from "./i18n/LocaleProvider";
import { queryClient } from "./lib/query-client";
import { AdminImpersonatePage } from "./pages/AdminImpersonatePage";
import { BookProfilePage } from "./pages/BookProfilePage";
import { BudgetPage } from "./pages/BudgetPage";
import { ChallengePage } from "./pages/ChallengePage";
import { ConnectorsPage } from "./pages/ConnectorsPage";
import { GalleryPage } from "./pages/GalleryPage";
import { LibraryPage } from "./pages/LibraryPage";
import { LoginPage } from "./pages/LoginPage";
import { McpConsentPage } from "./pages/McpConsentPage";
import { PairKoboPage } from "./pages/PairKoboPage";
import { ShelfPage } from "./pages/ShelfPage";
import { StatsPage } from "./pages/StatsPage";
import { WishlistPage } from "./pages/WishlistPage";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* §D44 — inside the query provider, because the account's chosen language
          comes from the same `/auth/me` answer `RequireAuth` reads, and outside
          the router, because the login screen needs a language too. */}
      <LocaleProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            {/* Everything else sits behind the session, mirroring the global
                guard on the API (S0.3). */}
            <Route element={<RequireAuth />}>
              <Route path="/" element={<LibraryPage />} />
              {/* §D40/§D41 — one book, in full. Every listing screen opens it,
                  and it is the only route here that takes a parameter: a book is
                  the one thing in the app worth linking to directly. */}
              <Route path="/books/:id" element={<BookProfilePage />} />
              {/* S3.1 — a view of the same books, not a second collection. */}
              <Route path="/wishlist" element={<WishlistPage />} />
              {/* S5.1 — the gallery is its own screen, not a toggle over the
                  table (§D28). English path, Romanian label, as everywhere. */}
              <Route path="/gallery" element={<GalleryPage />} />
              {/* S6.1–S6.3 — the budget screen (§D28, §D31). */}
              <Route path="/budget" element={<BudgetPage />} />
              {/* S7.1–S7.2 — the reading statistics, on the route §D28 named for
                  them a sprint in advance. */}
              <Route path="/stats" element={<StatsPage />} />
              {/* S8.2 — the shelf, on the sixth nav entry, which carried the
                  placeholder label "Tracker" until §D32. S8.1's dashboard has no
                  route of its own: it is the band at the top of `/`. */}
              <Route path="/shelf" element={<ShelfPage />} />
              {/* docs/MCP.md §3, §9 step 3 — where /oauth/authorize sends a
                  signed-in browser to approve or deny an MCP connector. */}
              <Route path="/mcp/consent" element={<McpConsentPage />} />
              {/* docs/MCP.md §2, §9 step 6 — revocation lives on its own screen,
                  reachable from the account menu rather than the main nav (see
                  Header.tsx's AccountMenu): this is account security, not a
                  content view alongside the library/gallery/stats. */}
              <Route path="/connectors" element={<ConnectorsPage />} />
              {/* §D38 — the admin "log in as" picker, reachable the same way as
                  /connectors (account menu, not the main nav). */}
              <Route path="/admin/impersonate" element={<AdminImpersonatePage />} />
              {/* §D37, docs/kobo_design.md §Autentificare — where a signed-in
                  session approves the code a Kobo is showing, since the device
                  cannot complete Google's consent screen itself. */}
              <Route path="/pair-kobo" element={<PairKoboPage />} />
              {/* A curated set of books against a deadline — backend/src/challenges/. */}
              <Route path="/challenge" element={<ChallengePage />} />
              <Route path="*" element={<LibraryPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </LocaleProvider>
    </QueryClientProvider>
  );
}

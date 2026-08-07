import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router";
import { RequireAuth } from "./components/RequireAuth";
import { queryClient } from "./lib/query-client";
import { BudgetPage } from "./pages/BudgetPage";
import { ConnectorsPage } from "./pages/ConnectorsPage";
import { GalleryPage } from "./pages/GalleryPage";
import { LibraryPage } from "./pages/LibraryPage";
import { LoginPage } from "./pages/LoginPage";
import { McpConsentPage } from "./pages/McpConsentPage";
import { ShelfPage } from "./pages/ShelfPage";
import { StatsPage } from "./pages/StatsPage";
import { WishlistPage } from "./pages/WishlistPage";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          {/* Everything else sits behind the session, mirroring the global
              guard on the API (S0.3). */}
          <Route element={<RequireAuth />}>
            <Route path="/" element={<LibraryPage />} />
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
            <Route path="*" element={<LibraryPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

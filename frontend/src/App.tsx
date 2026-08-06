import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router";
import { RequireAuth } from "./components/RequireAuth";
import { queryClient } from "./lib/query-client";
import { LibraryPage } from "./pages/LibraryPage";
import { LoginPage } from "./pages/LoginPage";

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
            <Route path="*" element={<LibraryPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

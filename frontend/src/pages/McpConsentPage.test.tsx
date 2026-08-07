import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { McpConsentRequest } from "@bookcsi/shared";
import { failWith, stubApi } from "../test/helpers";
import { McpConsentPage } from "./McpConsentPage";

const CONSENT: McpConsentRequest = {
  clientName: "Claude",
  scope: "library",
  redirectUri: "http://127.0.0.1:8765/callback",
  state: "abc123",
};

function renderConsent({
  req = "req-token-abc",
  consent = CONSENT as McpConsentRequest | ReturnType<typeof failWith>,
  approveResponse = { redirectUrl: "http://127.0.0.1:8765/callback?code=xyz&state=abc123" } as
    | { redirectUrl: string }
    | ReturnType<typeof failWith>,
}: {
  req?: string | null;
  consent?: McpConsentRequest | ReturnType<typeof failWith>;
  approveResponse?: { redirectUrl: string } | ReturnType<typeof failWith>;
} = {}) {
  const calls = stubApi((call) => {
    if (call.method === "GET" && call.url.includes("/oauth/authorize/")) return consent;
    if (call.method === "POST" && call.url.includes("/approve")) return approveResponse;
    return null;
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const path = req === null ? "/mcp/consent" : `/mcp/consent?req=${req}`;

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <McpConsentPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { user: userEvent.setup(), calls };
}

describe("McpConsentPage (docs/MCP.md §9 step 3)", () => {
  beforeEach(() => {
    // `apiFetch`'s stub is `vi.stubGlobal`-based too (see `stubApi`); the
    // component navigates with `window.location.href`, which jsdom's real
    // `Location` refuses ("Not implemented: navigation") — replaced with a
    // plain object so the assertions can read back what it was set to.
    vi.stubGlobal("location", { href: "" });
  });

  it("shows the client name and spells out the single scope", async () => {
    renderConsent();

    expect(await screen.findByText(/Claude vrea acces/)).toBeInTheDocument();
    expect(
      screen.getByText(/poate citi, adăuga, modifica și șterge cărți/),
    ).toBeInTheDocument();
  });

  it("navigates to the redirect URL the server returns on approve", async () => {
    const { user } = renderConsent();
    await screen.findByText(/Claude vrea acces/);

    await user.click(screen.getByRole("button", { name: "Aprobă" }));

    await waitFor(() =>
      expect(window.location.href).toBe(
        "http://127.0.0.1:8765/callback?code=xyz&state=abc123",
      ),
    );
  });

  it("builds the access_denied redirect itself on deny, echoing the state", async () => {
    const { user } = renderConsent();
    await screen.findByText(/Claude vrea acces/);

    await user.click(screen.getByRole("button", { name: "Refuză" }));

    expect(window.location.href).toBe(
      "http://127.0.0.1:8765/callback?error=access_denied&state=abc123",
    );
  });

  it("says so when there is no req to act on", () => {
    renderConsent({ req: null });

    expect(screen.getByText(/Lipsește cererea de conectare/)).toBeInTheDocument();
  });

  it("shows the server's message for an expired or invalid req", async () => {
    renderConsent({
      consent: failWith(
        400,
        "Cererea a expirat sau nu mai e validă. Reia conectarea din asistent.",
        "MCP_CONSENT_REQUEST_INVALID",
      ),
    });

    expect(await screen.findByText(/Cererea a expirat/)).toBeInTheDocument();
  });

  it("shows a message and stays put when approval itself fails", async () => {
    const { user } = renderConsent({
      approveResponse: failWith(500, "eroare de server"),
    });
    await screen.findByText(/Claude vrea acces/);

    await user.click(screen.getByRole("button", { name: "Aprobă" }));

    expect(await screen.findByText(/Nu am putut conecta/)).toBeInTheDocument();
    expect(window.location.href).toBe("");
  });
});

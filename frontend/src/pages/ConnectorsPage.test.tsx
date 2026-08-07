import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { McpGrant } from "@bookcsi/shared";
import { failWith, stubApi, type ApiCall } from "../test/helpers";
import { ConnectorsPage } from "./ConnectorsPage";

const GRANT: McpGrant = {
  id: "grant-1",
  clientId: "dev-mcp-client",
  clientName: "Claude",
  scope: "library",
  label: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  lastUsedAt: "2026-08-05T00:00:00.000Z",
};

function renderConnectors({
  grants = [GRANT] as McpGrant[] | ReturnType<typeof failWith>,
}: { grants?: McpGrant[] | ReturnType<typeof failWith> } = {}) {
  const calls = stubApi((call) => {
    if (call.method === "GET" && call.url.includes("/mcp/grants")) return grants;
    if (call.method === "POST" && call.url.includes("/revoke")) return undefined;
    return null;
  });

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/connectors"]}>
        <ConnectorsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { user: userEvent.setup(), calls };
}

const requested = (calls: ApiCall[], path: string) => calls.filter((call) => call.url.includes(path));

describe("ConnectorsPage (docs/MCP.md §9 step 6)", () => {
  it("lists an active connector with when it was connected and last used", async () => {
    renderConnectors();

    expect(await screen.findByText("Claude")).toBeInTheDocument();
    expect(screen.getByText(/Conectat pe/)).toHaveTextContent("folosit ultima dată pe");
  });

  it("names an unused connector as such rather than a date", async () => {
    renderConnectors({ grants: [{ ...GRANT, lastUsedAt: null }] });

    expect(await screen.findByText(/nefolosit încă/)).toBeInTheDocument();
  });

  it("says so when there are no connectors", async () => {
    renderConnectors({ grants: [] });

    expect(await screen.findByText(/Niciun asistent conectat/)).toBeInTheDocument();
  });

  it("offers a retry when the list fails to load", async () => {
    renderConnectors({ grants: failWith(500, "eroare") });

    expect(await screen.findByRole("button", { name: "Încearcă din nou" })).toBeInTheDocument();
  });

  it("revokes only after confirming, naming the connector", async () => {
    const { user, calls } = renderConnectors();
    await screen.findByText("Claude");

    await user.click(screen.getByRole("button", { name: "Revocă" }));

    const dialog = await screen.findByRole("dialog", { name: "Revoci accesul?" });
    expect(dialog).toHaveTextContent("Claude");
    expect(requested(calls, "/revoke")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Revocă accesul" }));

    await waitFor(() => expect(requested(calls, "/mcp/grants/grant-1/revoke")).toHaveLength(1));
  });

  it("closes the dialog without revoking on Renunță", async () => {
    const { user, calls } = renderConnectors();
    await screen.findByText("Claude");

    await user.click(screen.getByRole("button", { name: "Revocă" }));
    await screen.findByRole("dialog");
    await user.click(screen.getByRole("button", { name: "Renunță" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(requested(calls, "/revoke")).toHaveLength(0);
  });
});

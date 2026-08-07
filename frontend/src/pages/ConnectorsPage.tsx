import { useState } from "react";
import type { McpGrant } from "@bookcsi/shared";
import { useGrants } from "../api/mcp";
import { RevokeGrantDialog } from "../components/mcp/RevokeGrantDialog";

const DATE_FORMAT = new Intl.DateTimeFormat("ro-RO", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string): string {
  return DATE_FORMAT.format(new Date(iso));
}

/**
 * docs/MCP.md §2, §9 step 6 — MCP access is revoked from its own screen, not
 * by logging out (§D23 does not extend to it). Listing every active
 * connector with `lastUsedAt` is what makes that survivable: the state is
 * visible here instead of only inferred after something goes wrong.
 */
export function ConnectorsPage() {
  const grants = useGrants();
  const [revoking, setRevoking] = useState<McpGrant | null>(null);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="font-display text-2xl text-ink">Aplicații conectate</h1>
      <p className="mt-2 text-sm text-ink-2">
        Asistenții AI cu acces la biblioteca ta prin MCP. Un conector revocat poate fi reconectat
        oricând, printr-o nouă aprobare.
      </p>

      <div className="mt-8">
        {grants.isPending && (
          <p className="text-sm text-ink-3" role="status">
            Se încarcă…
          </p>
        )}

        {grants.isError && (
          <div className="rounded-lg border border-line bg-surface-2 px-4 py-3">
            <p className="text-sm text-ink-2">Nu am putut încărca lista.</p>
            <button
              type="button"
              onClick={() => void grants.refetch()}
              className="mt-3 rounded-lg border border-accent-quiet bg-accent-quiet/40 px-3 py-1.5 text-sm font-medium text-accent transition-colors duration-150 hover:bg-accent-quiet"
            >
              Încearcă din nou
            </button>
          </div>
        )}

        {grants.data && grants.data.length === 0 && (
          <p className="rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-ink-2">
            Niciun asistent conectat momentan.
          </p>
        )}

        {grants.data && grants.data.length > 0 && (
          <ul className="divide-y divide-line rounded-lg border border-line bg-surface-2">
            {grants.data.map((grant) => (
              <li key={grant.id} className="flex items-center justify-between gap-4 px-4 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">
                    {grant.label ?? grant.clientName}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-3">
                    Conectat pe {formatDate(grant.createdAt)}
                    {" · "}
                    {grant.lastUsedAt
                      ? `folosit ultima dată pe ${formatDate(grant.lastUsedAt)}`
                      : "nefolosit încă"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRevoking(grant)}
                  className="shrink-0 rounded-lg px-3 py-1.5 text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-status-abandoned"
                >
                  Revocă
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {revoking && <RevokeGrantDialog grant={revoking} onClose={() => setRevoking(null)} />}
    </main>
  );
}

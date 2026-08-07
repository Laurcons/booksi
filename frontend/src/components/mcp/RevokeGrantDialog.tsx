import type { McpGrant } from "@bookcsi/shared";
import { Modal } from "../Modal";
import { useRevokeGrant } from "../../api/mcp";

/**
 * S0.3-style confirmation before an irreversible action — same template as
 * `DeleteBookDialog`: name the specific thing being revoked, disable and
 * relabel the button while the mutation is in flight.
 */
export function RevokeGrantDialog({ grant, onClose }: { grant: McpGrant; onClose: () => void }) {
  const revoke = useRevokeGrant();

  return (
    <Modal title="Revoci accesul?" onClose={onClose}>
      <div className="px-6 py-5">
        <p className="text-sm text-ink-2">
          <span className="text-ink">{grant.label ?? grant.clientName}</span> nu va mai putea citi
          sau modifica biblioteca. Poți reconecta asistentul oricând, dintr-o nouă aprobare.
        </p>

        {revoke.error && (
          <p role="alert" className="mt-4 text-sm text-status-abandoned">
            Nu am putut revoca accesul: {revoke.error.message}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
        >
          Renunță
        </button>
        <button
          type="button"
          disabled={revoke.isPending}
          onClick={() => revoke.mutate(grant.id, { onSuccess: onClose })}
          className="rounded-lg border border-status-abandoned/40 px-4 py-2 text-sm font-medium text-ink-2 transition-colors duration-150 hover:border-status-abandoned hover:text-ink disabled:opacity-60"
        >
          {revoke.isPending ? "Se revocă…" : "Revocă accesul"}
        </button>
      </div>
    </Modal>
  );
}

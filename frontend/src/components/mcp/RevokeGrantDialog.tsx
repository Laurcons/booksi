import type { McpGrant } from "@bookcsi/shared";
import { Modal } from "../Modal";
import { useRevokeGrant } from "../../api/mcp";
import { useT } from "../../i18n/locale-context";

/**
 * S0.3-style confirmation before an irreversible action — same template as
 * `DeleteBookDialog`: name the specific thing being revoked, disable and
 * relabel the button while the mutation is in flight.
 */
export function RevokeGrantDialog({ grant, onClose }: { grant: McpGrant; onClose: () => void }) {
  const t = useT();
  const revoke = useRevokeGrant();

  return (
    <Modal title={t("revoke.title")} onClose={onClose}>
      <div className="px-6 py-5">
        <p className="text-sm text-ink-2">
          {t("revoke.body", { client: grant.label ?? grant.clientName })}
        </p>

        {revoke.error && (
          <p role="alert" className="mt-4 text-sm text-error">
            {t("revoke.failed", { message: revoke.error.message })}
          </p>
        )}
      </div>

      <div className="flex justify-end gap-3 border-t border-line px-6 py-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-4 py-2 text-sm text-ink-2 transition-colors duration-150 hover:bg-surface-3 hover:text-ink"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          disabled={revoke.isPending}
          onClick={() => revoke.mutate(grant.id, { onSuccess: onClose })}
          className="rounded-lg border border-status-abandoned/40 px-4 py-2 text-sm font-medium text-ink-2 transition-colors duration-150 hover:border-status-abandoned hover:text-ink disabled:opacity-60"
        >
          {revoke.isPending ? t("connectors.revoking") : t("connectors.revokeConfirm")}
        </button>
      </div>
    </Modal>
  );
}

/**
 * Sync mode selection logic.
 *
 * Implements the decision tree from the architecture PDF (page 11:
 * "Select the sync mode per dataset"):
 *
 *   Change tracking available?
 *     NO  → Full snapshot          (small reference datasets)
 *     YES: CURSOR → Incremental polling (reliable cursor / updated_at)
 *     YES: LOG    → Log-based CDC        (low latency + deletes)
 *
 * "Hard deletes and late updates need explicit handling.  Polling alone may
 * miss deletes; CDC needs log retention, privileges, and resnapshot fallback."
 */

import type { DeleteStrategy, SyncMode } from "./types";

/* ---------------------------------------------------------------------------
 * Source capability detection
 * ------------------------------------------------------------------------- */

export interface SourceCapabilities {
  /** Estimated row count of the full dataset. */
  estimatedRows: number;
  /** Does the source have a reliable updated_at or cursor column? */
  hasCursor: boolean;
  /** Does the source expose a transaction log / change stream (WAL, binlog…)? */
  hasChangeLog: boolean;
  /** Can we read the change log with sufficient retention? */
  hasCdcRetention: boolean;
  /** Does the source signal deletes (tombstones) or soft-delete flags? */
  signalsDeletes: boolean;
}

/* ---------------------------------------------------------------------------
 * Decision tree
 * ------------------------------------------------------------------------- */

/**
 * Choose the sync mode for a dataset based on source capabilities.
 *
 * Returns the recommended {@link SyncMode} and the reason for the choice so
 * the UI can explain it to the operator.
 */
const selectSyncMode = (
  capabilities: SourceCapabilities,
): { mode: SyncMode; reason: string } => {
  // CDC is the most capable mode: low latency AND captures deletes.
  if (capabilities.hasChangeLog && capabilities.hasCdcRetention) {
    return {
      mode: "log-cdc",
      reason:
        "Change log with sufficient retention is available — CDC provides low-latency change capture and delete detection.",
    };
  }

  // Incremental polling works when there's a reliable cursor.  But if the
  // source performs hard deletes, polling alone will miss them — flag it.
  if (capabilities.hasCursor) {
    if (!capabilities.signalsDeletes) {
      return {
        mode: "incremental-polling",
        reason:
          "Reliable cursor available.  Warning: polling may miss hard deletes — pair with a periodic reconciliation sweep.",
      };
    }
    return {
      mode: "incremental-polling",
      reason:
        "Reliable cursor (updated_at / token) available — incremental polling captures updates efficiently.",
    };
  }

  // Fall back to full snapshot.  For large tables this is expensive, so warn.
  if (capabilities.estimatedRows > 100_000) {
    return {
      mode: "full-snapshot",
      reason:
        "No cursor or change log available.  Full snapshot required — consider adding an updated_at column or enabling CDC for this large table.",
    };
  }

  return {
    mode: "full-snapshot",
    reason:
      "Small reference dataset with no change tracking — full snapshot is the simplest correct option.",
  };
};

/**
 * Choose a delete strategy consistent with the selected sync mode.
 *
 * PDF page 11: "Hard deletes and late updates need explicit handling."
 * PDF page 20: "Delete semantics differ → CDC tombstone or reconciliation
 * policy; do not assume hard delete."
 */
const selectDeleteStrategy = (
  mode: SyncMode,
  capabilities: SourceCapabilities,
): DeleteStrategy => {
  if (mode === "log-cdc") {
    return "cdc-tombstone";
  }

  if (mode === "incremental-polling" && !capabilities.signalsDeletes) {
    // Polling without a soft-delete flag cannot detect hard deletes — we need
    // a reconciliation strategy (periodic full-table diff).
    return "reconciliation";
  }

  return "soft";
};

/**
 * A CDC retention expiry is a hard failure: the cursor position is no longer
 * valid, so we cannot safely continue from where we left off.  The correct
 * recovery is an explicit resnapshot, not skipping ahead.
 *
 * PDF page 46: "CDC retention expired → Explicit failure + reconciliation or
 * resnapshot; never skip to 'now'."
 */
const requiresResnapshot = (capabilities: SourceCapabilities): boolean =>
  !capabilities.hasCdcRetention && capabilities.hasChangeLog;

export const syncModeSelector = {
  selectSyncMode,
  selectDeleteStrategy,
  requiresResnapshot,
};

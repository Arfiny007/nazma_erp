import type {
  FinancialReferenceType,
  LedgerPostingType,
} from "@prisma/client";

/**
 * Strongly typed `postingKey` abstraction.
 *
 * The `postingKey` is the idempotency guard for `LedgerEntry`. Every write is
 * uniquely identified by `(referenceType, referenceId, postingType[, sequence])`
 * so that retried postings collapse to a single row. The unique constraint
 * `LedgerEntry.postingKey` enforces this at the database level.
 *
 * @see ADR-024 §3, ADR-025
 */

/** Namespace prefix so raw keys are unmistakable in logs and audit payloads. */
export const LEDGER_POSTING_KEY_NAMESPACE = "ledger" as const;

/** Character separator between key segments. Choose a value that never appears in an id. */
export const LEDGER_POSTING_KEY_SEPARATOR = ":" as const;

/**
 * Descriptor for the components of a `postingKey`. `sequence` is reserved for
 * future multi-line entries (e.g. per-line journal postings) — omit for
 * single-entry postings.
 */
export interface LedgerPostingKeyDescriptor {
  referenceType: FinancialReferenceType;
  referenceId: string;
  postingType: LedgerPostingType;
  /** Optional deterministic sub-key. Non-negative integer. */
  sequence?: number;
}

/**
 * Build the canonical `postingKey` for a ledger entry.
 *
 * Format:
 *   `ledger:<referenceType>:<referenceId>:<postingType>` (single-line)
 *   `ledger:<referenceType>:<referenceId>:<postingType>:<sequence>` (multi-line)
 *
 * The key is stable across retries: same input ⇒ same key. This is critical
 * for `postReceivableIncrease`/`postReceivableDecrease` retry paths (e.g.,
 * `P2002` on `Invoice.deliveryChallanId` on the invoice issue path).
 */
export function buildLedgerPostingKey(
  descriptor: LedgerPostingKeyDescriptor,
): string {
  assertReferenceIdIsSafe(descriptor.referenceId);

  const base = [
    LEDGER_POSTING_KEY_NAMESPACE,
    descriptor.referenceType,
    descriptor.referenceId,
    descriptor.postingType,
  ].join(LEDGER_POSTING_KEY_SEPARATOR);

  if (descriptor.sequence === undefined) {
    return base;
  }

  if (!Number.isInteger(descriptor.sequence) || descriptor.sequence < 0) {
    throw new RangeError(
      `Ledger posting key sequence must be a non-negative integer, got ${descriptor.sequence}`,
    );
  }

  return `${base}${LEDGER_POSTING_KEY_SEPARATOR}${descriptor.sequence}`;
}

/**
 * Parse a `postingKey` back into its descriptor. Throws if the key is not a
 * canonical ledger posting key. Round-trips with `buildLedgerPostingKey`.
 *
 * @internal Reserved for reconciliation tooling — production posting code
 * should build keys, not parse them.
 */
export function parseLedgerPostingKey(
  key: string,
): LedgerPostingKeyDescriptor {
  const parts = key.split(LEDGER_POSTING_KEY_SEPARATOR);
  if (parts.length < 4 || parts.length > 5) {
    throw new Error(`Malformed ledger posting key: ${key}`);
  }
  const [namespace, referenceType, referenceId, postingType, sequenceRaw] =
    parts;
  if (namespace !== LEDGER_POSTING_KEY_NAMESPACE) {
    throw new Error(
      `Ledger posting key must start with "${LEDGER_POSTING_KEY_NAMESPACE}:", got "${namespace}:"`,
    );
  }
  if (!referenceType || !referenceId || !postingType) {
    throw new Error(`Malformed ledger posting key: ${key}`);
  }

  const descriptor: LedgerPostingKeyDescriptor = {
    referenceType: referenceType as FinancialReferenceType,
    referenceId,
    postingType: postingType as LedgerPostingType,
  };

  if (sequenceRaw !== undefined) {
    const sequence = Number(sequenceRaw);
    if (!Number.isInteger(sequence) || sequence < 0) {
      throw new Error(
        `Malformed ledger posting key sequence in "${key}": ${sequenceRaw}`,
      );
    }
    descriptor.sequence = sequence;
  }

  return descriptor;
}

/** True when the key was produced by `buildLedgerPostingKey`. */
export function isLedgerPostingKey(key: string): boolean {
  try {
    parseLedgerPostingKey(key);
    return true;
  } catch {
    return false;
  }
}

function assertReferenceIdIsSafe(referenceId: string): void {
  if (!referenceId) {
    throw new RangeError("Ledger posting key referenceId must be non-empty");
  }
  if (referenceId.includes(LEDGER_POSTING_KEY_SEPARATOR)) {
    throw new RangeError(
      `Ledger posting key referenceId must not contain the "${LEDGER_POSTING_KEY_SEPARATOR}" separator: ${referenceId}`,
    );
  }
}

/**
 * Financial Initialization Engine — domain errors.
 *
 * Every guard in `opening-balance-validation.ts` and every workflow
 * transition in `opening-balance.ts` throws one of these. Server actions map
 * `code` directly onto `OpeningBalanceErrorCode` (see `opening-balance-types.ts`
 * / `src/types/opening-balance.ts`) — never re-derive the mapping elsewhere.
 *
 * @see ADR-028
 */

export type OpeningBalanceErrorCode =
  | "VALIDATION_ERROR"
  | "DEALER_NOT_FOUND"
  | "ALREADY_INITIALIZED"
  | "RECORD_NOT_FOUND"
  | "INVALID_STATE_TRANSITION"
  | "IMMUTABLE_RECORD"
  | "POSTING_KEY_CONFLICT"
  | "FORBIDDEN"
  | "INTERNAL_ERROR";

export class OpeningBalanceError extends Error {
  readonly code: OpeningBalanceErrorCode;
  readonly messageKey: string;

  constructor(code: OpeningBalanceErrorCode, messageKey: string) {
    super(code);
    this.name = "OpeningBalanceError";
    this.code = code;
    this.messageKey = messageKey;
  }
}

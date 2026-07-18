/**
 * Temporary client trace — PHASE_11E.2C investigation only.
 */
export function isClientTraceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_CLIENT_TRACE === "1";
}

export function clientTrace(label: string, payload?: unknown): void {
  if (!isClientTraceEnabled()) {
    return;
  }
  if (payload === undefined) {
    console.log(`[CLIENT_TRACE] ${label}`);
    return;
  }
  console.log(`[CLIENT_TRACE] ${label}`, payload);
}

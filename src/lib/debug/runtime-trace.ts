import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Temporary runtime trace — PHASE_11E.2B investigation only.
 * Enable with RUNTIME_TRACE=1
 */
const traceStore = new AsyncLocalStorage<string>();

export function isRuntimeTraceEnabled(): boolean {
  return process.env.RUNTIME_TRACE === "1";
}

export function getRuntimeTraceStack(): string {
  return traceStore.getStore() ?? "(no trace)";
}

export function traceLog(message: string): void {
  if (!isRuntimeTraceEnabled()) {
    return;
  }
  console.log(`[RUNTIME_TRACE] ${message} | caller=${getRuntimeTraceStack()}`);
}

export async function runTraced<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isRuntimeTraceEnabled()) {
    return fn();
  }

  const parent = traceStore.getStore();
  const stack = parent ? `${parent} > ${label}` : label;
  return traceStore.run(stack, fn);
}

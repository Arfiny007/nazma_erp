/** Retry delays after each failed attempt (ms). Attempt 1 is immediate. */
const RETRY_DELAYS_MS: readonly number[] = [
  5 * 60 * 1000, // Attempt 2 → +5 minutes
  30 * 60 * 1000, // Attempt 3 → +30 minutes
];

/**
 * Computes the next retry timestamp based on the retry count after a failure.
 * Returns null when retries are exhausted (permanent FAILED).
 */
export function computeNextRetryAt(
  retryCount: number,
  maxRetries: number,
  from: Date = new Date(),
): Date | null {
  if (retryCount >= maxRetries) {
    return null;
  }

  const delayIndex = retryCount - 1;
  if (delayIndex < 0 || delayIndex >= RETRY_DELAYS_MS.length) {
    return null;
  }

  return new Date(from.getTime() + RETRY_DELAYS_MS[delayIndex]!);
}

export function isEligibleForProcessing(
  status: string,
  nextRetryAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (status === "PENDING") {
    if (!nextRetryAt) {
      return true;
    }
    return nextRetryAt <= now;
  }

  if (status === "FAILED") {
    return nextRetryAt !== null && nextRetryAt <= now;
  }

  return false;
}

export const STALE_PROCESSING_THRESHOLD_MS = 15 * 60 * 1000;

export function isStaleProcessing(
  processingStartedAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!processingStartedAt) {
    return true;
  }
  return now.getTime() - processingStartedAt.getTime() > STALE_PROCESSING_THRESHOLD_MS;
}

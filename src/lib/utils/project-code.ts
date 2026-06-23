import type { Prisma } from "@prisma/client";

/**
 * Project code generation utilities.
 *
 * Project codes follow the canonical format `PRJ-000001`, `PRJ-000002`, ...
 * with a fixed-width, zero-padded sequence number. Projects have no dedicated
 * module (per business rules); they are created inline while creating an order,
 * so this generator lives alongside the order utilities.
 */

export const PROJECT_CODE_PREFIX = "PRJ";
export const PROJECT_CODE_SEPARATOR = "-";
export const PROJECT_CODE_PAD_LENGTH = 6;

/** Matches `PRJ-000001` (and naturally any longer sequence). */
const PROJECT_CODE_PATTERN = /^PRJ-(\d+)$/;

/**
 * A Prisma client capable of reading projects. Accepts both the root client and
 * an interactive transaction client so callers can generate codes inside the
 * same transaction that persists the project.
 */
type ProjectReadClient = Pick<Prisma.TransactionClient, "project">;

/** Formats a numeric sequence into a canonical project code. */
export function formatProjectCode(sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(
      `Project code sequence must be a positive integer, received: ${sequence}`,
    );
  }

  const padded = String(sequence).padStart(PROJECT_CODE_PAD_LENGTH, "0");
  return `${PROJECT_CODE_PREFIX}${PROJECT_CODE_SEPARATOR}${padded}`;
}

/**
 * Extracts the numeric sequence from a project code, or `null` when the value
 * does not match the canonical format.
 */
export function parseProjectCodeSequence(projectCode: string): number | null {
  const match = PROJECT_CODE_PATTERN.exec(projectCode.trim());
  if (!match) {
    return null;
  }

  const sequence = Number.parseInt(match[1], 10);
  return Number.isSafeInteger(sequence) ? sequence : null;
}

/**
 * Computes the next project code by inspecting the most recently created
 * project. Must be called inside the same transaction that will persist the new
 * project so the read and write are atomic relative to concurrent inserts; the
 * unique constraint on `Project.projectCode` remains the final guard.
 */
export async function generateNextProjectCode(
  client: ProjectReadClient,
): Promise<string> {
  const latest = await client.project.findFirst({
    orderBy: { createdAt: "desc" },
    select: { projectCode: true },
  });

  const lastSequence = latest
    ? (parseProjectCodeSequence(latest.projectCode) ?? 0)
    : 0;

  return formatProjectCode(lastSequence + 1);
}

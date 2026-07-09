"use client";

import { useState, useTransition } from "react";

import { executeLedgerBackfillAction } from "@/lib/actions/ledger-backfill/execute-ledger-backfill";
import { getReplayStatusAction } from "@/lib/actions/ledger-backfill/get-replay-status";
import { previewLedgerReplayAction } from "@/lib/actions/ledger-backfill/preview-ledger-replay";
import type { LedgerBackfillCandidate } from "@/lib/ledger/backfill";

interface LedgerBackfillReplayControlsProps {
  candidate: LedgerBackfillCandidate;
}

function eligibilityBadge(eligibility: string) {
  const colors: Record<string, string> = {
    ELIGIBLE: "bg-blue-100 text-blue-800",
    RECONCILED: "bg-green-100 text-green-800",
    CACHE_DRIFT: "bg-orange-100 text-orange-800",
    CORRUPTED_CHAIN: "bg-red-100 text-red-800",
    INVALID_HISTORY: "bg-red-100 text-red-800",
    DEALER_NOT_FOUND: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs ${colors[eligibility] ?? "bg-gray-100"}`}
    >
      {eligibility}
    </span>
  );
}

export function LedgerBackfillReplayControls({
  candidate,
}: LedgerBackfillReplayControlsProps) {
  const [isPending, startTransition] = useTransition();
  const [eligibility, setEligibility] = useState<string | null>(null);
  const [pendingEvents, setPendingEvents] = useState<number | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canReplay =
    candidate.requiresBackfill &&
    candidate.reason !== "CACHE_DRIFT";

  function handleStatus() {
    startTransition(async () => {
      setError(null);
      setResult(null);
      const response = await getReplayStatusAction({
        dealerCode: candidate.dealerCode,
      });
      if (!response.success) {
        setError(response.error.messageKey);
        return;
      }
      setEligibility(response.data.eligibility);
      setPendingEvents(response.data.pendingEvents);
    });
  }

  function handlePreview() {
    startTransition(async () => {
      setError(null);
      setResult(null);
      const response = await previewLedgerReplayAction({
        dealerCode: candidate.dealerCode,
      });
      if (!response.success) {
        setError(response.error.messageKey);
        return;
      }
      const { data } = response;
      setEligibility(data.eligibility);
      setPendingEvents(data.pendingEvents);
      setResult(
        `Preview: ${data.pendingEvents} pending events. Projected balance ${data.projectedFinalBalance} vs dealer ${data.dealerBalance}. Parity: ${data.parityMatch ? "match" : "MISMATCH"}.`,
      );
    });
  }

  function handleReplay() {
    startTransition(async () => {
      setError(null);
      setResult(null);
      const response = await executeLedgerBackfillAction({
        dealerCode: candidate.dealerCode,
      });
      if (!response.success) {
        setError(response.error.messageKey);
        return;
      }
      const { result: replayResult, report } = response.data;
      setEligibility(replayResult.success ? "ELIGIBLE" : "INVALID_HISTORY");
      setResult(report.summary);
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          className="rounded border px-2 py-0.5 text-xs disabled:opacity-50"
          disabled={isPending}
          onClick={handleStatus}
        >
          Status
        </button>
        {canReplay && (
          <>
            <button
              type="button"
              className="rounded border px-2 py-0.5 text-xs disabled:opacity-50"
              disabled={isPending}
              onClick={handlePreview}
            >
              Preview
            </button>
            <button
              type="button"
              className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white disabled:opacity-50"
              disabled={isPending}
              onClick={handleReplay}
            >
              Replay
            </button>
          </>
        )}
      </div>
      {eligibility && (
        <div className="flex items-center gap-2">
          {eligibilityBadge(eligibility)}
          {pendingEvents !== null && (
            <span className="text-xs text-muted-foreground">
              Pending: {pendingEvents}
            </span>
          )}
        </div>
      )}
      {result && (
        <p className="text-xs text-green-700">{result}</p>
      )}
      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}

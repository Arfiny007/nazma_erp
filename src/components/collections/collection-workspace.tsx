"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { CollectionStatus, FinancialReferenceType, type UserRole } from "@prisma/client";

import {
  buildAllocationLines,
  CollectionAllocationWorkspace,
  sumAllocationInputs,
  type AllocationInputMap,
} from "@/components/collections/collection-allocation-workspace";
import { CollectionAllocationSummary } from "@/components/collections/collection-allocation-summary";
import { CollectionDealerSummaryCard } from "@/components/collections/collection-dealer-summary-card";
import {
  CollectionInfoForm,
  collectionToFormValues,
  type CollectionFormValues,
} from "@/components/collections/collection-info-form";
import { useLanguage } from "@/contexts/LanguageContext";
import { allocateCollection } from "@/lib/actions/collections/allocate-collection";
import { cancelDraftCollection } from "@/lib/actions/collections/cancel-draft-collection";
import { confirmCollection } from "@/lib/actions/collections/confirm-collection";
import { createCollection } from "@/lib/actions/collections/create-collection";
import { getDealerCollectionContext } from "@/lib/actions/collections/get-dealer-collection-context";
import { previewCollectionAllocation } from "@/lib/actions/collections/preview-collection-allocation";
import { updateCollection } from "@/lib/actions/collections/update-collection";
import { hasPermission } from "@/lib/permissions";
import { useFormatMoney } from "@/lib/utils/use-format-money";
import type { DealerDTO } from "@/types/dealer";
import type {
  CollectionDetailDTO,
  DealerCollectionContextDTO,
} from "@/types/collection";
import { DealerCombobox } from "@/components/orders/dealer-combobox";

export type CollectionWorkspaceMode = "create" | "edit" | "allocate";

interface CollectionWorkspaceProps {
  mode: CollectionWorkspaceMode;
  collection?: CollectionDetailDTO | null;
  userRole: UserRole;
  initialContext?: DealerCollectionContextDTO | null;
}

export function CollectionWorkspace({
  mode,
  collection: initialCollection,
  userRole,
  initialContext = null,
}: CollectionWorkspaceProps) {
  const { t, locale } = useLanguage();
  const formatMoney = useFormatMoney(locale);
  const router = useRouter();

  const canCreate = hasPermission(userRole, "collections:create");
  const canEdit = hasPermission(userRole, "collections:edit");
  const canDelete = hasPermission(userRole, "collections:delete");

  const [collection, setCollection] = useState<CollectionDetailDTO | null>(
    initialCollection ?? null,
  );
  const [dealer, setDealer] = useState<DealerDTO | null>(null);
  const [context, setContext] = useState<DealerCollectionContextDTO | null>(
    initialContext,
  );
  const [contextLoading, setContextLoading] = useState(false);
  const [formValues, setFormValues] = useState<CollectionFormValues>(
    collectionToFormValues(initialCollection),
  );
  const [allocations, setAllocations] = useState<AllocationInputMap>({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewTotals, setPreviewTotals] = useState<{
    allocatedAmount: string;
    unallocatedAmount: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isDraft = !collection || collection.status === CollectionStatus.Draft;
  const isAllocateMode = mode === "allocate";
  const allocationDisabled =
    isAllocateMode
      ? collection?.status === CollectionStatus.Reversed ||
        Number.parseFloat(collection?.unallocatedAmount ?? "0") <= 0
      : true;

  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    [locale],
  );

  const formatDate = useCallback(
    (value: string) => dateFormatter.format(new Date(value)),
    [dateFormatter],
  );

  const refreshDealerContext = useCallback(async (dealerCode: string) => {
    setContextLoading(true);
    const result = await getDealerCollectionContext({ dealerCode });
    setContextLoading(false);
    setContext(result.success ? result.data : null);
  }, []);

  const refreshAllocationPreview = useCallback(
    async (nextAllocations: AllocationInputMap) => {
      if (!isAllocateMode || !collection) {
        return;
      }

      const lines = buildAllocationLines(nextAllocations);
      if (lines.length === 0) {
        setPreviewTotals(null);
        setPreviewLoading(false);
        return;
      }

      setPreviewLoading(true);
      const result = await previewCollectionAllocation({
        collectionId: collection.id,
        allocations: lines.map((line) => ({
          referenceType: FinancialReferenceType.Invoice,
          referenceId: line.referenceId,
          allocatedAmount: line.allocatedAmount,
          allocationOrder: line.allocationOrder,
        })),
      });
      setPreviewLoading(false);

      if (result.success) {
        setPreviewTotals({
          allocatedAmount: result.data.totalApplicable,
          unallocatedAmount: result.data.unallocatedAfter,
        });
      } else {
        setPreviewTotals(null);
      }
    },
    [collection, isAllocateMode],
  );

  const allocationLines = buildAllocationLines(allocations);
  const hasPreviewLines = isAllocateMode && allocationLines.length > 0;

  const receivedAmount =
    isAllocateMode && collection
      ? collection.receivedAmount
      : formValues.receivedAmount || "0.00";

  const allocatedAmount =
    hasPreviewLines && previewTotals
      ? previewTotals.allocatedAmount
      : isAllocateMode && collection
        ? collection.allocatedAmount
        : sumAllocationInputs(allocations);

  const unallocatedAmount =
    hasPreviewLines && previewTotals
      ? previewTotals.unallocatedAmount
      : isAllocateMode && collection
        ? collection.unallocatedAmount
        : (() => {
            const received = Number.parseFloat(receivedAmount) || 0;
            const allocated = Number.parseFloat(allocatedAmount) || 0;
            return Math.max(received - allocated, 0).toFixed(2);
          })();

  const advanceCredit = unallocatedAmount;

  const dealerBalanceAfter = context?.dealer
    ? (() => {
        const current = Number.parseFloat(context.dealer.currentBalance);
        const received = Number.parseFloat(receivedAmount) || 0;
        if (isAllocateMode) return context.dealer.currentBalance;
        return (current - received).toFixed(2);
      })()
    : null;

  const handleDealerChange = (next: DealerDTO | null) => {
    if (mode !== "create") return;
    setDealer(next);
    if (!next) {
      setContext(null);
      return;
    }
    setAllocations({});
    setPreviewTotals(null);
    void refreshDealerContext(next.dealerCode);
  };

  const handleAllocationChange = (invoiceId: string, value: string) => {
    const next = { ...allocations, [invoiceId]: value };
    setAllocations(next);
    void refreshAllocationPreview(next);
  };

  const persistDraft = async (): Promise<CollectionDetailDTO | null> => {
    if (!dealer && !collection && !initialCollection) {
      setError(t("collection.workspace.dealerRequired"));
      return null;
    }

    const dealerCode =
      dealer?.dealerCode ?? collection?.dealerCode ?? initialCollection?.dealerCode;
    if (!dealerCode) {
      setError(t("collection.workspace.dealerRequired"));
      return null;
    }

    const payload = {
      dealerCode,
      collectionDate: formValues.collectionDate,
      paymentMethod: formValues.paymentMethod,
      receivedAmount: formValues.receivedAmount,
      referenceNumber: formValues.referenceNumber || null,
      bankName: formValues.bankName || null,
      remarks: formValues.remarks || null,
      isAdvancePayment: false,
    };

    if (collection) {
      const result = await updateCollection({ id: collection.id, ...payload });
      if (!result.success) {
        setError(t(result.error.messageKey));
        return null;
      }
      setCollection(result.data);
      return result.data;
    }

    const result = await createCollection(payload);
    if (!result.success) {
      setError(t(result.error.messageKey));
      return null;
    }
    setCollection(result.data);
    router.replace(`/collections/${result.data.id}/edit`);
    return result.data;
  };

  const applyAllocations = async (collectionId: string) => {
    const lines = buildAllocationLines(allocations);
    if (lines.length === 0) return true;

    const result = await allocateCollection({
      collectionId,
      allocations: lines.map((line) => ({
        referenceType: FinancialReferenceType.Invoice,
        referenceId: line.referenceId,
        allocatedAmount: line.allocatedAmount,
        allocationOrder: line.allocationOrder,
      })),
    });

    if (!result.success) {
      setError(t(result.error.messageKey));
      return false;
    }

    setCollection(result.data);
    return true;
  };

  const handleSaveDraft = async () => {
    if (!canCreate && !canEdit) return;
    setSubmitting(true);
    setError(null);
    await persistDraft();
    setSubmitting(false);
  };

  const handleConfirm = async () => {
    if (!canEdit) return;
    setSubmitting(true);
    setError(null);

    const saved = await persistDraft();
    if (!saved) {
      setSubmitting(false);
      return;
    }

    const confirmResult = await confirmCollection({ id: saved.id });
    if (!confirmResult.success) {
      setError(t(confirmResult.error.messageKey));
      setSubmitting(false);
      return;
    }

    setSubmitting(false);
    const unallocated = Number.parseFloat(confirmResult.data.unallocatedAmount);
    if (unallocated > 0) {
      router.push(`/collections/${saved.id}/allocate`);
    } else {
      router.push(`/collections/${saved.id}`);
    }
  };

  const handleAllocate = async () => {
    if (!canEdit || !collection) return;
    setSubmitting(true);
    setError(null);

    const ok = await applyAllocations(collection.id);
    setSubmitting(false);
    if (ok) {
      router.push(`/collections/${collection.id}`);
    }
  };

  const handleCancelDraft = async () => {
    if (!canDelete || !collection) return;
    setSubmitting(true);
    const result = await cancelDraftCollection({ id: collection.id });
    setSubmitting(false);
    if (result.success) {
      router.push("/collections");
    } else {
      setError(t(result.error.messageKey));
    }
  };

  const showWorkflow =
    (mode === "create" && canCreate) ||
    (mode === "edit" && isDraft && canEdit) ||
    (mode === "allocate" && canEdit);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
      <div className="space-y-6 lg:col-span-2">
        {mode === "create" && (
          <section className="relative z-20 rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">
              {t("collection.workspace.dealer")}
            </h2>
            <DealerCombobox value={dealer} onChange={handleDealerChange} />
          </section>
        )}

        <CollectionDealerSummaryCard
          dealer={context?.dealer ?? null}
          loading={contextLoading}
        />

        <CollectionInfoForm
          values={formValues}
          collectionNo={collection?.collectionNo}
          readOnly={isAllocateMode || !isDraft}
          onChange={isDraft && !isAllocateMode ? setFormValues : undefined}
        />

        <CollectionAllocationWorkspace
          invoices={context?.outstandingInvoices ?? []}
          allocations={allocations}
          disabled={allocationDisabled}
          loading={contextLoading}
          formatMoney={formatMoney}
          formatDate={formatDate}
          onAllocationChange={handleAllocationChange}
        />
      </div>

      <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <CollectionAllocationSummary
          receivedAmount={receivedAmount}
          allocatedAmount={allocatedAmount}
          unallocatedAmount={unallocatedAmount}
          advanceCredit={advanceCredit}
          dealerBalanceAfter={dealerBalanceAfter}
          formatMoney={formatMoney}
          loading={previewLoading}
        />

        {error && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200/80 bg-rose-50/50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-400"
          >
            {error}
          </p>
        )}

        {showWorkflow && (
          <section className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <header className="border-b border-slate-100 px-5 py-4 dark:border-slate-800/80">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {t("collection.workspace.workflowActions")}
              </h2>
            </header>
            <div className="space-y-2 p-5">
              {mode !== "allocate" && isDraft && (
                <>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleSaveDraft()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                  >
                    {submitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                    {t("collection.actions.saveDraft")}
                  </button>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => void handleConfirm()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900"
                  >
                    {submitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                    {t("collection.actions.confirm")}
                  </button>
                  {collection && canDelete && (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => void handleCancelDraft()}
                      className="inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                    >
                      {t("collection.actions.cancelDraft")}
                    </button>
                  )}
                </>
              )}

              {mode === "allocate" && (
                <button
                  type="button"
                  disabled={submitting || allocationDisabled}
                  onClick={() => void handleAllocate()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-700 disabled:opacity-50 dark:bg-white dark:text-slate-900"
                >
                  {submitting && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
                  {t("collection.actions.applyAllocation")}
                </button>
              )}

              <Link
                href={
                  collection ? `/collections/${collection.id}` : "/collections"
                }
                className="block text-center text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400"
              >
                {t("collection.actions.cancel")}
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

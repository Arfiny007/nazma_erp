import { getDealerStatement } from "@/lib/actions/ledger-statement/get-dealer-statement";
import { mergeDealerStatementPages } from "@/components/documents/statement/statement-mapper";
import type { DealerStatementQueryPayload } from "@/components/ledger/statement-row-styles";
import type { ActionResult, DealerStatementDTO } from "@/types/ledger-statement";

/** Maximum rows per server fetch — bounded by schema `pageSize` max (200). */
export const STATEMENT_PRINT_PAGE_SIZE = 200;

/**
 * Fetches the full Dealer Statement for print by walking paginated server
 * responses. Never recalculates balances — merges row pages only.
 */
export async function fetchDealerStatementForPrint(
  filters: Omit<DealerStatementQueryPayload, "page" | "pageSize">,
): Promise<ActionResult<DealerStatementDTO>> {
  const first = await getDealerStatement({
    ...filters,
    page: 1,
    pageSize: STATEMENT_PRINT_PAGE_SIZE,
  });

  if (!first.success) {
    return first;
  }

  const { pageCount } = first.data.pagination;
  if (pageCount <= 1) {
    return first;
  }

  let merged = first.data;

  for (let page = 2; page <= pageCount; page += 1) {
    const next = await getDealerStatement({
      ...filters,
      page,
      pageSize: STATEMENT_PRINT_PAGE_SIZE,
    });

    if (!next.success) {
      return next;
    }

    merged = mergeDealerStatementPages(merged, next.data.rows);
  }

  return { success: true, data: merged };
}

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { toOpeningBalanceDTO } from "@/lib/finance/initialization/opening-balance-service";
import type {
  InitializationStatusDTO,
  UninitializedDealerDTO,
} from "@/types/opening-balance";

/**
 * Financial Initialization Engine — read-side status queries (PHASE_07C).
 *
 * Backs `getInitializationStatus()` and `listUninitializedDealers()`. Pure
 * reads — never mutates a dealer or an `OpeningBalance` row.
 *
 * @see ADR-028
 */

const openingBalanceDetailInclude = {
  dealer: { select: { companyName: true } },
  createdBy: { select: { name: true } },
} satisfies Prisma.OpeningBalanceInclude;

/**
 * Resolves a single dealer's initialization state. `isInitialized` is true
 * only once the record reaches `Locked` — an in-progress Draft/Validated
 * record still reports `isInitialized: false` (but blocks a second record
 * via the `dealerCode` unique constraint upstream).
 */
export async function getInitializationStatusForDealer(
  dealerCode: string,
): Promise<InitializationStatusDTO | null> {
  const dealer = await prisma.dealer.findUnique({
    where: { dealerCode },
    select: { dealerCode: true, companyName: true },
  });

  if (!dealer) {
    return null;
  }

  const openingBalance = await prisma.openingBalance.findUnique({
    where: { dealerCode },
    include: openingBalanceDetailInclude,
  });

  return {
    dealerCode: dealer.dealerCode,
    dealerName: dealer.companyName,
    isInitialized: openingBalance?.status === "Locked",
    openingBalance: openingBalance ? toOpeningBalanceDTO(openingBalance) : null,
  };
}

export interface ListUninitializedDealersParams {
  search?: string;
  page: number;
  pageSize: number;
}

export interface PaginatedUninitializedDealers {
  items: UninitializedDealerDTO[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

/**
 * Lists dealers with NO `OpeningBalance` row at all — the Dealer Selection
 * step's candidate pool. A dealer with an in-progress Draft is deliberately
 * excluded: the unique `dealerCode` constraint means a second draft can
 * never be created for them, so they must resume their existing record via
 * `getInitializationStatus()` instead of appearing here again.
 */
export async function listUninitializedDealers(
  params: ListUninitializedDealersParams,
): Promise<PaginatedUninitializedDealers> {
  const { search, page, pageSize } = params;

  const where: Prisma.DealerWhereInput = {
    openingBalance: null,
    ...(search
      ? {
          OR: [
            { dealerCode: { contains: search, mode: "insensitive" } },
            { companyName: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, dealers] = await prisma.$transaction([
    prisma.dealer.count({ where }),
    prisma.dealer.findMany({
      where,
      orderBy: { companyName: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        dealerCode: true,
        companyName: true,
        district: true,
        territory: true,
        currentBalance: true,
        creditLimit: true,
      },
    }),
  ]);

  return {
    items: dealers.map((dealer) => ({
      id: dealer.id,
      dealerCode: dealer.dealerCode,
      companyName: dealer.companyName,
      district: dealer.district,
      territory: dealer.territory,
      currentBalance: dealer.currentBalance.toFixed(2),
      creditLimit: dealer.creditLimit.toFixed(2),
    })),
    total,
    page,
    pageSize,
    pageCount: total === 0 ? 0 : Math.ceil(total / pageSize),
  };
}

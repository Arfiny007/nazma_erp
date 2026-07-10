-- CreateEnum
CREATE TYPE "FinancialIntegrityScanStatus" AS ENUM ('Completed', 'Failed');

-- CreateTable
CREATE TABLE "FinancialIntegrityScan" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "totalDealers" INTEGER NOT NULL,
    "consistentDealers" INTEGER NOT NULL,
    "driftedDealers" INTEGER NOT NULL,
    "missingLedgerDealers" INTEGER NOT NULL,
    "corruptedDealers" INTEGER NOT NULL,
    "status" "FinancialIntegrityScanStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialIntegrityScan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FinancialIntegrityScan_startedAt_idx" ON "FinancialIntegrityScan"("startedAt");

-- CreateIndex
CREATE INDEX "FinancialIntegrityScan_status_idx" ON "FinancialIntegrityScan"("status");

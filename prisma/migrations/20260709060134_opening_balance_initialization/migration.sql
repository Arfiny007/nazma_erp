-- CreateEnum
CREATE TYPE "public"."OpeningBalanceStatus" AS ENUM ('Draft', 'Validated', 'Posted', 'Locked');

-- CreateEnum
CREATE TYPE "public"."OpeningBalanceSource" AS ENUM ('Manual', 'CsvImport', 'ExcelImport', 'ErpMigration');

-- CreateTable
CREATE TABLE "public"."OpeningBalance" (
    "id" TEXT NOT NULL,
    "dealerCode" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."OpeningBalanceStatus" NOT NULL DEFAULT 'Draft',
    "source" "public"."OpeningBalanceSource" NOT NULL DEFAULT 'Manual',
    "referenceNo" TEXT,
    "remarks" TEXT,
    "createdById" TEXT NOT NULL,
    "validatedAt" TIMESTAMP(3),
    "validatedById" TEXT,
    "postedAt" TIMESTAMP(3),
    "postedById" TEXT,
    "lockedAt" TIMESTAMP(3),
    "ledgerEntryId" TEXT,
    "postingKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpeningBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OpeningBalance_dealerCode_key" ON "public"."OpeningBalance"("dealerCode");

-- CreateIndex
CREATE UNIQUE INDEX "OpeningBalance_postingKey_key" ON "public"."OpeningBalance"("postingKey");

-- CreateIndex
CREATE INDEX "OpeningBalance_dealerCode_idx" ON "public"."OpeningBalance"("dealerCode");

-- CreateIndex
CREATE INDEX "OpeningBalance_status_idx" ON "public"."OpeningBalance"("status");

-- CreateIndex
CREATE INDEX "OpeningBalance_createdById_idx" ON "public"."OpeningBalance"("createdById");

-- CreateIndex
CREATE INDEX "LedgerEntry_referenceType_referenceId_idx" ON "public"."LedgerEntry"("referenceType", "referenceId");

-- AddForeignKey
ALTER TABLE "public"."OpeningBalance" ADD CONSTRAINT "OpeningBalance_dealerCode_fkey" FOREIGN KEY ("dealerCode") REFERENCES "public"."Dealer"("dealerCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpeningBalance" ADD CONSTRAINT "OpeningBalance_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpeningBalance" ADD CONSTRAINT "OpeningBalance_validatedById_fkey" FOREIGN KEY ("validatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OpeningBalance" ADD CONSTRAINT "OpeningBalance_postedById_fkey" FOREIGN KEY ("postedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

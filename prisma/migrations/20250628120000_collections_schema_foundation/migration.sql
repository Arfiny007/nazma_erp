-- CreateEnum
CREATE TYPE "public"."CollectionStatus" AS ENUM ('Draft', 'Confirmed', 'PartiallyAllocated', 'Allocated', 'Reversed');

-- CreateEnum
CREATE TYPE "public"."CollectionPaymentMethod" AS ENUM ('Cash', 'Bank', 'Cheque', 'MobileBanking', 'OnlineTransfer', 'Other');

-- CreateEnum
CREATE TYPE "public"."FinancialReferenceType" AS ENUM ('Invoice', 'OpeningBalance', 'CreditNote', 'DebitNote', 'ManualAdjustment', 'JournalEntry');

-- DropForeignKey
ALTER TABLE "public"."Collection" DROP CONSTRAINT "Collection_invoiceId_fkey";

-- DropIndex
DROP INDEX "public"."Collection_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Collection_invoiceId_idx";

-- DropIndex
DROP INDEX "public"."Collection_paymentMethod_idx";

-- DropIndex
DROP INDEX "public"."Collection_receiptNo_key";

-- AlterTable
ALTER TABLE "public"."Collection" DROP COLUMN "amount",
DROP COLUMN "attachmentUrl",
DROP COLUMN "invoiceId",
DROP COLUMN "receiptNo",
DROP COLUMN "referenceNo",
ADD COLUMN     "allocatedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "collectionDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "collectionNo" TEXT NOT NULL,
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedById" TEXT,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "isAdvancePayment" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receivedAmount" DECIMAL(18,2) NOT NULL,
ADD COLUMN     "referenceNumber" TEXT,
ADD COLUMN     "remarks" TEXT,
ADD COLUMN     "reversalReason" TEXT,
ADD COLUMN     "reversedAt" TIMESTAMP(3),
ADD COLUMN     "reversedCollectionId" TEXT,
ADD COLUMN     "status" "public"."CollectionStatus" NOT NULL DEFAULT 'Draft',
ADD COLUMN     "unallocatedAmount" DECIMAL(18,2) NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
DROP COLUMN "paymentMethod",
ADD COLUMN     "paymentMethod" "public"."CollectionPaymentMethod" NOT NULL;

-- AlterTable
ALTER TABLE "public"."Dealer" ADD COLUMN     "lastCollectionDate" TIMESTAMP(3),
ADD COLUMN     "lastInvoiceDate" TIMESTAMP(3),
ADD COLUMN     "monthlyTarget" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalSales" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "yearlyTarget" DECIMAL(18,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "public"."CollectionAllocation" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "referenceType" "public"."FinancialReferenceType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(18,2) NOT NULL,
    "allocationOrder" INTEGER NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionAllocation_collectionId_idx" ON "public"."CollectionAllocation"("collectionId");

-- CreateIndex
CREATE INDEX "CollectionAllocation_referenceType_idx" ON "public"."CollectionAllocation"("referenceType");

-- CreateIndex
CREATE INDEX "CollectionAllocation_referenceId_idx" ON "public"."CollectionAllocation"("referenceId");

-- CreateIndex
CREATE INDEX "CollectionAllocation_referenceType_referenceId_idx" ON "public"."CollectionAllocation"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionAllocation_collectionId_referenceType_referenceId_key" ON "public"."CollectionAllocation"("collectionId", "referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_collectionNo_key" ON "public"."Collection"("collectionNo");

-- CreateIndex
CREATE INDEX "Collection_collectionNo_idx" ON "public"."Collection"("collectionNo");

-- CreateIndex
CREATE INDEX "Collection_collectionDate_idx" ON "public"."Collection"("collectionDate");

-- CreateIndex
CREATE INDEX "Collection_status_idx" ON "public"."Collection"("status");

-- CreateIndex
CREATE INDEX "Collection_confirmedAt_idx" ON "public"."Collection"("confirmedAt");

-- CreateIndex
CREATE INDEX "Collection_createdById_idx" ON "public"."Collection"("createdById");

-- CreateIndex
CREATE INDEX "Collection_confirmedById_idx" ON "public"."Collection"("confirmedById");

-- AddForeignKey
ALTER TABLE "public"."Collection" ADD CONSTRAINT "Collection_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Collection" ADD CONSTRAINT "Collection_reversedCollectionId_fkey" FOREIGN KEY ("reversedCollectionId") REFERENCES "public"."Collection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Collection" ADD CONSTRAINT "Collection_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CollectionAllocation" ADD CONSTRAINT "CollectionAllocation_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "public"."Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

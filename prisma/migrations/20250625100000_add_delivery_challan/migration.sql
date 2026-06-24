-- CreateEnum
CREATE TYPE "public"."DeliveryChallanStatus" AS ENUM ('Draft', 'Confirmed', 'Cancelled');

-- AlterEnum
ALTER TYPE "public"."OrderStatus" ADD VALUE 'Cancelled';

-- DropIndex
DROP INDEX "public"."Invoice_orderId_key";

-- AlterTable
ALTER TABLE "public"."Invoice" ADD COLUMN     "deliveryChallanId" TEXT;

-- CreateTable
CREATE TABLE "public"."DeliveryChallan" (
    "id" TEXT NOT NULL,
    "challanNo" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "dealerCode" TEXT NOT NULL,
    "status" "public"."DeliveryChallanStatus" NOT NULL DEFAULT 'Draft',
    "deliveryMode" "public"."DeliveryMode" NOT NULL,
    "vehicleNo" TEXT,
    "driverName" TEXT,
    "remarks" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryChallan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DeliveryChallanItem" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "DeliveryChallanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryChallan_challanNo_key" ON "public"."DeliveryChallan"("challanNo");

-- CreateIndex
CREATE INDEX "DeliveryChallan_orderId_idx" ON "public"."DeliveryChallan"("orderId");

-- CreateIndex
CREATE INDEX "DeliveryChallan_dealerCode_idx" ON "public"."DeliveryChallan"("dealerCode");

-- CreateIndex
CREATE INDEX "DeliveryChallan_status_idx" ON "public"."DeliveryChallan"("status");

-- CreateIndex
CREATE INDEX "DeliveryChallan_createdById_idx" ON "public"."DeliveryChallan"("createdById");

-- CreateIndex
CREATE INDEX "DeliveryChallan_confirmedById_idx" ON "public"."DeliveryChallan"("confirmedById");

-- CreateIndex
CREATE INDEX "DeliveryChallan_createdAt_idx" ON "public"."DeliveryChallan"("createdAt");

-- CreateIndex
CREATE INDEX "DeliveryChallan_dispatchedAt_idx" ON "public"."DeliveryChallan"("dispatchedAt");

-- CreateIndex
CREATE INDEX "DeliveryChallanItem_challanId_idx" ON "public"."DeliveryChallanItem"("challanId");

-- CreateIndex
CREATE INDEX "DeliveryChallanItem_orderItemId_idx" ON "public"."DeliveryChallanItem"("orderItemId");

-- CreateIndex
CREATE INDEX "DeliveryChallanItem_productId_idx" ON "public"."DeliveryChallanItem"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_deliveryChallanId_key" ON "public"."Invoice"("deliveryChallanId");

-- CreateIndex
CREATE INDEX "Invoice_orderId_idx" ON "public"."Invoice"("orderId");

-- AddForeignKey
ALTER TABLE "public"."DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_dealerCode_fkey" FOREIGN KEY ("dealerCode") REFERENCES "public"."Dealer"("dealerCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryChallan" ADD CONSTRAINT "DeliveryChallan_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "public"."DeliveryChallan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "public"."SalesOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DeliveryChallanItem" ADD CONSTRAINT "DeliveryChallanItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_deliveryChallanId_fkey" FOREIGN KEY ("deliveryChallanId") REFERENCES "public"."DeliveryChallan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

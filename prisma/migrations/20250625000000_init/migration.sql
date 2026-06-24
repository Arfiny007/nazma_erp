-- Baseline migration: captures schema state before delivery challan (db push era).
-- Marked as applied via `prisma migrate resolve` — do not re-run against existing databases.

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."DeliveryMode" AS ENUM ('Truck', 'Courier', 'Pickup', 'Company_Delivery');

-- CreateEnum
CREATE TYPE "public"."InvoiceStatus" AS ENUM ('Draft', 'Issued', 'Paid', 'Partial', 'Overdue');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('Draft', 'Pending_Approval', 'Approved', 'Rejected', 'Delivered');

-- CreateEnum
CREATE TYPE "public"."PaymentMethod" AS ENUM ('Cash', 'Bank', 'Cheque', 'Mobile_Banking');

-- CreateEnum
CREATE TYPE "public"."UserRole" AS ENUM ('Super_Admin', 'Manager', 'Accounts', 'SR');

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Collection" (
    "id" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "dealerCode" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "paymentMethod" "public"."PaymentMethod" NOT NULL,
    "referenceNo" TEXT,
    "attachmentUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Dealer" (
    "id" TEXT NOT NULL,
    "dealerCode" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "proprietorName" TEXT,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "territory" TEXT NOT NULL,
    "creditLimit" DECIMAL(18,2) NOT NULL,
    "currentBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dealer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DueReport" (
    "id" TEXT NOT NULL,
    "dealerCode" TEXT NOT NULL,
    "totalDue" DECIMAL(18,2) NOT NULL,
    "overdueAmount" DECIMAL(18,2) NOT NULL,
    "overdueDays" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DueReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "dealerCode" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL,
    "vat" DECIMAL(18,2) NOT NULL,
    "previousDue" DECIMAL(18,2) NOT NULL,
    "collectionReceived" DECIMAL(18,2) NOT NULL,
    "grandTotal" DECIMAL(18,2) NOT NULL,
    "currentDue" DECIMAL(18,2) NOT NULL,
    "deliveryMode" "public"."DeliveryMode" NOT NULL,
    "vehicleNo" TEXT,
    "driverName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "public"."InvoiceStatus" NOT NULL DEFAULT 'Draft',

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LedgerEntry" (
    "id" TEXT NOT NULL,
    "dealerCode" TEXT NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL,
    "credit" DECIMAL(18,2) NOT NULL,
    "balance" DECIMAL(18,2) NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "modelNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameBn" TEXT,
    "categoryId" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "description" TEXT,
    "currentPrice" DECIMAL(18,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Project" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalesOrder" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "dealerCode" TEXT NOT NULL,
    "status" "public"."OrderStatus" NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL,
    "vat" DECIMAL(18,2) NOT NULL,
    "grandTotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdById" TEXT,
    "projectId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SalesOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DECIMAL(18,2) NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "discount" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "SalesOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "public"."UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "public"."AuditLog"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "public"."AuditLog"("entityType" ASC, "entityId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "public"."AuditLog"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "public"."Category"("slug" ASC);

-- CreateIndex
CREATE INDEX "Collection_createdAt_idx" ON "public"."Collection"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "Collection_dealerCode_idx" ON "public"."Collection"("dealerCode" ASC);

-- CreateIndex
CREATE INDEX "Collection_invoiceId_idx" ON "public"."Collection"("invoiceId" ASC);

-- CreateIndex
CREATE INDEX "Collection_paymentMethod_idx" ON "public"."Collection"("paymentMethod" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Collection_receiptNo_key" ON "public"."Collection"("receiptNo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Dealer_dealerCode_key" ON "public"."Dealer"("dealerCode" ASC);

-- CreateIndex
CREATE INDEX "DueReport_createdAt_idx" ON "public"."DueReport"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "DueReport_dealerCode_idx" ON "public"."DueReport"("dealerCode" ASC);

-- CreateIndex
CREATE INDEX "Invoice_createdAt_idx" ON "public"."Invoice"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "Invoice_dealerCode_idx" ON "public"."Invoice"("dealerCode" ASC);

-- CreateIndex
CREATE INDEX "Invoice_dueDate_idx" ON "public"."Invoice"("dueDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNo_key" ON "public"."Invoice"("invoiceNo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "public"."Invoice"("orderId" ASC);

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "public"."Invoice"("status" ASC);

-- CreateIndex
CREATE INDEX "LedgerEntry_dealerCode_idx" ON "public"."LedgerEntry"("dealerCode" ASC);

-- CreateIndex
CREATE INDEX "LedgerEntry_referenceType_referenceId_idx" ON "public"."LedgerEntry"("referenceType" ASC, "referenceId" ASC);

-- CreateIndex
CREATE INDEX "LedgerEntry_transactionDate_idx" ON "public"."LedgerEntry"("transactionDate" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Product_modelNumber_key" ON "public"."Product"("modelNumber" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "public"."Product"("sku" ASC);

-- CreateIndex
CREATE INDEX "Project_dealerId_idx" ON "public"."Project"("dealerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Project_dealerId_name_key" ON "public"."Project"("dealerId" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "Project_name_idx" ON "public"."Project"("name" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Project_projectCode_key" ON "public"."Project"("projectCode" ASC);

-- CreateIndex
CREATE INDEX "SalesOrder_approvedById_idx" ON "public"."SalesOrder"("approvedById" ASC);

-- CreateIndex
CREATE INDEX "SalesOrder_createdAt_idx" ON "public"."SalesOrder"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "SalesOrder_createdById_idx" ON "public"."SalesOrder"("createdById" ASC);

-- CreateIndex
CREATE INDEX "SalesOrder_dealerCode_idx" ON "public"."SalesOrder"("dealerCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "SalesOrder_orderNo_key" ON "public"."SalesOrder"("orderNo" ASC);

-- CreateIndex
CREATE INDEX "SalesOrder_projectId_idx" ON "public"."SalesOrder"("projectId" ASC);

-- CreateIndex
CREATE INDEX "SalesOrder_status_idx" ON "public"."SalesOrder"("status" ASC);

-- CreateIndex
CREATE INDEX "SalesOrderItem_orderId_idx" ON "public"."SalesOrderItem"("orderId" ASC);

-- CreateIndex
CREATE INDEX "SalesOrderItem_productId_idx" ON "public"."SalesOrderItem"("productId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Collection" ADD CONSTRAINT "Collection_dealerCode_fkey" FOREIGN KEY ("dealerCode") REFERENCES "public"."Dealer"("dealerCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Collection" ADD CONSTRAINT "Collection_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DueReport" ADD CONSTRAINT "DueReport_dealerCode_fkey" FOREIGN KEY ("dealerCode") REFERENCES "public"."Dealer"("dealerCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_dealerCode_fkey" FOREIGN KEY ("dealerCode") REFERENCES "public"."Dealer"("dealerCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invoice" ADD CONSTRAINT "Invoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LedgerEntry" ADD CONSTRAINT "LedgerEntry_dealerCode_fkey" FOREIGN KEY ("dealerCode") REFERENCES "public"."Dealer"("dealerCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Project" ADD CONSTRAINT "Project_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "public"."Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrder" ADD CONSTRAINT "SalesOrder_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrder" ADD CONSTRAINT "SalesOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrder" ADD CONSTRAINT "SalesOrder_dealerCode_fkey" FOREIGN KEY ("dealerCode") REFERENCES "public"."Dealer"("dealerCode") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrder" ADD CONSTRAINT "SalesOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."SalesOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SalesOrderItem" ADD CONSTRAINT "SalesOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

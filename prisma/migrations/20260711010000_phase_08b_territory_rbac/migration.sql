-- PHASE_08B — Enterprise Territory RBAC Engine

-- CreateTable
CREATE TABLE "UserTerritoryAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTerritoryAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserTerritoryAssignment_userId_idx" ON "UserTerritoryAssignment"("userId");

-- CreateIndex
CREATE INDEX "UserTerritoryAssignment_territoryId_idx" ON "UserTerritoryAssignment"("territoryId");

-- CreateIndex
CREATE INDEX "UserTerritoryAssignment_userId_isActive_idx" ON "UserTerritoryAssignment"("userId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "UserTerritoryAssignment_userId_territoryId_key" ON "UserTerritoryAssignment"("userId", "territoryId");

-- AddForeignKey
ALTER TABLE "UserTerritoryAssignment" ADD CONSTRAINT "UserTerritoryAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserTerritoryAssignment" ADD CONSTRAINT "UserTerritoryAssignment_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PHASE_08C — Enterprise Dealer Ownership & Territory Migration

CREATE TABLE "DealerOwnershipHistory" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "territoryId" TEXT NOT NULL,
    "assignedSrId" TEXT,
    "assignedById" TEXT NOT NULL,
    "reason" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DealerOwnershipHistory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DealerOwnershipHistory_dealerId_idx" ON "DealerOwnershipHistory"("dealerId");
CREATE INDEX "DealerOwnershipHistory_territoryId_idx" ON "DealerOwnershipHistory"("territoryId");
CREATE INDEX "DealerOwnershipHistory_assignedSrId_idx" ON "DealerOwnershipHistory"("assignedSrId");
CREATE INDEX "DealerOwnershipHistory_dealerId_isActive_idx" ON "DealerOwnershipHistory"("dealerId", "isActive");
CREATE INDEX "DealerOwnershipHistory_isActive_idx" ON "DealerOwnershipHistory"("isActive");

ALTER TABLE "DealerOwnershipHistory" ADD CONSTRAINT "DealerOwnershipHistory_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DealerOwnershipHistory" ADD CONSTRAINT "DealerOwnershipHistory_territoryId_fkey" FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DealerOwnershipHistory" ADD CONSTRAINT "DealerOwnershipHistory_assignedSrId_fkey" FOREIGN KEY ("assignedSrId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DealerOwnershipHistory" ADD CONSTRAINT "DealerOwnershipHistory_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

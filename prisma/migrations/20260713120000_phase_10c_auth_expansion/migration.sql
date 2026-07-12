-- PHASE_10C: Enterprise Authentication & Activation Expansion
-- Additive only — password reset token storage

CREATE TABLE "UserPasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserPasswordResetToken_userId_idx" ON "UserPasswordResetToken"("userId");
CREATE INDEX "UserPasswordResetToken_expiresAt_idx" ON "UserPasswordResetToken"("expiresAt");

ALTER TABLE "UserPasswordResetToken" ADD CONSTRAINT "UserPasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

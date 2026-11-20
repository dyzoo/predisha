-- CreateEnum
CREATE TYPE "AdminSlipDesignStatus" AS ENUM ('DRAFT', 'READY', 'WON');

-- CreateTable
CREATE TABLE "AdminSlipDesign" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "status" "AdminSlipDesignStatus" NOT NULL DEFAULT 'DRAFT',
    "selections" JSONB NOT NULL,
    "stakeMinor" INTEGER NOT NULL,
    "bonusMinor" INTEGER NOT NULL DEFAULT 0,
    "taxPercent" DOUBLE PRECISION NOT NULL DEFAULT 15,
    "reuseCount" INTEGER NOT NULL DEFAULT 1,
    "totalOdds" DOUBLE PRECISION NOT NULL,
    "winningsMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL,
    "payoutMinor" INTEGER NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSlipDesign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminSlipDesign_code_key" ON "AdminSlipDesign"("code");

-- CreateIndex
CREATE INDEX "AdminSlipDesign_status_idx" ON "AdminSlipDesign"("status");

-- CreateIndex
CREATE INDEX "AdminSlipDesign_createdBy_updatedAt_idx" ON "AdminSlipDesign"("createdBy", "updatedAt");

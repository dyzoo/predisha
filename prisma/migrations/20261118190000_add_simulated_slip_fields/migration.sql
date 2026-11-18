-- AlterTable
ALTER TABLE "AdminBetSlip" ADD COLUMN     "liveStartedAt" TIMESTAMP(3),
ADD COLUMN     "manualKickoffAt" TIMESTAMP(3),
ADD COLUMN     "selectionSource" TEXT NOT NULL DEFAULT 'CATALOG',
ADD COLUMN     "simulatedDurationMinutes" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "timeMode" TEXT NOT NULL DEFAULT 'ORIGINAL';

-- CreateIndex
CREATE INDEX "AdminBetSlip_liveStartedAt_idx" ON "AdminBetSlip"("liveStartedAt");

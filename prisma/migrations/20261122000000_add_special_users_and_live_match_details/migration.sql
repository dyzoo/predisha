-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isSpecial" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Fixture" ADD COLUMN     "halfTimeAwayScore" INTEGER,
ADD COLUMN     "halfTimeHomeScore" INTEGER,
ADD COLUMN     "liveAwayScore" INTEGER,
ADD COLUMN     "liveHomeScore" INTEGER,
ADD COLUMN     "liveMinute" INTEGER,
ADD COLUMN     "referee" TEXT,
ADD COLUMN     "venue" TEXT;

ALTER TABLE "AdminBetEntry" ADD COLUMN     "selections" JSONB,
ADD COLUMN     "totalOdds" DOUBLE PRECISION;

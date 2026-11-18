-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'POSTPONED', 'CANCELLED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "PredictionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'STALE', 'INVALIDATED', 'EVALUATED');

-- CreateEnum
CREATE TYPE "SlipStatus" AS ENUM ('PENDING', 'WON', 'LOST', 'VOID');

-- CreateEnum
CREATE TYPE "PlanInterval" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('INACTIVE', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'UNPAID');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "BetTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'BET_STAKE', 'BET_WIN', 'BET_CASHOUT', 'PROMO_BONUS', 'GAME_STAKE', 'GAME_WIN', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "BetTicketStatus" AS ENUM ('OPEN', 'WON', 'LOST', 'VOID', 'CASHED_OUT');

-- CreateEnum
CREATE TYPE "BetGameType" AS ENUM ('MINES', 'DICE', 'ROULETTE', 'SLOTS');

-- CreateEnum
CREATE TYPE "BetGameStatus" AS ENUM ('OPEN', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "BetAviatorBetStatus" AS ENUM ('ACTIVE', 'CASHED_OUT', 'LOST');

-- CreateEnum
CREATE TYPE "AdminBetSlipStatus" AS ENUM ('OPEN', 'FROZEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "AdminBetEntryStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "favoriteSports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "favoriteLeagues" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sport" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "providerId" TEXT,
    "name" TEXT NOT NULL,
    "country" TEXT,
    "season" TEXT,
    "sportId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "providerId" TEXT,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#9CA3AF',
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Fixture" (
    "id" TEXT NOT NULL,
    "providerId" TEXT,
    "competitionId" TEXT NOT NULL,
    "homeTeamId" TEXT NOT NULL,
    "awayTeamId" TEXT NOT NULL,
    "kickoffUtc" TIMESTAMP(3) NOT NULL,
    "status" "FixtureStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeScore" INTEGER,
    "awayScore" INTEGER,
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceProvider" TEXT DEFAULT 'unknown',
    "sourceFilePath" TEXT,
    "sourceRevision" TEXT,
    "retrievedAt" TIMESTAMP(3),
    "sourceUpdatedAt" TIMESTAMP(3),
    "importedAt" TIMESTAMP(3),
    "parserVersion" TEXT,
    "dataQualityStatus" TEXT DEFAULT 'PENDING',
    "isEligibleForTraining" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMatchStat" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT,
    "asOf" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMatchStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModelVersion" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModelVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "modelVersionId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "inputDataAsOf" TIMESTAMP(3) NOT NULL,
    "status" "PredictionStatus" NOT NULL DEFAULT 'DRAFT',
    "dataQualityFlags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "structuredFacts" JSONB NOT NULL,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionOutcome" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "outcomeKey" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PredictionOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionEvaluation" (
    "id" TEXT NOT NULL,
    "predictionId" TEXT NOT NULL,
    "actualOutcome" TEXT NOT NULL,
    "brierScore" DOUBLE PRECISION,
    "logLoss" DOUBLE PRECISION,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionSlip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stake" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "risk" TEXT NOT NULL,
    "odds" DOUBLE PRECISION,
    "oddsSource" TEXT NOT NULL DEFAULT 'model-implied',
    "impliedCombinedOdds" DOUBLE PRECISION NOT NULL,
    "combinedProbability" DOUBLE PRECISION NOT NULL,
    "potentialReturn" DOUBLE PRECISION NOT NULL,
    "netProfit" DOUBLE PRECISION NOT NULL,
    "modelVersion" TEXT,
    "dataAsOf" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "limited" BOOLEAN NOT NULL DEFAULT false,
    "status" "SlipStatus" NOT NULL DEFAULT 'PENDING',
    "brierScore" DOUBLE PRECISION,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PredictionSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PredictionSlipSelection" (
    "id" TEXT NOT NULL,
    "slipId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "homeName" TEXT NOT NULL,
    "awayName" TEXT NOT NULL,
    "kickoffUtc" TIMESTAMP(3) NOT NULL,
    "outcomeKey" TEXT NOT NULL,
    "probability" DOUBLE PRECISION NOT NULL,
    "impliedOdds" DOUBLE PRECISION NOT NULL,
    "homeProbability" DOUBLE PRECISION NOT NULL,
    "drawProbability" DOUBLE PRECISION NOT NULL,
    "awayProbability" DOUBLE PRECISION NOT NULL,
    "actualOutcome" TEXT,
    "correct" BOOLEAN,
    "brierScore" DOUBLE PRECISION,

    CONSTRAINT "PredictionSlipSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFreePreview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "slipId" TEXT,

    CONSTRAINT "UserFreePreview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedFixture" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedFixture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "interval" "PlanInterval" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "features" JSONB NOT NULL,
    "providerPriceId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "dailyLimit" INTEGER DEFAULT 1,
    "weeklyLimit" INTEGER DEFAULT 5,
    "monthlyLimit" INTEGER DEFAULT 10,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "providerSubscriptionId" TEXT,
    "providerCustomerId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'INACTIVE',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processingState" TEXT,
    "safeMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundProviderLink" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "disclosure" TEXT NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT false,
    "approved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutboundProviderLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "target" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "error" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetWallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "balanceMinor" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetWallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "type" "BetTransactionType" NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "balanceAfterMinor" INTEGER NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "stakeMinor" INTEGER NOT NULL,
    "totalOdds" DOUBLE PRECISION NOT NULL,
    "potentialReturnMinor" INTEGER NOT NULL,
    "status" "BetTicketStatus" NOT NULL DEFAULT 'OPEN',
    "payoutMinor" INTEGER NOT NULL DEFAULT 0,
    "cashoutMinor" INTEGER,
    "selectionCount" INTEGER NOT NULL,
    "selections" JSONB NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetShareCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "selections" JSONB NOT NULL,
    "createdBy" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetShareCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetPromoClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "promoId" TEXT NOT NULL,
    "bonusMinor" INTEGER NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BetPromoClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetGameRound" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "game" "BetGameType" NOT NULL,
    "stakeMinor" INTEGER NOT NULL,
    "payoutMinor" INTEGER NOT NULL DEFAULT 0,
    "status" "BetGameStatus" NOT NULL DEFAULT 'OPEN',
    "detail" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "BetGameRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetAviatorBet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "slot" INTEGER NOT NULL,
    "stakeMinor" INTEGER NOT NULL,
    "autoCashout" DOUBLE PRECISION,
    "cashedOutAt" DOUBLE PRECISION,
    "payoutMinor" INTEGER NOT NULL DEFAULT 0,
    "status" "BetAviatorBetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "settledAt" TIMESTAMP(3),

    CONSTRAINT "BetAviatorBet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AviatorTrial" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "shareCode" TEXT,
    "entryId" TEXT,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'GRANTED',
    "stakeMinor" INTEGER NOT NULL DEFAULT 1000,
    "prizeMinor" INTEGER NOT NULL DEFAULT 63000,
    "phone" TEXT,
    "withdrawalStatus" TEXT NOT NULL DEFAULT 'NONE',
    "playedAt" TIMESTAMP(3),
    "claimedAt" TIMESTAMP(3),
    "withdrawalRequestedAt" TIMESTAMP(3),
    "withdrawalEtaAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AviatorTrial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AdminBetSlip" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'LIVE',
    "selections" JSONB NOT NULL,
    "totalOdds" DOUBLE PRECISION NOT NULL,
    "stakeMinor" INTEGER NOT NULL,
    "potentialReturnMinor" INTEGER NOT NULL,
    "status" "AdminBetSlipStatus" NOT NULL DEFAULT 'OPEN',
    "freezeReason" TEXT,
    "autoFreezeAt" TIMESTAMP(3) NOT NULL,
    "frozenAt" TIMESTAMP(3),
    "frozenBy" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminBetSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminBetEntry" (
    "id" TEXT NOT NULL,
    "slipId" TEXT NOT NULL,
    "userId" TEXT,
    "phone" TEXT NOT NULL,
    "stakeMinor" INTEGER NOT NULL,
    "status" "AdminBetEntryStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "providerOrderId" TEXT,
    "ticketId" TEXT,
    "placementStartedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminBetEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetWinnerSlip" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "selections" JSONB NOT NULL,
    "stakeMinor" INTEGER NOT NULL,
    "totalOdds" DOUBLE PRECISION NOT NULL,
    "grossPayoutMinor" INTEGER NOT NULL,
    "vatMinor" INTEGER NOT NULL,
    "netPayoutMinor" INTEGER NOT NULL,
    "ticketId" TEXT,
    "createdBy" TEXT,
    "creditedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BetWinnerSlip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BetPaymentOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'DEPOSIT',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "provider" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BetPaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "UserPreference_userId_key" ON "UserPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Sport_slug_key" ON "Sport"("slug");

-- CreateIndex
CREATE INDEX "Competition_providerId_idx" ON "Competition"("providerId");

-- CreateIndex
CREATE INDEX "Team_providerId_idx" ON "Team"("providerId");

-- CreateIndex
CREATE UNIQUE INDEX "Fixture_providerId_key" ON "Fixture"("providerId");

-- CreateIndex
CREATE INDEX "Fixture_kickoffUtc_idx" ON "Fixture"("kickoffUtc");

-- CreateIndex
CREATE INDEX "Fixture_status_idx" ON "Fixture"("status");

-- CreateIndex
CREATE INDEX "TeamMatchStat_fixtureId_idx" ON "TeamMatchStat"("fixtureId");

-- CreateIndex
CREATE INDEX "Prediction_fixtureId_status_idx" ON "Prediction"("fixtureId", "status");

-- CreateIndex
CREATE INDEX "PredictionOutcome_predictionId_idx" ON "PredictionOutcome"("predictionId");

-- CreateIndex
CREATE UNIQUE INDEX "PredictionEvaluation_predictionId_key" ON "PredictionEvaluation"("predictionId");

-- CreateIndex
CREATE INDEX "PredictionSlip_userId_generatedAt_idx" ON "PredictionSlip"("userId", "generatedAt");

-- CreateIndex
CREATE INDEX "PredictionSlip_status_idx" ON "PredictionSlip"("status");

-- CreateIndex
CREATE INDEX "PredictionSlipSelection_slipId_idx" ON "PredictionSlipSelection"("slipId");

-- CreateIndex
CREATE INDEX "PredictionSlipSelection_fixtureId_idx" ON "PredictionSlipSelection"("fixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFreePreview_userId_key" ON "UserFreePreview"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFreePreview_slipId_key" ON "UserFreePreview"("slipId");

-- CreateIndex
CREATE UNIQUE INDEX "SavedFixture_userId_fixtureId_key" ON "SavedFixture"("userId", "fixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_providerSubscriptionId_key" ON "Subscription"("providerSubscriptionId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_providerEventId_key" ON "BillingEvent"("providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "BetWallet_userId_key" ON "BetWallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BetTransaction_reference_key" ON "BetTransaction"("reference");

-- CreateIndex
CREATE INDEX "BetTransaction_userId_createdAt_idx" ON "BetTransaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BetTransaction_walletId_idx" ON "BetTransaction"("walletId");

-- CreateIndex
CREATE UNIQUE INDEX "BetTicket_code_key" ON "BetTicket"("code");

-- CreateIndex
CREATE INDEX "BetTicket_userId_placedAt_idx" ON "BetTicket"("userId", "placedAt");

-- CreateIndex
CREATE INDEX "BetTicket_status_idx" ON "BetTicket"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BetShareCode_code_key" ON "BetShareCode"("code");

-- CreateIndex
CREATE INDEX "BetShareCode_expiresAt_idx" ON "BetShareCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BetPromoClaim_userId_promoId_key" ON "BetPromoClaim"("userId", "promoId");

-- CreateIndex
CREATE INDEX "BetGameRound_userId_createdAt_idx" ON "BetGameRound"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BetAviatorBet_roundId_idx" ON "BetAviatorBet"("roundId");

-- CreateIndex
CREATE UNIQUE INDEX "BetAviatorBet_userId_roundId_slot_key" ON "BetAviatorBet"("userId", "roundId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "AviatorTrial_token_key" ON "AviatorTrial"("token");

-- CreateIndex
CREATE UNIQUE INDEX "AviatorTrial_entryId_key" ON "AviatorTrial"("entryId");

-- CreateIndex
CREATE INDEX "AviatorTrial_userId_createdAt_idx" ON "AviatorTrial"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AviatorTrial_withdrawalStatus_idx" ON "AviatorTrial"("withdrawalStatus");

-- CreateIndex
CREATE UNIQUE INDEX "AdminBetSlip_code_key" ON "AdminBetSlip"("code");

-- CreateIndex
CREATE INDEX "AdminBetSlip_status_idx" ON "AdminBetSlip"("status");

-- CreateIndex
CREATE INDEX "AdminBetSlip_autoFreezeAt_idx" ON "AdminBetSlip"("autoFreezeAt");

-- CreateIndex
CREATE INDEX "AdminBetSlip_createdAt_idx" ON "AdminBetSlip"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminBetEntry_providerOrderId_key" ON "AdminBetEntry"("providerOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminBetEntry_ticketId_key" ON "AdminBetEntry"("ticketId");

-- CreateIndex
CREATE INDEX "AdminBetEntry_slipId_status_idx" ON "AdminBetEntry"("slipId", "status");

-- CreateIndex
CREATE INDEX "AdminBetEntry_phone_idx" ON "AdminBetEntry"("phone");

-- CreateIndex
CREATE INDEX "AdminBetEntry_createdAt_idx" ON "AdminBetEntry"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BetWinnerSlip_code_key" ON "BetWinnerSlip"("code");

-- CreateIndex
CREATE UNIQUE INDEX "BetWinnerSlip_ticketId_key" ON "BetWinnerSlip"("ticketId");

-- CreateIndex
CREATE INDEX "BetWinnerSlip_userId_createdAt_idx" ON "BetWinnerSlip"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BetWinnerSlip_createdAt_idx" ON "BetWinnerSlip"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BetPaymentOrder_orderId_key" ON "BetPaymentOrder"("orderId");

-- CreateIndex
CREATE INDEX "BetPaymentOrder_userId_createdAt_idx" ON "BetPaymentOrder"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BetPaymentOrder_status_idx" ON "BetPaymentOrder"("status");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_sportId_fkey" FOREIGN KEY ("sportId") REFERENCES "Sport"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Fixture" ADD CONSTRAINT "Fixture_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMatchStat" ADD CONSTRAINT "TeamMatchStat_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_modelVersionId_fkey" FOREIGN KEY ("modelVersionId") REFERENCES "ModelVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionOutcome" ADD CONSTRAINT "PredictionOutcome_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionEvaluation" ADD CONSTRAINT "PredictionEvaluation_predictionId_fkey" FOREIGN KEY ("predictionId") REFERENCES "Prediction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionSlip" ADD CONSTRAINT "PredictionSlip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PredictionSlipSelection" ADD CONSTRAINT "PredictionSlipSelection_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "PredictionSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFreePreview" ADD CONSTRAINT "UserFreePreview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFreePreview" ADD CONSTRAINT "UserFreePreview_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "PredictionSlip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFixture" ADD CONSTRAINT "SavedFixture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedFixture" ADD CONSTRAINT "SavedFixture_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "Fixture"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetWallet" ADD CONSTRAINT "BetWallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetTransaction" ADD CONSTRAINT "BetTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetTransaction" ADD CONSTRAINT "BetTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "BetWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetTicket" ADD CONSTRAINT "BetTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetPromoClaim" ADD CONSTRAINT "BetPromoClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetGameRound" ADD CONSTRAINT "BetGameRound_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetAviatorBet" ADD CONSTRAINT "BetAviatorBet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AviatorTrial" ADD CONSTRAINT "AviatorTrial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminBetEntry" ADD CONSTRAINT "AdminBetEntry_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "AdminBetSlip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminBetEntry" ADD CONSTRAINT "AdminBetEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetWinnerSlip" ADD CONSTRAINT "BetWinnerSlip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BetPaymentOrder" ADD CONSTRAINT "BetPaymentOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

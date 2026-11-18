-- AlterTable
ALTER TABLE "SubscriptionPlan"
ADD COLUMN "durationDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN "slipLimit" INTEGER NOT NULL DEFAULT 5;

INSERT INTO "SubscriptionPlan" (
    "id", "name", "interval", "amountMinor", "currency", "features", "active",
    "durationDays", "dailyLimit", "weeklyLimit", "monthlyLimit", "slipLimit",
    "createdAt", "updatedAt"
)
VALUES
    (
        'weekly',
        'Weekly',
        'WEEKLY',
        2000,
        'TZS',
        '["Create 5 AI bet slips","Full prediction board","Saved matches and preferences"]'::jsonb,
        true,
        7,
        1,
        5,
        5,
        5,
        now(),
        now()
    ),
    (
        'monthly',
        'Monthly',
        'MONTHLY',
        5000,
        'TZS',
        '["Create 15 AI bet slips","Everything in Weekly","Historical performance and evaluation detail"]'::jsonb,
        true,
        30,
        1,
        15,
        15,
        15,
        now(),
        now()
    ),
    (
        'quarterly',
        '3 Months',
        'MONTHLY',
        12000,
        'TZS',
        '["Create 25 AI bet slips","Everything in Monthly","Priority access to new validated markets"]'::jsonb,
        true,
        90,
        1,
        25,
        25,
        25,
        now(),
        now()
    )
ON CONFLICT ("id") DO UPDATE SET
    "name" = EXCLUDED."name",
    "interval" = EXCLUDED."interval",
    "amountMinor" = EXCLUDED."amountMinor",
    "currency" = EXCLUDED."currency",
    "features" = EXCLUDED."features",
    "active" = EXCLUDED."active",
    "durationDays" = EXCLUDED."durationDays",
    "dailyLimit" = EXCLUDED."dailyLimit",
    "weeklyLimit" = EXCLUDED."weeklyLimit",
    "monthlyLimit" = EXCLUDED."monthlyLimit",
    "slipLimit" = EXCLUDED."slipLimit",
    "updatedAt" = now();

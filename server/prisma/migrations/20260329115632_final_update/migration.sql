-- CreateTable
CREATE TABLE "UserPlan" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "subscriptionId" UUID NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyTracking" (
    "id" UUID NOT NULL,
    "userPlanId" UUID NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mealsDoneIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "mealsMissedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "habitsDoneIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "habitsMissedIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "calories" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyTracking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserPlan_userId_idx" ON "UserPlan"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyTracking_userPlanId_date_key" ON "DailyTracking"("userPlanId", "date");

-- AddForeignKey
ALTER TABLE "UserPlan" ADD CONSTRAINT "UserPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPlan" ADD CONSTRAINT "UserPlan_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPlan" ADD CONSTRAINT "UserPlan_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyTracking" ADD CONSTRAINT "DailyTracking_userPlanId_fkey" FOREIGN KEY ("userPlanId") REFERENCES "UserPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

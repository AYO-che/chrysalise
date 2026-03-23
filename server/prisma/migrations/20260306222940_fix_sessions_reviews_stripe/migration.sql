/*
  Warnings:

  - The values [AI_PLAN] on the enum `OfferType` will be removed. If these variants are still used in the database, this will fail.
  - The `medicalConditions` column on the `Profile` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `createdAt` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Subscription` table. All the data in the column will be lost.
  - You are about to drop the `resume` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[sessionId,patientId]` on the table `Review` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `sessionId` to the `Review` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Session` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "OfferType_new" AS ENUM ('AI_CALORIES', 'PLAN', 'CONSULTATION');
ALTER TABLE "Offer" ALTER COLUMN "type" TYPE "OfferType_new" USING ("type"::text::"OfferType_new");
ALTER TYPE "OfferType" RENAME TO "OfferType_old";
ALTER TYPE "OfferType_new" RENAME TO "OfferType";
DROP TYPE "public"."OfferType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "resume" DROP CONSTRAINT "resume_userId_fkey";

-- AlterTable
ALTER TABLE "BlogPost" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "videos" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
DROP COLUMN "medicalConditions",
ADD COLUMN     "medicalConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
ALTER COLUMN "allergies" SET DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "sessionId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "zoomLink" TEXT;

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "createdAt",
DROP COLUMN "updatedAt",
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "resume";

-- CreateTable
CREATE TABLE "Resume" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bio" TEXT,
    "experienceYears" INTEGER,
    "specializations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "certifications" TEXT,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "offerId" UUID NOT NULL,
    "nutritionId" UUID,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "videos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "pdfUrl" TEXT,
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "activityLevels" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "minWeight" DOUBLE PRECISION,
    "maxWeight" DOUBLE PRECISION,
    "minHeight" DOUBLE PRECISION,
    "maxHeight" DOUBLE PRECISION,
    "medicalConditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stripe" (
    "stripeAccountId" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stripe_pkey" PRIMARY KEY ("stripeAccountId")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Resume_userId_key" ON "Resume"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_offerId_key" ON "Plan"("offerId");

-- CreateIndex
CREATE UNIQUE INDEX "Stripe_userId_key" ON "Stripe"("userId");

-- CreateIndex
CREATE INDEX "BlogPost_status_idx" ON "BlogPost"("status");

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");

-- CreateIndex
CREATE INDEX "Profile_goal_idx" ON "Profile"("goal");

-- CreateIndex
CREATE INDEX "Profile_activityLevel_idx" ON "Profile"("activityLevel");

-- CreateIndex
CREATE UNIQUE INDEX "Review_sessionId_patientId_key" ON "Review"("sessionId", "patientId");

-- CreateIndex
CREATE INDEX "Session_sessionDate_idx" ON "Session"("sessionDate");

-- CreateIndex
CREATE INDEX "Session_patientId_idx" ON "Session"("patientId");

-- CreateIndex
CREATE INDEX "Session_nutritionId_idx" ON "Session"("nutritionId");

-- CreateIndex
CREATE INDEX "Subscription_patientId_idx" ON "Subscription"("patientId");

-- CreateIndex
CREATE INDEX "Subscription_nutritionId_idx" ON "Subscription"("nutritionId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- AddForeignKey
ALTER TABLE "Resume" ADD CONSTRAINT "Resume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_nutritionId_fkey" FOREIGN KEY ("nutritionId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stripe" ADD CONSTRAINT "Stripe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Resume" ADD COLUMN     "offersTypes" "OfferType"[] DEFAULT ARRAY[]::"OfferType"[];

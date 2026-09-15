-- DropForeignKey
ALTER TABLE "Slip" DROP CONSTRAINT "Slip_placeId_fkey";

-- AlterTable
ALTER TABLE "Slip" ALTER COLUMN "placeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultPlaceId" TEXT;

-- AddForeignKey
ALTER TABLE "Slip" ADD CONSTRAINT "Slip_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE SET NULL ON UPDATE CASCADE;

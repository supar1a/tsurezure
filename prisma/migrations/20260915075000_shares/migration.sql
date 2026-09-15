-- 一篇とグループの対応（Share）を作り、既存の「部屋に置いてある一篇」を写してから、古い列を落とす。

-- CreateTable
CREATE TABLE "Share" (
    "slipId" TEXT NOT NULL,
    "placeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Share_pkey" PRIMARY KEY ("slipId","placeId")
);

-- 写す（列を落とす前に）
INSERT INTO "Share" ("slipId", "placeId", "createdAt")
SELECT "id", "placeId", "createdAt" FROM "Slip" WHERE "placeId" IS NOT NULL AND "published" = true;

-- CreateIndex
CREATE INDEX "Share_placeId_createdAt_idx" ON "Share"("placeId", "createdAt");

-- AddForeignKey
ALTER TABLE "Share" ADD CONSTRAINT "Share_slipId_fkey" FOREIGN KEY ("slipId") REFERENCES "Slip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Share" ADD CONSTRAINT "Share_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "Slip" DROP CONSTRAINT "Slip_placeId_fkey";

-- DropIndex
DROP INDEX "Slip_authorId_idx";
DROP INDEX "Slip_placeId_createdAt_idx";

-- AlterTable
ALTER TABLE "Slip" DROP COLUMN "placeId",
DROP COLUMN "published";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "defaultPlaceId",
ADD COLUMN     "lastPlaceIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Slip_authorId_createdAt_idx" ON "Slip"("authorId", "createdAt");

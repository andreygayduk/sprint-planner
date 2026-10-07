-- AlterTable
ALTER TABLE "TimelineBlock" ADD COLUMN "assigneeId" TEXT;

-- Backfill existing blocks with the team owner (or any member if no owner)
UPDATE "TimelineBlock" AS tb
SET "assigneeId" = COALESCE(
  (
    SELECT m."userId"
    FROM "Membership" m
    WHERE m."teamId" = tb."teamId" AND m."role" = 'owner'
    ORDER BY m."createdAt" ASC
    LIMIT 1
  ),
  (
    SELECT m."userId"
    FROM "Membership" m
    WHERE m."teamId" = tb."teamId"
    ORDER BY m."createdAt" ASC
    LIMIT 1
  )
);

ALTER TABLE "TimelineBlock" ALTER COLUMN "assigneeId" SET NOT NULL;

-- CreateTable
CREATE TABLE "MemberHoliday" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemberHoliday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MemberHoliday_membershipId_idx" ON "MemberHoliday"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberHoliday_membershipId_date_key" ON "MemberHoliday"("membershipId", "date");

-- CreateIndex
CREATE INDEX "TimelineBlock_assigneeId_idx" ON "TimelineBlock"("assigneeId");

-- AddForeignKey
ALTER TABLE "MemberHoliday" ADD CONSTRAINT "MemberHoliday_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineBlock" ADD CONSTRAINT "TimelineBlock_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

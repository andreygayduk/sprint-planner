-- CreateEnum
CREATE TYPE "WorkLane" AS ENUM ('development', 'feature_testing');

-- CreateTable
CREATE TABLE "TimelineBlock" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "backlogItemId" TEXT NOT NULL,
    "lane" "WorkLane" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimelineBlock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimelineBlock_teamId_startDate_endDate_idx" ON "TimelineBlock"("teamId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "TimelineBlock_backlogItemId_idx" ON "TimelineBlock"("backlogItemId");

-- AddForeignKey
ALTER TABLE "TimelineBlock" ADD CONSTRAINT "TimelineBlock_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineBlock" ADD CONSTRAINT "TimelineBlock_backlogItemId_fkey" FOREIGN KEY ("backlogItemId") REFERENCES "BacklogItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

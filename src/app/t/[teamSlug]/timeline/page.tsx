import { TimelineBoard } from "@/components/timeline-board";
import { PageHeader } from "@/components/ui";
import { getTeamContext } from "@/lib/team-context";
import { toDayString } from "@/lib/timeline-dates";
import { prisma } from "@/lib/prisma";

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const ctx = await getTeamContext(teamSlug);

  const [items, blocks, sprints] = await Promise.all([
    prisma.backlogItem.findMany({
      where: { teamId: ctx.teamId },
      orderBy: [{ status: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.timelineBlock.findMany({
      where: { teamId: ctx.teamId },
      include: { backlogItem: true },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    }),
    prisma.sprint.findMany({
      where: { teamId: ctx.teamId },
      orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  return (
    <div className="relative left-1/2 w-screen max-w-[100vw] -translate-x-1/2 px-4">
      <div className="mx-auto max-w-7xl">
        <PageHeader
          title="Timeline"
          description="Plan development and feature testing across sprints on one team timeline."
        />
        <TimelineBoard
          teamSlug={teamSlug}
          items={items.map((item) => ({
            id: item.id,
            title: item.title,
            storyPoints: item.storyPoints,
            priority: item.priority,
            status: item.status,
          }))}
          blocks={blocks.map((block) => ({
            id: block.id,
            backlogItemId: block.backlogItemId,
            title: block.backlogItem.title,
            lane: block.lane,
            startDate: toDayString(block.startDate),
            endDate: toDayString(block.endDate),
          }))}
          sprints={sprints.map((sprint) => ({
            id: sprint.id,
            name: sprint.name,
            startDate: toDayString(sprint.startDate),
            endDate: toDayString(sprint.endDate),
          }))}
        />
      </div>
    </div>
  );
}

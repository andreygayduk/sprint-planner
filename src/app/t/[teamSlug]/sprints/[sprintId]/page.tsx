import { notFound } from "next/navigation";
import { SprintBoard } from "@/components/sprint-board";
import { PageHeader } from "@/components/ui";
import { getTeamContext } from "@/lib/team-context";
import { prisma } from "@/lib/prisma";
import { BacklogStatus } from "@prisma/client";

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function SprintDetailPage({
  params,
}: {
  params: Promise<{ teamSlug: string; sprintId: string }>;
}) {
  const { teamSlug, sprintId } = await params;
  const ctx = await getTeamContext(teamSlug);

  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, teamId: ctx.teamId },
    include: {
      items: {
        include: { backlogItem: true },
        orderBy: { sortOrder: "asc" },
      },
      capacities: true,
    },
  });
  if (!sprint) {
    notFound();
  }

  const [available, memberships] = await Promise.all([
    prisma.backlogItem.findMany({
      where: { teamId: ctx.teamId, status: BacklogStatus.backlog },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.membership.findMany({
      where: { teamId: ctx.teamId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title={sprint.name}
        description={
          sprint.goal ??
          `${toDateInput(sprint.startDate)} → ${toDateInput(sprint.endDate)}`
        }
      />
      <SprintBoard
        teamSlug={teamSlug}
        sprint={{
          id: sprint.id,
          name: sprint.name,
          goal: sprint.goal,
          startDate: toDateInput(sprint.startDate),
          endDate: toDateInput(sprint.endDate),
          capacityPoints: sprint.capacityPoints,
          status: sprint.status,
        }}
        committed={sprint.items.map((row) => ({
          id: row.backlogItem.id,
          title: row.backlogItem.title,
          description: row.backlogItem.description,
          storyPoints: row.backlogItem.storyPoints,
          priority: row.backlogItem.priority,
        }))}
        available={available.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          storyPoints: item.storyPoints,
          priority: item.priority,
        }))}
        members={memberships.map((row) => ({
          id: row.user.id,
          name: row.user.name,
          email: row.user.email,
        }))}
        capacities={sprint.capacities.map((row) => ({
          userId: row.userId,
          availablePoints: row.availablePoints,
        }))}
      />
    </div>
  );
}

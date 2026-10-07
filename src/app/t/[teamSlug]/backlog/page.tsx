import { BacklogBoard } from "@/components/backlog-board";
import { PageHeader } from "@/components/ui";
import { getTeamContext } from "@/lib/team-context";
import { prisma } from "@/lib/prisma";
import { BacklogStatus } from "@prisma/client";

export default async function BacklogPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const ctx = await getTeamContext(teamSlug);

  const items = await prisma.backlogItem.findMany({
    where: { teamId: ctx.teamId, status: BacklogStatus.backlog },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div>
      <PageHeader
        title="Backlog"
        description="Prioritize work before committing it to a sprint."
      />
      <BacklogBoard
        teamSlug={teamSlug}
        items={items.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          storyPoints: item.storyPoints,
          priority: item.priority,
          status: item.status,
        }))}
      />
    </div>
  );
}

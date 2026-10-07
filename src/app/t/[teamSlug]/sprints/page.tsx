import Link from "next/link";
import { createSprintAction } from "@/app/actions/sprints";
import {
  Badge,
  Button,
  Input,
  Label,
  PageHeader,
  Panel,
  Select,
  Textarea,
} from "@/components/ui";
import { getTeamContext } from "@/lib/team-context";
import { prisma } from "@/lib/prisma";

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

export default async function SprintsPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const ctx = await getTeamContext(teamSlug);

  const sprints = await prisma.sprint.findMany({
    where: { teamId: ctx.teamId },
    include: {
      items: {
        include: { backlogItem: true },
      },
    },
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });

  const today = new Date();
  const inTwoWeeks = new Date(today);
  inTwoWeeks.setDate(today.getDate() + 13);

  return (
    <div>
      <PageHeader
        title="Sprints"
        description="Create planning windows and track commitment vs capacity."
      />

      <Panel className="mb-6">
        <h2 className="mb-3 text-lg font-semibold">New sprint</h2>
        <form action={createSprintAction} className="grid gap-3 md:grid-cols-2">
          <input type="hidden" name="teamSlug" value={teamSlug} />
          <div className="md:col-span-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Sprint 24" required />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="goal">Goal</Label>
            <Textarea id="goal" name="goal" rows={2} />
          </div>
          <div>
            <Label htmlFor="startDate">Start</Label>
            <Input
              id="startDate"
              name="startDate"
              type="date"
              defaultValue={toDateInput(today)}
              required
            />
          </div>
          <div>
            <Label htmlFor="endDate">End</Label>
            <Input
              id="endDate"
              name="endDate"
              type="date"
              defaultValue={toDateInput(inTwoWeeks)}
              required
            />
          </div>
          <div>
            <Label htmlFor="capacityPoints">Capacity (points)</Label>
            <Input
              id="capacityPoints"
              name="capacityPoints"
              type="number"
              min={0}
              defaultValue={40}
            />
          </div>
          <div>
            <Label htmlFor="status">Status</Label>
            <Select id="status" name="status" defaultValue="planning">
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Button type="submit">Create sprint</Button>
          </div>
        </form>
      </Panel>

      <div className="space-y-3">
        {sprints.map((sprint) => {
          const committed = sprint.items.reduce(
            (sum, row) => sum + (row.backlogItem.storyPoints ?? 0),
            0,
          );
          return (
            <Link
              key={sprint.id}
              href={`/t/${teamSlug}/sprints/${sprint.id}`}
              className="block rounded-lg border border-border bg-surface p-4 shadow-sm hover:border-accent"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{sprint.name}</h3>
                  <p className="text-sm text-muted">
                    {toDateInput(sprint.startDate)} → {toDateInput(sprint.endDate)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="accent">
                    {committed}/{sprint.capacityPoints} pts
                  </Badge>
                  <Badge>{sprint.status}</Badge>
                </div>
              </div>
              {sprint.goal ? (
                <p className="mt-2 text-sm text-muted">{sprint.goal}</p>
              ) : null}
            </Link>
          );
        })}
        {sprints.length === 0 ? (
          <p className="text-sm text-muted">No sprints yet.</p>
        ) : null}
      </div>
    </div>
  );
}

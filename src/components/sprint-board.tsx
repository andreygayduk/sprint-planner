"use client";

import { useMemo, useOptimistic, useTransition } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  assignToSprintAction,
  reorderSprintItemsAction,
  setMemberCapacityAction,
  unassignFromSprintAction,
  updateSprintAction,
} from "@/app/actions/sprints";
import {
  Badge,
  Button,
  CapacityBar,
  Input,
  Label,
  Panel,
  Select,
  Textarea,
} from "@/components/ui";

export type BoardItem = {
  id: string;
  title: string;
  description: string | null;
  storyPoints: number | null;
  priority: "low" | "medium" | "high" | "urgent";
};

export function SprintBoard({
  teamSlug,
  sprint,
  committed,
  available,
  members,
  capacities,
}: {
  teamSlug: string;
  sprint: {
    id: string;
    name: string;
    goal: string | null;
    startDate: string;
    endDate: string;
    capacityPoints: number;
    status: "planning" | "active" | "completed";
  };
  committed: BoardItem[];
  available: BoardItem[];
  members: { id: string; name: string | null; email: string }[];
  capacities: { userId: string; availablePoints: number }[];
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [pending, startTransition] = useTransition();
  const [optimisticCommitted, setOptimisticCommitted] = useOptimistic(committed);

  const committedPoints = optimisticCommitted.reduce(
    (sum, item) => sum + (item.storyPoints ?? 0),
    0,
  );
  const capacityByUser = useMemo(() => {
    const map = new Map(
      capacities.map((row) => [row.userId, row.availablePoints] as const),
    );
    return map;
  }, [capacities]);

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = optimisticCommitted.findIndex((item) => item.id === active.id);
    const newIndex = optimisticCommitted.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const next = arrayMove(optimisticCommitted, oldIndex, newIndex);
    startTransition(async () => {
      setOptimisticCommitted(next);
      await reorderSprintItemsAction(
        teamSlug,
        sprint.id,
        next.map((item) => item.id),
      );
    });
  }

  return (
    <div className="space-y-6">
      <Panel className="space-y-4">
        <CapacityBar
          committed={committedPoints}
          capacity={sprint.capacityPoints}
        />
        <details>
          <summary className="cursor-pointer text-sm text-accent">
            Edit sprint settings
          </summary>
          <form action={updateSprintAction} className="mt-3 grid gap-3 md:grid-cols-2">
            <input type="hidden" name="teamSlug" value={teamSlug} />
            <input type="hidden" name="sprintId" value={sprint.id} />
            <div className="md:col-span-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={sprint.name} required />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="goal">Goal</Label>
              <Textarea
                id="goal"
                name="goal"
                rows={2}
                defaultValue={sprint.goal ?? ""}
              />
            </div>
            <div>
              <Label htmlFor="startDate">Start</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={sprint.startDate}
                required
              />
            </div>
            <div>
              <Label htmlFor="endDate">End</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={sprint.endDate}
                required
              />
            </div>
            <div>
              <Label htmlFor="capacityPoints">Team capacity (points)</Label>
              <Input
                id="capacityPoints"
                name="capacityPoints"
                type="number"
                min={0}
                defaultValue={sprint.capacityPoints}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={sprint.status}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Button type="submit" variant="secondary">
                Save sprint
              </Button>
            </div>
          </form>
        </details>
      </Panel>

      <Panel>
        <h2 className="mb-3 text-lg font-semibold">Member capacity</h2>
        <p className="mb-4 text-sm text-muted">
          Updating member capacity recalculates the team capacity total.
        </p>
        <div className="space-y-3">
          {members.map((member) => (
            <form
              key={member.id}
              action={setMemberCapacityAction}
              className="grid gap-2 sm:grid-cols-[1fr_120px_auto] sm:items-end"
            >
              <input type="hidden" name="teamSlug" value={teamSlug} />
              <input type="hidden" name="sprintId" value={sprint.id} />
              <input type="hidden" name="userId" value={member.id} />
              <div>
                <div className="text-sm font-medium">
                  {member.name ?? member.email}
                </div>
                <div className="text-xs text-muted">{member.email}</div>
              </div>
              <div>
                <Label htmlFor={`cap-${member.id}`}>Points</Label>
                <Input
                  id={`cap-${member.id}`}
                  name="availablePoints"
                  type="number"
                  min={0}
                  defaultValue={capacityByUser.get(member.id) ?? 0}
                />
              </div>
              <Button type="submit" variant="secondary">
                Save
              </Button>
            </form>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Sprint commitment ({optimisticCommitted.length})
          </h2>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={optimisticCommitted.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <ul className={`space-y-3 ${pending ? "opacity-70" : ""}`}>
                {optimisticCommitted.map((item) => (
                  <SortableCommittedItem
                    key={item.id}
                    teamSlug={teamSlug}
                    sprintId={sprint.id}
                    item={item}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
          {optimisticCommitted.length === 0 ? (
            <p className="text-sm text-muted">No items committed yet.</p>
          ) : null}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">
            Available backlog ({available.length})
          </h2>
          <ul className="space-y-3">
            {available.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{item.title}</h3>
                  <Badge>{item.priority}</Badge>
                  {item.storyPoints != null ? (
                    <Badge tone="accent">{item.storyPoints} pts</Badge>
                  ) : null}
                </div>
                {item.description ? (
                  <p className="mt-1 text-sm text-muted">{item.description}</p>
                ) : null}
                <form action={assignToSprintAction} className="mt-3">
                  <input type="hidden" name="teamSlug" value={teamSlug} />
                  <input type="hidden" name="sprintId" value={sprint.id} />
                  <input type="hidden" name="backlogItemId" value={item.id} />
                  <Button type="submit">Commit to sprint</Button>
                </form>
              </li>
            ))}
          </ul>
          {available.length === 0 ? (
            <p className="text-sm text-muted">
              Backlog is empty. Add items from the Backlog page.
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function SortableCommittedItem({
  teamSlug,
  sprintId,
  item,
}: {
  teamSlug: string;
  sprintId: string;
  item: BoardItem;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`rounded-lg border border-border bg-surface p-4 shadow-sm ${
        isDragging ? "z-10 ring-2 ring-accent" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          className="mt-1 cursor-grab rounded px-1 text-muted hover:bg-background active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{item.title}</h3>
            <Badge>{item.priority}</Badge>
            {item.storyPoints != null ? (
              <Badge tone="accent">{item.storyPoints} pts</Badge>
            ) : null}
          </div>
          {item.description ? (
            <p className="mt-1 text-sm text-muted">{item.description}</p>
          ) : null}
          <form action={unassignFromSprintAction} className="mt-3">
            <input type="hidden" name="teamSlug" value={teamSlug} />
            <input type="hidden" name="sprintId" value={sprintId} />
            <input type="hidden" name="backlogItemId" value={item.id} />
            <Button type="submit" variant="secondary">
              Return to backlog
            </Button>
          </form>
        </div>
      </div>
    </li>
  );
}

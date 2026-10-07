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
  createBacklogItemAction,
  deleteBacklogItemAction,
  reorderBacklogAction,
  updateBacklogItemAction,
} from "@/app/actions/backlog";
import { Badge, Button, Input, Label, Select, Textarea } from "@/components/ui";

export type BacklogItemView = {
  id: string;
  title: string;
  description: string | null;
  storyPoints: number | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "backlog" | "committed" | "done";
};

export function BacklogBoard({
  teamSlug,
  items,
}: {
  teamSlug: string;
  items: BacklogItemView[];
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [pending, startTransition] = useTransition();
  const [optimisticItems, setOptimisticItems] = useOptimistic(items);

  const sortableIds = useMemo(
    () => optimisticItems.map((item) => item.id),
    [optimisticItems],
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = optimisticItems.findIndex((item) => item.id === active.id);
    const newIndex = optimisticItems.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(optimisticItems, oldIndex, newIndex);
    startTransition(async () => {
      setOptimisticItems(next);
      await reorderBacklogAction(
        teamSlug,
        next.map((item) => item.id),
      );
    });
  }

  return (
    <div className="space-y-6">
      <form
        action={createBacklogItemAction}
        className="grid gap-3 rounded-lg border border-border bg-surface p-4 shadow-sm md:grid-cols-2"
      >
        <input type="hidden" name="teamSlug" value={teamSlug} />
        <div className="md:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required placeholder="As a user…" />
        </div>
        <div className="md:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={3} />
        </div>
        <div>
          <Label htmlFor="storyPoints">Story points</Label>
          <Input id="storyPoints" name="storyPoints" type="number" min={0} />
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select id="priority" name="priority" defaultValue="medium">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </Select>
        </div>
        <div className="md:col-span-2">
          <Button type="submit">Add to backlog</Button>
        </div>
      </form>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          <ul className={`space-y-3 ${pending ? "opacity-70" : ""}`}>
            {optimisticItems.map((item) => (
              <SortableBacklogItem
                key={item.id}
                teamSlug={teamSlug}
                item={item}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      {optimisticItems.length === 0 ? (
        <p className="text-sm text-muted">No uncommitted backlog items yet.</p>
      ) : null}
    </div>
  );
}

function SortableBacklogItem({
  teamSlug,
  item,
}: {
  teamSlug: string;
  item: BacklogItemView;
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
      <div className="mb-3 flex items-start gap-3">
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
        </div>
      </div>

      <details>
        <summary className="cursor-pointer text-sm text-accent">Edit</summary>
        <form action={updateBacklogItemAction} className="mt-3 grid gap-3 md:grid-cols-2">
          <input type="hidden" name="teamSlug" value={teamSlug} />
          <input type="hidden" name="itemId" value={item.id} />
          <div className="md:col-span-2">
            <Label htmlFor={`title-${item.id}`}>Title</Label>
            <Input
              id={`title-${item.id}`}
              name="title"
              defaultValue={item.title}
              required
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor={`description-${item.id}`}>Description</Label>
            <Textarea
              id={`description-${item.id}`}
              name="description"
              rows={3}
              defaultValue={item.description ?? ""}
            />
          </div>
          <div>
            <Label htmlFor={`points-${item.id}`}>Story points</Label>
            <Input
              id={`points-${item.id}`}
              name="storyPoints"
              type="number"
              min={0}
              defaultValue={item.storyPoints ?? ""}
            />
          </div>
          <div>
            <Label htmlFor={`priority-${item.id}`}>Priority</Label>
            <Select
              id={`priority-${item.id}`}
              name="priority"
              defaultValue={item.priority}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>
          <div className="flex gap-2 md:col-span-2">
            <Button type="submit" variant="secondary">
              Save
            </Button>
          </div>
        </form>
        <form action={deleteBacklogItemAction} className="mt-2">
          <input type="hidden" name="teamSlug" value={teamSlug} />
          <input type="hidden" name="itemId" value={item.id} />
          <Button type="submit" variant="danger">
            Delete
          </Button>
        </form>
      </details>
    </li>
  );
}

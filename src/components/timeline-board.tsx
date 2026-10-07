"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  createTimelineBlockAction,
  deleteTimelineBlockAction,
  updateTimelineBlockAction,
} from "@/app/actions/timeline";
import { Badge, Button, Panel } from "@/components/ui";
import {
  addDays,
  clampDay,
  computeVisibleRange,
  daysBetween,
  enumerateDays,
  stackRows,
  type WorkLaneValue,
} from "@/lib/timeline-dates";

const DAY_WIDTH = 40;
const ROW_HEIGHT = 36;
const LANE_PAD = 8;
const LABEL_WIDTH = 144;
const DEFAULT_DURATION_DAYS = 2;

export type TimelineItemView = {
  id: string;
  title: string;
  storyPoints: number | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: "backlog" | "committed" | "done";
};

export type TimelineBlockView = {
  id: string;
  backlogItemId: string;
  title: string;
  lane: WorkLaneValue;
  startDate: string;
  endDate: string;
};

export type TimelineSprintView = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

const LANES: { id: WorkLaneValue; label: string }[] = [
  { id: "development", label: "Development" },
  { id: "feature_testing", label: "Feature Testing" },
];

function laneClasses(lane: WorkLaneValue) {
  if (lane === "development") {
    return {
      bar: "border-accent bg-accent text-white",
      soft: "bg-accent-soft text-accent",
      label: "text-accent",
    };
  }
  return {
    bar: "border-lane-test bg-lane-test text-white",
    soft: "bg-lane-test-soft text-lane-test",
    label: "text-lane-test",
  };
}

function formatAxisDay(day: string) {
  const date = new Date(`${day}T00:00:00.000Z`);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function UnscheduledCard({
  item,
  missingLanes,
}: {
  item: TimelineItemView;
  missingLanes: WorkLaneValue[];
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `item:${item.id}`,
    data: { type: "item", itemId: item.id },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-md border border-border bg-white p-2 shadow-sm active:cursor-grabbing ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="text-sm font-medium text-foreground">{item.title}</div>
      <div className="mt-1 flex flex-wrap gap-1">
        {item.storyPoints != null ? (
          <Badge>{item.storyPoints} pts</Badge>
        ) : null}
        <Badge tone={item.status === "committed" ? "accent" : "default"}>
          {item.status}
        </Badge>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {missingLanes.map((lane) => (
          <span
            key={lane}
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${laneClasses(lane).soft}`}
          >
            needs {lane === "development" ? "dev" : "test"}
          </span>
        ))}
      </div>
    </div>
  );
}

function LaneDropZone({
  lane,
  children,
  height,
}: {
  lane: WorkLaneValue;
  children: ReactNode;
  height: number;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `lane:${lane}`,
    data: { type: "lane", lane },
  });

  return (
    <div
      ref={setNodeRef}
      data-lane={lane}
      className={`relative border-b border-border ${isOver ? "bg-accent-soft/40" : "bg-surface"}`}
      style={{ height }}
    >
      {children}
    </div>
  );
}

function laneFromPoint(clientX: number, clientY: number): WorkLaneValue | null {
  const hit = document
    .elementsFromPoint(clientX, clientY)
    .find((el) => el instanceof HTMLElement && el.dataset.lane);
  if (!(hit instanceof HTMLElement)) return null;
  const value = hit.dataset.lane;
  if (value === "development" || value === "feature_testing") return value;
  return null;
}

function TimelineBar({
  block,
  rangeStart,
  dayWidth,
  row,
  onCommit,
  onDelete,
}: {
  block: TimelineBlockView;
  rangeStart: string;
  dayWidth: number;
  row: number;
  onCommit: (next: TimelineBlockView) => void;
  onDelete: () => void;
}) {
  const colors = laneClasses(block.lane);
  const [draft, setDraft] = useState<TimelineBlockView | null>(null);
  const display = draft ?? block;
  const left = daysBetween(rangeStart, display.startDate) * dayWidth;
  const width = (daysBetween(display.startDate, display.endDate) + 1) * dayWidth;
  const dragMode = useRef<"move" | "resize-start" | "resize-end" | null>(null);
  const originX = useRef(0);
  const originBlock = useRef(block);

  function previewFromDelta(clientX: number): TimelineBlockView {
    const deltaDays = Math.round((clientX - originX.current) / dayWidth);
    const original = originBlock.current;
    const duration = daysBetween(original.startDate, original.endDate);

    if (dragMode.current === "move") {
      const nextStart = addDays(original.startDate, deltaDays);
      return {
        ...original,
        startDate: nextStart,
        endDate: addDays(nextStart, duration),
      };
    }

    if (dragMode.current === "resize-start") {
      let nextStart = addDays(original.startDate, deltaDays);
      if (nextStart > original.endDate) nextStart = original.endDate;
      return { ...original, startDate: nextStart };
    }

    if (dragMode.current === "resize-end") {
      let nextEnd = addDays(original.endDate, deltaDays);
      if (nextEnd < original.startDate) nextEnd = original.startDate;
      return { ...original, endDate: nextEnd };
    }

    return original;
  }

  function onPointerDown(
    event: ReactPointerEvent<HTMLElement>,
    mode: "move" | "resize-start" | "resize-end",
  ) {
    event.preventDefault();
    event.stopPropagation();
    dragMode.current = mode;
    originX.current = event.clientX;
    originBlock.current = block;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    function onMove(moveEvent: PointerEvent) {
      setDraft(previewFromDelta(moveEvent.clientX));
    }

    function onUp(upEvent: PointerEvent) {
      let next = previewFromDelta(upEvent.clientX);
      const targetLane = laneFromPoint(upEvent.clientX, upEvent.clientY);
      if (targetLane && targetLane !== block.lane) {
        next = { ...next, lane: targetLane };
      }
      setDraft(null);
      dragMode.current = null;
      target.releasePointerCapture(upEvent.pointerId);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      if (
        next.startDate !== block.startDate ||
        next.endDate !== block.endDate ||
        next.lane !== block.lane
      ) {
        onCommit(next);
      }
    }

    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
  }

  return (
    <div
      className={`absolute flex items-stretch overflow-hidden rounded-md border text-xs shadow-sm ${colors.bar}`}
      style={{
        left,
        width: Math.max(width, dayWidth),
        top: LANE_PAD + row * ROW_HEIGHT,
        height: ROW_HEIGHT - 6,
      }}
      title={`${display.title} (${display.startDate} → ${display.endDate})`}
    >
      <button
        type="button"
        aria-label="Resize start"
        className="w-2 shrink-0 cursor-ew-resize bg-black/10 hover:bg-black/20"
        onPointerDown={(event) => onPointerDown(event, "resize-start")}
      />
      <div
        className="flex min-w-0 flex-1 cursor-grab items-center gap-1 px-1.5 active:cursor-grabbing"
        onPointerDown={(event) => onPointerDown(event, "move")}
      >
        <span className="truncate font-medium">{display.title}</span>
        <button
          type="button"
          className="ml-auto shrink-0 rounded px-1 text-[10px] opacity-80 hover:bg-black/20 hover:opacity-100"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          ×
        </button>
      </div>
      <button
        type="button"
        aria-label="Resize end"
        className="w-2 shrink-0 cursor-ew-resize bg-black/10 hover:bg-black/20"
        onPointerDown={(event) => onPointerDown(event, "resize-end")}
      />
    </div>
  );
}

export function TimelineBoard({
  teamSlug,
  items,
  blocks,
  sprints,
}: {
  teamSlug: string;
  items: TimelineItemView[];
  blocks: TimelineBlockView[];
  sprints: TimelineSprintView[];
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );
  const [, startTransition] = useTransition();
  const [optimisticBlocks, setOptimisticBlocks] = useOptimistic(blocks);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const range = useMemo(
    () =>
      computeVisibleRange({
        sprintStarts: sprints.map((sprint) => sprint.startDate),
        sprintEnds: sprints.map((sprint) => sprint.endDate),
        blockStarts: optimisticBlocks.map((block) => block.startDate),
        blockEnds: optimisticBlocks.map((block) => block.endDate),
      }),
    [sprints, optimisticBlocks],
  );

  const days = useMemo(
    () => enumerateDays(range.start, range.end),
    [range.start, range.end],
  );
  const chartWidth = days.length * DAY_WIDTH;

  const blocksByLane = useMemo(() => {
    const map: Record<WorkLaneValue, TimelineBlockView[]> = {
      development: [],
      feature_testing: [],
    };
    for (const block of optimisticBlocks) {
      map[block.lane].push(block);
    }
    return map;
  }, [optimisticBlocks]);

  const stacks = useMemo(() => {
    return {
      development: stackRows(blocksByLane.development),
      feature_testing: stackRows(blocksByLane.feature_testing),
    };
  }, [blocksByLane]);

  const laneHeights = useMemo(() => {
    return {
      development: LANE_PAD * 2 + stacks.development.rowCount * ROW_HEIGHT,
      feature_testing:
        LANE_PAD * 2 + stacks.feature_testing.rowCount * ROW_HEIGHT,
    };
  }, [stacks]);

  const unscheduled = useMemo(() => {
    const lanesByItem = new Map<string, Set<WorkLaneValue>>();
    for (const block of optimisticBlocks) {
      const set = lanesByItem.get(block.backlogItemId) ?? new Set();
      set.add(block.lane);
      lanesByItem.set(block.backlogItemId, set);
    }

    return items
      .map((item) => {
        const present = lanesByItem.get(item.id) ?? new Set<WorkLaneValue>();
        const missing = LANES.map((lane) => lane.id).filter(
          (lane) => !present.has(lane),
        );
        return { item, missing };
      })
      .filter((row) => row.missing.length > 0)
      .sort((a, b) => {
        const rank = (status: TimelineItemView["status"]) =>
          status === "committed" ? 0 : status === "backlog" ? 1 : 2;
        return rank(a.item.status) - rank(b.item.status);
      });
  }, [items, optimisticBlocks]);

  const activeItem = items.find((item) => item.id === activeItemId) ?? null;

  function dayFromClientX(clientX: number) {
    const chart = chartRef.current;
    if (!chart) return range.start;
    const rect = chart.getBoundingClientRect();
    const x = clientX - rect.left + chart.scrollLeft;
    const index = Math.max(
      0,
      Math.min(days.length - 1, Math.floor(x / DAY_WIDTH)),
    );
    return days[index] ?? range.start;
  }

  function persistCreate(next: TimelineBlockView) {
    startTransition(async () => {
      setOptimisticBlocks((current) => [...current, next]);
      await createTimelineBlockAction({
        teamSlug,
        backlogItemId: next.backlogItemId,
        lane: next.lane,
        startDate: next.startDate,
        endDate: next.endDate,
      });
    });
  }

  function persistUpdate(next: TimelineBlockView) {
    startTransition(async () => {
      setOptimisticBlocks((current) =>
        current.map((block) => (block.id === next.id ? next : block)),
      );
      await updateTimelineBlockAction({
        teamSlug,
        blockId: next.id,
        lane: next.lane,
        startDate: next.startDate,
        endDate: next.endDate,
      });
    });
  }

  function persistDelete(blockId: string) {
    startTransition(async () => {
      setOptimisticBlocks((current) =>
        current.filter((block) => block.id !== blockId),
      );
      await deleteTimelineBlockAction({ teamSlug, blockId });
    });
  }

  function onDragStart(event: DragStartEvent) {
    const data = event.active.data.current;
    if (data?.type === "item") {
      setActiveItemId(String(data.itemId));
    }
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveItemId(null);
    const { active, over } = event;
    if (!over) return;

    const activeData = active.data.current;
    const overData = over.data.current;
    if (activeData?.type !== "item" || overData?.type !== "lane") return;

    const itemId = String(activeData.itemId);
    const lane = overData.lane as WorkLaneValue;
    const item = items.find((row) => row.id === itemId);
    if (!item) return;

    const already = optimisticBlocks.some(
      (block) => block.backlogItemId === itemId && block.lane === lane,
    );
    if (already) return;

    const activator = event.activatorEvent;
    const startX =
      activator && "clientX" in activator && typeof activator.clientX === "number"
        ? activator.clientX
        : null;
    const dropDay =
      startX != null
        ? dayFromClientX(startX + event.delta.x)
        : clampDay(new Date().toISOString().slice(0, 10), range.start, range.end);
    const startDate = dropDay;
    const endDate = addDays(startDate, DEFAULT_DURATION_DAYS);

    persistCreate({
      id: `temp-${itemId}-${lane}`,
      backlogItemId: itemId,
      title: item.title,
      lane,
      startDate,
      endDate,
    });
  }

  const headerHeight = 40 + 32;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveItemId(null)}
    >
      <div className="flex flex-col gap-4 lg:flex-row">
        <Panel className="w-full shrink-0 lg:w-72">
          <h2 className="mb-1 text-sm font-semibold text-foreground">
            Unscheduled
          </h2>
          <p className="mb-3 text-xs text-muted">
            Drag onto a lane to schedule development or feature testing.
          </p>
          <div className="flex max-h-[70vh] flex-col gap-2 overflow-y-auto">
            {unscheduled.length === 0 ? (
              <p className="text-sm text-muted">All items are fully scheduled.</p>
            ) : (
              unscheduled.map(({ item, missing }) => (
                <UnscheduledCard
                  key={item.id}
                  item={item}
                  missingLanes={missing}
                />
              ))
            )}
          </div>
        </Panel>

        <Panel className="min-w-0 flex-1 overflow-hidden p-0">
          <div className="flex">
            <div
              className="shrink-0 border-r border-border bg-surface"
              style={{ width: LABEL_WIDTH }}
            >
              <div
                className="border-b border-border bg-background px-3 py-2 text-xs font-medium text-muted"
                style={{ height: headerHeight }}
              >
                Lane
              </div>
              {LANES.map((lane) => (
                <div
                  key={lane.id}
                  className={`flex items-start border-b border-border px-3 py-2 text-sm font-semibold ${laneClasses(lane.id).label}`}
                  style={{ height: laneHeights[lane.id] }}
                >
                  {lane.label}
                </div>
              ))}
            </div>

            <div ref={chartRef} className="min-w-0 flex-1 overflow-x-auto">
              <div style={{ width: chartWidth }}>
                <div className="relative h-10 border-b border-border bg-background">
                  {sprints.map((sprint) => {
                    if (
                      sprint.endDate < range.start ||
                      sprint.startDate > range.end
                    ) {
                      return null;
                    }
                    const left =
                      daysBetween(range.start, sprint.startDate) * DAY_WIDTH;
                    const width =
                      (daysBetween(sprint.startDate, sprint.endDate) + 1) *
                      DAY_WIDTH;
                    return (
                      <div
                        key={sprint.id}
                        className="absolute top-0 flex h-full items-center overflow-hidden border-r border-accent/20 bg-accent-soft/50 px-2 text-[11px] font-medium text-accent"
                        style={{ left: Math.max(left, 0), width }}
                        title={`${sprint.name}: ${sprint.startDate} → ${sprint.endDate}`}
                      >
                        {sprint.name}
                      </div>
                    );
                  })}
                </div>
                <div className="relative flex h-8 border-b border-border">
                  {days.map((day) => (
                    <div
                      key={day}
                      className="shrink-0 border-r border-border/70 px-0.5 text-center text-[10px] leading-8 text-muted"
                      style={{ width: DAY_WIDTH }}
                    >
                      {formatAxisDay(day)}
                    </div>
                  ))}
                </div>

                {LANES.map((lane) => (
                  <LaneDropZone
                    key={lane.id}
                    lane={lane.id}
                    height={laneHeights[lane.id]}
                  >
                    <div className="pointer-events-none absolute inset-0 flex">
                      {days.map((day) => (
                        <div
                          key={day}
                          className="h-full border-r border-border/50"
                          style={{ width: DAY_WIDTH }}
                        />
                      ))}
                    </div>
                    {blocksByLane[lane.id].map((block) => (
                      <TimelineBar
                        key={block.id}
                        block={block}
                        rangeStart={range.start}
                        dayWidth={DAY_WIDTH}
                        row={stacks[lane.id].rows.get(block.id) ?? 0}
                        onCommit={persistUpdate}
                        onDelete={() => persistDelete(block.id)}
                      />
                    ))}
                  </LaneDropZone>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-border px-3 py-2 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Development
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm bg-lane-test" /> Feature
              testing
            </span>
            <span>Drag edges to resize · drag bar to move</span>
            <Button
              type="button"
              variant="ghost"
              className="ml-auto !px-2 !py-1 text-xs"
              onClick={() => {
                const el = chartRef.current;
                if (!el) return;
                const today = new Date().toISOString().slice(0, 10);
                const index = Math.max(0, daysBetween(range.start, today));
                el.scrollLeft = Math.max(0, index * DAY_WIDTH - 120);
              }}
            >
              Jump to today
            </Button>
          </div>
        </Panel>
      </div>

      <DragOverlay>
        {activeItem ? (
          <div className="rounded-md border border-border bg-white p-2 text-sm shadow-lg">
            {activeItem.title}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

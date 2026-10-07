"use server";

import { WorkLane } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTeamContext } from "@/lib/team-context";
import {
  addWorkingDays,
  defaultWorkingEnd,
  holidaySet,
  nextWorkingDay,
  toDayString,
} from "@/lib/timeline-dates";
import { prisma } from "@/lib/prisma";

const laneSchema = z.nativeEnum(WorkLane);
const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function parseDay(value: string) {
  const day = daySchema.parse(value);
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid dates.");
  }
  return date;
}

async function loadAssigneeHolidays(teamId: string, assigneeId: string) {
  const membership = await prisma.membership.findUnique({
    where: { teamId_userId: { teamId, userId: assigneeId } },
    include: { holidays: true },
  });
  if (!membership) {
    throw new Error("Assignee is not a team member.");
  }
  return holidaySet(membership.holidays.map((row) => toDayString(row.date)));
}

function revalidateTimeline(teamSlug: string) {
  revalidatePath(`/t/${teamSlug}/timeline`);
}

export async function createTimelineBlockAction(input: {
  teamSlug: string;
  backlogItemId: string;
  assigneeId: string;
  lane: WorkLane;
  startDate: string;
  endDate?: string;
}) {
  const ctx = await getTeamContext(input.teamSlug);
  const lane = laneSchema.parse(input.lane);
  const holidays = await loadAssigneeHolidays(ctx.teamId, input.assigneeId);

  const startDay = nextWorkingDay(daySchema.parse(input.startDate), holidays);
  const endDay = input.endDate
    ? (() => {
        const parsed = daySchema.parse(input.endDate);
        const snapped = nextWorkingDay(parsed, holidays);
        return snapped < startDay ? startDay : snapped;
      })()
    : defaultWorkingEnd(startDay, holidays, 2);

  const startDate = parseDay(startDay);
  const endDate = parseDay(endDay);

  if (endDate < startDate) {
    throw new Error("End date must be after start date.");
  }

  const item = await prisma.backlogItem.findFirst({
    where: { id: input.backlogItemId, teamId: ctx.teamId },
  });
  if (!item) {
    throw new Error("Backlog item not found.");
  }

  const existing = await prisma.timelineBlock.findFirst({
    where: {
      teamId: ctx.teamId,
      backlogItemId: item.id,
      lane,
    },
  });
  if (existing) {
    throw new Error("Item already scheduled on this lane.");
  }

  await prisma.timelineBlock.create({
    data: {
      teamId: ctx.teamId,
      backlogItemId: item.id,
      assigneeId: input.assigneeId,
      lane,
      startDate,
      endDate,
    },
  });

  revalidateTimeline(input.teamSlug);
}

export async function updateTimelineBlockAction(input: {
  teamSlug: string;
  blockId: string;
  lane?: WorkLane;
  assigneeId?: string;
  startDate?: string;
  endDate?: string;
}) {
  const ctx = await getTeamContext(input.teamSlug);

  const block = await prisma.timelineBlock.findFirst({
    where: { id: input.blockId, teamId: ctx.teamId },
  });
  if (!block) {
    throw new Error("Timeline block not found.");
  }

  const lane = input.lane !== undefined ? laneSchema.parse(input.lane) : block.lane;
  const assigneeId = input.assigneeId ?? block.assigneeId;
  const holidays = await loadAssigneeHolidays(ctx.teamId, assigneeId);

  let startDay =
    input.startDate !== undefined
      ? daySchema.parse(input.startDate)
      : toDayString(block.startDate);
  let endDay =
    input.endDate !== undefined
      ? daySchema.parse(input.endDate)
      : toDayString(block.endDate);

  if (input.assigneeId && input.assigneeId !== block.assigneeId) {
    startDay = nextWorkingDay(startDay, holidays);
    if (endDay < startDay) {
      endDay = addWorkingDays(startDay, 2, holidays);
    } else {
      endDay = nextWorkingDay(endDay, holidays);
      if (endDay < startDay) {
        endDay = startDay;
      }
    }
  }

  const startDate = parseDay(startDay);
  const endDate = parseDay(endDay);

  if (endDate < startDate) {
    throw new Error("End date must be after start date.");
  }

  if (lane !== block.lane) {
    const conflict = await prisma.timelineBlock.findFirst({
      where: {
        teamId: ctx.teamId,
        backlogItemId: block.backlogItemId,
        lane,
        NOT: { id: block.id },
      },
    });
    if (conflict) {
      throw new Error("Item already scheduled on this lane.");
    }
  }

  await prisma.timelineBlock.update({
    where: { id: block.id },
    data: { lane, assigneeId, startDate, endDate },
  });

  revalidateTimeline(input.teamSlug);
}

export async function deleteTimelineBlockAction(input: {
  teamSlug: string;
  blockId: string;
}) {
  const ctx = await getTeamContext(input.teamSlug);

  const block = await prisma.timelineBlock.findFirst({
    where: { id: input.blockId, teamId: ctx.teamId },
  });
  if (!block) {
    throw new Error("Timeline block not found.");
  }

  await prisma.timelineBlock.delete({ where: { id: block.id } });
  revalidateTimeline(input.teamSlug);
}

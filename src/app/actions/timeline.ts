"use server";

import { WorkLane } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTeamContext } from "@/lib/team-context";
import { prisma } from "@/lib/prisma";

const laneSchema = z.nativeEnum(WorkLane);

function parseDay(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid dates.");
  }
  return date;
}

function addDaysUtc(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function revalidateTimeline(teamSlug: string) {
  revalidatePath(`/t/${teamSlug}/timeline`);
}

export async function createTimelineBlockAction(input: {
  teamSlug: string;
  backlogItemId: string;
  lane: WorkLane;
  startDate: string;
  endDate?: string;
}) {
  const ctx = await getTeamContext(input.teamSlug);
  const lane = laneSchema.parse(input.lane);
  const startDate = parseDay(input.startDate);
  const endDate = input.endDate
    ? parseDay(input.endDate)
    : addDaysUtc(startDate, 2);

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
  const startDate =
    input.startDate !== undefined ? parseDay(input.startDate) : block.startDate;
  const endDate =
    input.endDate !== undefined ? parseDay(input.endDate) : block.endDate;

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
    data: { lane, startDate, endDate },
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

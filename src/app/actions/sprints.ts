"use server";

import { BacklogStatus, SprintStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getTeamContext } from "@/lib/team-context";
import { prisma } from "@/lib/prisma";

const sprintSchema = z.object({
  name: z.string().min(1).max(120),
  goal: z.string().max(500).optional(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  capacityPoints: z.coerce.number().int().min(0).max(10000),
  status: z.nativeEnum(SprintStatus).default(SprintStatus.planning),
});

export async function createSprintAction(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const ctx = await getTeamContext(teamSlug);

  const parsed = sprintSchema.safeParse({
    name: formData.get("name"),
    goal: formData.get("goal") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    capacityPoints: formData.get("capacityPoints") || 0,
    status: formData.get("status") || SprintStatus.planning,
  });
  if (!parsed.success) {
    throw new Error("Invalid sprint details.");
  }

  const startDate = new Date(parsed.data.startDate);
  const endDate = new Date(parsed.data.endDate);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error("Invalid dates.");
  }
  if (endDate < startDate) {
    throw new Error("End date must be after start date.");
  }

  const sprint = await prisma.sprint.create({
    data: {
      teamId: ctx.teamId,
      name: parsed.data.name,
      goal: parsed.data.goal,
      startDate,
      endDate,
      capacityPoints: parsed.data.capacityPoints,
      status: parsed.data.status,
    },
  });

  redirect(`/t/${teamSlug}/sprints/${sprint.id}`);
}

export async function updateSprintAction(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const sprintId = String(formData.get("sprintId") ?? "");
  const ctx = await getTeamContext(teamSlug);

  const parsed = sprintSchema.safeParse({
    name: formData.get("name"),
    goal: formData.get("goal") || undefined,
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    capacityPoints: formData.get("capacityPoints") || 0,
    status: formData.get("status") || SprintStatus.planning,
  });
  if (!parsed.success) {
    throw new Error("Invalid sprint details.");
  }

  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, teamId: ctx.teamId },
  });
  if (!sprint) {
    throw new Error("Sprint not found.");
  }

  await prisma.sprint.update({
    where: { id: sprintId },
    data: {
      name: parsed.data.name,
      goal: parsed.data.goal,
      startDate: new Date(parsed.data.startDate),
      endDate: new Date(parsed.data.endDate),
      capacityPoints: parsed.data.capacityPoints,
      status: parsed.data.status,
    },
  });

  revalidatePath(`/t/${teamSlug}/sprints`);
  revalidatePath(`/t/${teamSlug}/sprints/${sprintId}`);
}

export async function assignToSprintAction(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const sprintId = String(formData.get("sprintId") ?? "");
  const backlogItemId = String(formData.get("backlogItemId") ?? "");
  const ctx = await getTeamContext(teamSlug);

  const [sprint, item] = await Promise.all([
    prisma.sprint.findFirst({ where: { id: sprintId, teamId: ctx.teamId } }),
    prisma.backlogItem.findFirst({
      where: { id: backlogItemId, teamId: ctx.teamId },
      include: { sprintItem: true },
    }),
  ]);

  if (!sprint || !item) {
    throw new Error("Sprint or item not found.");
  }
  if (item.sprintItem) {
    throw new Error("Item is already committed to a sprint.");
  }

  const maxOrder = await prisma.sprintItem.aggregate({
    where: { sprintId },
    _max: { sortOrder: true },
  });

  await prisma.$transaction([
    prisma.sprintItem.create({
      data: {
        sprintId,
        backlogItemId,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
      },
    }),
    prisma.backlogItem.update({
      where: { id: backlogItemId },
      data: { status: BacklogStatus.committed },
    }),
  ]);

  revalidatePath(`/t/${teamSlug}/backlog`);
  revalidatePath(`/t/${teamSlug}/sprints/${sprintId}`);
}

export async function unassignFromSprintAction(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const sprintId = String(formData.get("sprintId") ?? "");
  const backlogItemId = String(formData.get("backlogItemId") ?? "");
  const ctx = await getTeamContext(teamSlug);

  const sprintItem = await prisma.sprintItem.findFirst({
    where: {
      sprintId,
      backlogItemId,
      sprint: { teamId: ctx.teamId },
    },
  });
  if (!sprintItem) {
    throw new Error("Sprint item not found.");
  }

  await prisma.$transaction([
    prisma.sprintItem.delete({ where: { id: sprintItem.id } }),
    prisma.backlogItem.update({
      where: { id: backlogItemId },
      data: { status: BacklogStatus.backlog },
    }),
  ]);

  revalidatePath(`/t/${teamSlug}/backlog`);
  revalidatePath(`/t/${teamSlug}/sprints/${sprintId}`);
}

export async function setMemberCapacityAction(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const sprintId = String(formData.get("sprintId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const availablePoints = Number(formData.get("availablePoints") ?? 0);
  const ctx = await getTeamContext(teamSlug);

  if (!Number.isFinite(availablePoints) || availablePoints < 0) {
    throw new Error("Invalid capacity.");
  }

  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, teamId: ctx.teamId },
  });
  if (!sprint) {
    throw new Error("Sprint not found.");
  }

  const membership = await prisma.membership.findUnique({
    where: { teamId_userId: { teamId: ctx.teamId, userId } },
  });
  if (!membership) {
    throw new Error("User is not on this team.");
  }

  await prisma.memberCapacity.upsert({
    where: { sprintId_userId: { sprintId, userId } },
    create: { sprintId, userId, availablePoints: Math.round(availablePoints) },
    update: { availablePoints: Math.round(availablePoints) },
  });

  const capacities = await prisma.memberCapacity.findMany({
    where: { sprintId },
  });
  const total = capacities.reduce((sum, row) => sum + row.availablePoints, 0);
  await prisma.sprint.update({
    where: { id: sprintId },
    data: { capacityPoints: total },
  });

  revalidatePath(`/t/${teamSlug}/sprints/${sprintId}`);
}

export async function reorderSprintItemsAction(
  teamSlug: string,
  sprintId: string,
  orderedIds: string[],
) {
  const ctx = await getTeamContext(teamSlug);

  const sprint = await prisma.sprint.findFirst({
    where: { id: sprintId, teamId: ctx.teamId },
  });
  if (!sprint) {
    throw new Error("Sprint not found.");
  }

  const items = await prisma.sprintItem.findMany({
    where: { sprintId, backlogItemId: { in: orderedIds } },
    select: { backlogItemId: true },
  });
  const allowed = new Set(items.map((item) => item.backlogItemId));

  await prisma.$transaction(
    orderedIds
      .filter((id) => allowed.has(id))
      .map((id, index) =>
        prisma.sprintItem.update({
          where: { backlogItemId: id },
          data: { sortOrder: index + 1 },
        }),
      ),
  );

  revalidatePath(`/t/${teamSlug}/sprints/${sprintId}`);
}

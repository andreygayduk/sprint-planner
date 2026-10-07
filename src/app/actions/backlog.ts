"use server";

import { BacklogStatus, Priority } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getTeamContext } from "@/lib/team-context";
import { prisma } from "@/lib/prisma";

const itemSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  storyPoints: z.coerce.number().int().min(0).max(100).optional().nullable(),
  priority: z.nativeEnum(Priority).default(Priority.medium),
});

export async function createBacklogItemAction(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const ctx = await getTeamContext(teamSlug);

  const parsed = itemSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    storyPoints: formData.get("storyPoints") || null,
    priority: formData.get("priority") || Priority.medium,
  });
  if (!parsed.success) {
    throw new Error("Invalid backlog item.");
  }

  const maxOrder = await prisma.backlogItem.aggregate({
    where: { teamId: ctx.teamId, status: BacklogStatus.backlog },
    _max: { sortOrder: true },
  });

  await prisma.backlogItem.create({
    data: {
      teamId: ctx.teamId,
      title: parsed.data.title,
      description: parsed.data.description,
      storyPoints: parsed.data.storyPoints,
      priority: parsed.data.priority,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath(`/t/${teamSlug}/backlog`);
  revalidatePath(`/t/${teamSlug}/sprints`);
}

export async function updateBacklogItemAction(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const ctx = await getTeamContext(teamSlug);

  const parsed = itemSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    storyPoints: formData.get("storyPoints") || null,
    priority: formData.get("priority") || Priority.medium,
  });
  if (!parsed.success) {
    throw new Error("Invalid backlog item.");
  }

  const existing = await prisma.backlogItem.findFirst({
    where: { id: itemId, teamId: ctx.teamId },
  });
  if (!existing) {
    throw new Error("Item not found.");
  }

  await prisma.backlogItem.update({
    where: { id: itemId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      storyPoints: parsed.data.storyPoints,
      priority: parsed.data.priority,
    },
  });

  revalidatePath(`/t/${teamSlug}/backlog`);
  revalidatePath(`/t/${teamSlug}/sprints`);
}

export async function deleteBacklogItemAction(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  const ctx = await getTeamContext(teamSlug);

  const existing = await prisma.backlogItem.findFirst({
    where: { id: itemId, teamId: ctx.teamId },
  });
  if (!existing) {
    throw new Error("Item not found.");
  }

  await prisma.backlogItem.delete({ where: { id: itemId } });
  revalidatePath(`/t/${teamSlug}/backlog`);
  revalidatePath(`/t/${teamSlug}/sprints`);
}

export async function reorderBacklogAction(
  teamSlug: string,
  orderedIds: string[],
) {
  const ctx = await getTeamContext(teamSlug);

  const items = await prisma.backlogItem.findMany({
    where: {
      teamId: ctx.teamId,
      id: { in: orderedIds },
      status: BacklogStatus.backlog,
    },
    select: { id: true },
  });
  const allowed = new Set(items.map((item) => item.id));

  await prisma.$transaction(
    orderedIds
      .filter((id) => allowed.has(id))
      .map((id, index) =>
        prisma.backlogItem.update({
          where: { id },
          data: { sortOrder: index + 1 },
        }),
      ),
  );

  revalidatePath(`/t/${teamSlug}/backlog`);
}

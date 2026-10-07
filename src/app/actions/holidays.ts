"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { canManageTeam, getTeamContext } from "@/lib/team-context";
import { prisma } from "@/lib/prisma";

const daySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.");

function parseDay(value: string) {
  const day = daySchema.parse(value);
  const date = new Date(`${day}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date.");
  }
  return date;
}

function revalidateMembers(teamSlug: string) {
  revalidatePath(`/t/${teamSlug}/members`);
  revalidatePath(`/t/${teamSlug}/timeline`);
}

export async function createMemberHolidayAction(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const membershipId = String(formData.get("membershipId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const dateRaw = String(formData.get("date") ?? "");

  const ctx = await getTeamContext(teamSlug);
  if (!canManageTeam(ctx.role)) {
    throw new Error("Only owners and admins can manage holidays.");
  }

  if (!name) {
    throw new Error("Holiday name is required.");
  }

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, teamId: ctx.teamId },
  });
  if (!membership) {
    throw new Error("Member not found.");
  }

  const date = parseDay(dateRaw);

  await prisma.memberHoliday.create({
    data: {
      membershipId: membership.id,
      date,
      name,
    },
  });

  revalidateMembers(teamSlug);
}

export async function deleteMemberHolidayAction(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const holidayId = String(formData.get("holidayId") ?? "");

  const ctx = await getTeamContext(teamSlug);
  if (!canManageTeam(ctx.role)) {
    throw new Error("Only owners and admins can manage holidays.");
  }

  const holiday = await prisma.memberHoliday.findFirst({
    where: {
      id: holidayId,
      membership: { teamId: ctx.teamId },
    },
  });
  if (!holiday) {
    throw new Error("Holiday not found.");
  }

  await prisma.memberHoliday.delete({ where: { id: holiday.id } });
  revalidateMembers(teamSlug);
}

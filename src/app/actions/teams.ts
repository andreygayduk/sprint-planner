"use server";

import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser, getTeamContext, canManageTeam } from "@/lib/team-context";
import { prisma } from "@/lib/prisma";
import { uniqueTeamSlug } from "@/lib/slug";

const createTeamSchema = z.object({
  name: z.string().min(2).max(80),
});

export async function createTeamAction(formData: FormData) {
  const user = await requireUser();
  const parsed = createTeamSchema.safeParse({
    name: formData.get("name"),
  });
  if (!parsed.success) {
    throw new Error("Team name must be 2–80 characters.");
  }

  const slug = await uniqueTeamSlug(parsed.data.name, async (candidate) => {
    const existing = await prisma.team.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    return Boolean(existing);
  });

  const team = await prisma.team.create({
    data: {
      name: parsed.data.name,
      slug,
      memberships: {
        create: {
          userId: user.id,
          role: Role.owner,
        },
      },
    },
  });

  redirect(`/t/${team.slug}/backlog`);
}

export async function inviteMemberAction(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const role = String(formData.get("role") ?? "member") as Role;

  if (!email || !z.string().email().safeParse(email).success) {
    throw new Error("Valid email is required.");
  }
  if (!["admin", "member"].includes(role)) {
    throw new Error("Invalid role.");
  }

  const ctx = await getTeamContext(teamSlug);
  if (!canManageTeam(ctx.role)) {
    throw new Error("Only owners and admins can invite members.");
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    const existingMembership = await prisma.membership.findUnique({
      where: {
        teamId_userId: { teamId: ctx.teamId, userId: existingUser.id },
      },
    });
    if (existingMembership) {
      throw new Error("User is already a team member.");
    }
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);

  await prisma.invite.upsert({
    where: {
      teamId_email: { teamId: ctx.teamId, email },
    },
    create: {
      teamId: ctx.teamId,
      email,
      role,
      invitedById: ctx.user.id,
      expiresAt,
    },
    update: {
      role,
      invitedById: ctx.user.id,
      expiresAt,
      acceptedAt: null,
    },
  });

  // Auto-accept if the invited user already has an account
  if (existingUser) {
    const invite = await prisma.invite.findUnique({
      where: { teamId_email: { teamId: ctx.teamId, email } },
    });
    if (invite) {
      await prisma.$transaction([
        prisma.membership.create({
          data: {
            teamId: ctx.teamId,
            userId: existingUser.id,
            role: invite.role,
          },
        }),
        prisma.invite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        }),
      ]);
    }
  }

  revalidatePath(`/t/${teamSlug}/members`);
}

export async function acceptInviteAction(token: string) {
  const user = await requireUser();
  if (!user.email) {
    throw new Error("Your account needs an email to accept invites.");
  }

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { team: true },
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    throw new Error("Invite is invalid or expired.");
  }
  if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error("This invite was sent to a different email address.");
  }

  await prisma.$transaction([
    prisma.membership.upsert({
      where: {
        teamId_userId: { teamId: invite.teamId, userId: user.id },
      },
      create: {
        teamId: invite.teamId,
        userId: user.id,
        role: invite.role,
      },
      update: {},
    }),
    prisma.invite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    }),
  ]);

  redirect(`/t/${invite.team.slug}/backlog`);
}

export async function updateMemberRoleAction(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const membershipId = String(formData.get("membershipId") ?? "");
  const role = String(formData.get("role") ?? "") as Role;

  if (!["owner", "admin", "member"].includes(role)) {
    throw new Error("Invalid role.");
  }

  const ctx = await getTeamContext(teamSlug);
  if (ctx.role !== "owner") {
    throw new Error("Only owners can change roles.");
  }

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, teamId: ctx.teamId },
  });
  if (!membership) {
    throw new Error("Membership not found.");
  }

  if (membership.role === "owner" && role !== "owner") {
    const owners = await prisma.membership.count({
      where: { teamId: ctx.teamId, role: "owner" },
    });
    if (owners <= 1) {
      throw new Error("Teams must keep at least one owner.");
    }
  }

  await prisma.membership.update({
    where: { id: membershipId },
    data: { role },
  });

  revalidatePath(`/t/${teamSlug}/members`);
}

export async function removeMemberAction(formData: FormData) {
  const teamSlug = String(formData.get("teamSlug") ?? "");
  const membershipId = String(formData.get("membershipId") ?? "");

  const ctx = await getTeamContext(teamSlug);
  if (!canManageTeam(ctx.role)) {
    throw new Error("Only owners and admins can remove members.");
  }

  const membership = await prisma.membership.findFirst({
    where: { id: membershipId, teamId: ctx.teamId },
  });
  if (!membership) {
    throw new Error("Membership not found.");
  }
  if (membership.role === "owner") {
    throw new Error("Cannot remove an owner. Change their role first.");
  }

  await prisma.membership.delete({ where: { id: membershipId } });
  revalidatePath(`/t/${teamSlug}/members`);
}

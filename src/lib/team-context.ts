import { Role } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export class TeamAccessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TeamAccessError";
  }
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new TeamAccessError("Unauthorized");
  }
  return session.user;
}

export async function getTeamContext(slug: string) {
  const user = await requireUser();

  const team = await prisma.team.findUnique({
    where: { slug },
  });
  if (!team) {
    throw new TeamAccessError("Team not found");
  }

  const membership = await prisma.membership.findUnique({
    where: {
      teamId_userId: {
        teamId: team.id,
        userId: user.id,
      },
    },
  });
  if (!membership) {
    throw new TeamAccessError("Not a member of this team");
  }

  return {
    user,
    team,
    membership,
    teamId: team.id,
    role: membership.role,
  };
}

export function canManageTeam(role: Role) {
  return role === "owner" || role === "admin";
}

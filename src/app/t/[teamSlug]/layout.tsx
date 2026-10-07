import { notFound, redirect } from "next/navigation";
import { TeamNav } from "@/components/team-nav";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const team = await prisma.team.findUnique({ where: { slug: teamSlug } });
  if (!team) {
    notFound();
  }

  const membership = await prisma.membership.findUnique({
    where: {
      teamId_userId: { teamId: team.id, userId: session.user.id },
    },
  });
  if (!membership) {
    redirect("/");
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { team: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="min-h-screen">
      <TeamNav
        teamSlug={team.slug}
        teams={memberships.map((row) => ({
          slug: row.team.slug,
          name: row.team.name,
        }))}
        userLabel={session.user.email ?? session.user.name ?? "User"}
      />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}

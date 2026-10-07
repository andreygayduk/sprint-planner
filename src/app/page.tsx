import Link from "next/link";
import { redirect } from "next/navigation";
import { createTeamAction } from "@/app/actions/teams";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Input, Label, PageHeader, Panel } from "@/components/ui";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: session.user.id },
    include: { team: true },
    orderBy: { createdAt: "asc" },
  });

  if (memberships.length === 1) {
    redirect(`/t/${memberships[0].team.slug}/backlog`);
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <PageHeader
        title="Your teams"
        description={`Signed in as ${session.user.email ?? session.user.name}`}
      />

      {memberships.length > 0 ? (
        <Panel className="mb-6 space-y-2">
          {memberships.map((membership) => (
            <Link
              key={membership.id}
              href={`/t/${membership.team.slug}/backlog`}
              className="flex items-center justify-between rounded-md border border-border px-3 py-3 hover:bg-background"
            >
              <div>
                <div className="font-medium">{membership.team.name}</div>
                <div className="text-sm text-muted">/{membership.team.slug}</div>
              </div>
              <span className="text-sm capitalize text-muted">
                {membership.role}
              </span>
            </Link>
          ))}
        </Panel>
      ) : (
        <Panel className="mb-6">
          <p className="text-sm text-muted">
            You are not on a team yet. Create one to start planning.
          </p>
        </Panel>
      )}

      <Panel>
        <h2 className="mb-3 text-lg font-semibold">Create a team</h2>
        <form action={createTeamAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="name">Team name</Label>
            <Input id="name" name="name" placeholder="Platform Squad" required />
          </div>
          <Button type="submit">Create team</Button>
        </form>
      </Panel>
    </main>
  );
}

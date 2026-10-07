import { acceptInviteAction } from "@/app/actions/teams";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Panel } from "@/components/ui";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { team: true },
  });

  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
    return (
      <main className="mx-auto max-w-md px-4 py-16">
        <Panel>
          <h1 className="text-xl font-semibold">Invite unavailable</h1>
          <p className="mt-2 text-sm text-muted">
            This invite is invalid or has expired.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-accent">
            Go home
          </Link>
        </Panel>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <Panel className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Join {invite.team.name}</h1>
          <p className="mt-2 text-sm text-muted">
            You were invited as <span className="capitalize">{invite.role}</span>.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await acceptInviteAction(token);
          }}
        >
          <Button type="submit" className="w-full">
            Accept invite
          </Button>
        </form>
      </Panel>
    </main>
  );
}

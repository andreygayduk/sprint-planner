import {
  createMemberHolidayAction,
  deleteMemberHolidayAction,
} from "@/app/actions/holidays";
import {
  inviteMemberAction,
  removeMemberAction,
  updateMemberRoleAction,
} from "@/app/actions/teams";
import { Badge, Button, Input, Label, PageHeader, Panel, Select } from "@/components/ui";
import { canManageTeam, getTeamContext } from "@/lib/team-context";
import { toDayString } from "@/lib/timeline-dates";
import { prisma } from "@/lib/prisma";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  const ctx = await getTeamContext(teamSlug);
  const manage = canManageTeam(ctx.role);

  const [members, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { teamId: ctx.teamId },
      include: {
        user: true,
        holidays: { orderBy: { date: "asc" } },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    prisma.invite.findMany({
      where: { teamId: ctx.teamId, acceptedAt: null },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Members"
        description="Manage who can plan sprints for this team, and each member’s holidays."
      />

      {manage ? (
        <Panel className="mb-6">
          <h2 className="mb-3 text-lg font-semibold">Invite by email</h2>
          <form action={inviteMemberAction} className="grid gap-3 sm:grid-cols-[1fr_140px_auto]">
            <input type="hidden" name="teamSlug" value={teamSlug} />
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select id="role" name="role" defaultValue="member">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </Select>
            </div>
            <div className="flex items-end">
              <Button type="submit">Invite</Button>
            </div>
          </form>
          <p className="mt-3 text-xs text-muted">
            Existing accounts are added immediately. New users can accept via
            invite link after registering with the same email.
          </p>
        </Panel>
      ) : null}

      <Panel className="mb-6 space-y-6">
        <h2 className="text-lg font-semibold">Team roster</h2>
        {members.map((member) => (
          <div
            key={member.id}
            className="space-y-3 border-b border-border pb-6 last:border-b-0 last:pb-0"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium">
                  {member.user.name ?? member.user.email}
                </div>
                <div className="text-sm text-muted">{member.user.email}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {ctx.role === "owner" ? (
                  <form action={updateMemberRoleAction} className="flex gap-2">
                    <input type="hidden" name="teamSlug" value={teamSlug} />
                    <input type="hidden" name="membershipId" value={member.id} />
                    <Select name="role" defaultValue={member.role}>
                      <option value="owner">Owner</option>
                      <option value="admin">Admin</option>
                      <option value="member">Member</option>
                    </Select>
                    <Button type="submit" variant="secondary">
                      Update
                    </Button>
                  </form>
                ) : (
                  <Badge>{member.role}</Badge>
                )}
                {manage && member.role !== "owner" ? (
                  <form action={removeMemberAction}>
                    <input type="hidden" name="teamSlug" value={teamSlug} />
                    <input type="hidden" name="membershipId" value={member.id} />
                    <Button type="submit" variant="danger">
                      Remove
                    </Button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="rounded-md border border-border bg-background/60 p-3">
              <div className="mb-2 text-sm font-medium text-foreground">
                Holidays
              </div>
              {member.holidays.length === 0 ? (
                <p className="mb-3 text-xs text-muted">No holidays configured.</p>
              ) : (
                <ul className="mb-3 space-y-1.5">
                  {member.holidays.map((holiday) => (
                    <li
                      key={holiday.id}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span>
                        <span className="font-medium tabular-nums">
                          {toDayString(holiday.date)}
                        </span>
                        <span className="text-muted"> — {holiday.name}</span>
                      </span>
                      {manage ? (
                        <form action={deleteMemberHolidayAction}>
                          <input type="hidden" name="teamSlug" value={teamSlug} />
                          <input
                            type="hidden"
                            name="holidayId"
                            value={holiday.id}
                          />
                          <Button
                            type="submit"
                            variant="ghost"
                            className="!px-2 !py-1 text-xs"
                          >
                            Remove
                          </Button>
                        </form>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {manage ? (
                <form
                  action={createMemberHolidayAction}
                  className="grid gap-2 sm:grid-cols-[140px_1fr_auto]"
                >
                  <input type="hidden" name="teamSlug" value={teamSlug} />
                  <input type="hidden" name="membershipId" value={member.id} />
                  <div>
                    <Label htmlFor={`date-${member.id}`}>Date</Label>
                    <Input
                      id={`date-${member.id}`}
                      name="date"
                      type="date"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor={`name-${member.id}`}>Name</Label>
                    <Input
                      id={`name-${member.id}`}
                      name="name"
                      placeholder="Holiday name"
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    <Button type="submit" variant="secondary">
                      Add
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>
          </div>
        ))}
      </Panel>

      {invites.length > 0 ? (
        <Panel className="space-y-3">
          <h2 className="text-lg font-semibold">Pending invites</h2>
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-col gap-2 border-b border-border py-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <div className="font-medium">{invite.email}</div>
                <div className="text-sm capitalize text-muted">{invite.role}</div>
              </div>
              <code className="rounded bg-background px-2 py-1 text-xs">
                /invite/{invite.token}
              </code>
            </div>
          ))}
        </Panel>
      ) : null}
    </div>
  );
}

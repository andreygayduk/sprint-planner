import {
  BacklogStatus,
  PrismaClient,
  Priority,
  Role,
  SprintStatus,
  WorkLane,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function utcToday() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()),
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  const owner = await prisma.user.upsert({
    where: { email: "owner@example.com" },
    update: {},
    create: {
      email: "owner@example.com",
      name: "Alex Owner",
      passwordHash,
    },
  });

  const member = await prisma.user.upsert({
    where: { email: "member@example.com" },
    update: {},
    create: {
      email: "member@example.com",
      name: "Sam Member",
      passwordHash,
    },
  });

  const team = await prisma.team.upsert({
    where: { slug: "platform" },
    update: {},
    create: {
      name: "Platform",
      slug: "platform",
      memberships: {
        create: [
          { userId: owner.id, role: Role.owner },
          { userId: member.id, role: Role.member },
        ],
      },
    },
  });

  const ownerMembership = await prisma.membership.findUniqueOrThrow({
    where: { teamId_userId: { teamId: team.id, userId: owner.id } },
  });
  const memberMembership = await prisma.membership.findUniqueOrThrow({
    where: { teamId_userId: { teamId: team.id, userId: member.id } },
  });

  const year = utcToday().getUTCFullYear();
  await prisma.memberHoliday.deleteMany({
    where: {
      membershipId: { in: [ownerMembership.id, memberMembership.id] },
    },
  });
  await prisma.memberHoliday.createMany({
    data: [
      // US-style holidays for the owner
      {
        membershipId: ownerMembership.id,
        date: new Date(Date.UTC(year, 0, 1)),
        name: "New Year's Day",
      },
      {
        membershipId: ownerMembership.id,
        date: new Date(Date.UTC(year, 6, 4)),
        name: "Independence Day",
      },
      {
        membershipId: ownerMembership.id,
        date: new Date(Date.UTC(year, 10, 26)),
        name: "Thanksgiving",
      },
      {
        membershipId: ownerMembership.id,
        date: new Date(Date.UTC(year, 11, 25)),
        name: "Christmas Day",
      },
      // DE-style holidays for the member
      {
        membershipId: memberMembership.id,
        date: new Date(Date.UTC(year, 0, 1)),
        name: "Neujahr",
      },
      {
        membershipId: memberMembership.id,
        date: new Date(Date.UTC(year, 4, 1)),
        name: "Tag der Arbeit",
      },
      {
        membershipId: memberMembership.id,
        date: new Date(Date.UTC(year, 9, 3)),
        name: "Tag der Deutschen Einheit",
      },
      {
        membershipId: memberMembership.id,
        date: new Date(Date.UTC(year, 11, 25)),
        name: "Erster Weihnachtstag",
      },
      {
        membershipId: memberMembership.id,
        date: new Date(Date.UTC(year, 11, 26)),
        name: "Zweiter Weihnachtstag",
      },
    ],
  });

  // Also seed nearby holidays relative to "today" so the active sprint range shows them
  const today = utcToday();
  const nearbyOwnerHoliday = addDays(today, 3);
  const nearbyMemberHoliday = addDays(today, 5);
  if (nearbyOwnerHoliday.getUTCDay() !== 0 && nearbyOwnerHoliday.getUTCDay() !== 6) {
    await prisma.memberHoliday.upsert({
      where: {
        membershipId_date: {
          membershipId: ownerMembership.id,
          date: nearbyOwnerHoliday,
        },
      },
      update: { name: "US office holiday" },
      create: {
        membershipId: ownerMembership.id,
        date: nearbyOwnerHoliday,
        name: "US office holiday",
      },
    });
  }
  if (nearbyMemberHoliday.getUTCDay() !== 0 && nearbyMemberHoliday.getUTCDay() !== 6) {
    await prisma.memberHoliday.upsert({
      where: {
        membershipId_date: {
          membershipId: memberMembership.id,
          date: nearbyMemberHoliday,
        },
      },
      update: { name: "DE office holiday" },
      create: {
        membershipId: memberMembership.id,
        date: nearbyMemberHoliday,
        name: "DE office holiday",
      },
    });
  }

  const existingItems = await prisma.backlogItem.count({
    where: { teamId: team.id },
  });

  if (existingItems === 0) {
    await prisma.backlogItem.createMany({
      data: [
        {
          teamId: team.id,
          title: "Improve sprint capacity warnings",
          description: "Show clearer over-commitment messaging on the board.",
          storyPoints: 5,
          priority: Priority.high,
          sortOrder: 1,
        },
        {
          teamId: team.id,
          title: "Invite flow polish",
          description: "Email invites and pending invite list.",
          storyPoints: 3,
          priority: Priority.medium,
          sortOrder: 2,
        },
        {
          teamId: team.id,
          title: "Backlog drag reorder",
          description: "Persist sort order after drag-and-drop.",
          storyPoints: 2,
          priority: Priority.medium,
          sortOrder: 3,
        },
        {
          teamId: team.id,
          title: "Export sprint commitment CSV",
          description: "Nice-to-have for stakeholders.",
          storyPoints: 8,
          priority: Priority.low,
          sortOrder: 4,
        },
      ],
    });
  }

  let sprint = await prisma.sprint.findFirst({
    where: { teamId: team.id, name: "Sprint 1" },
  });

  if (!sprint) {
    const start = utcToday();
    const end = addDays(start, 13);

    sprint = await prisma.sprint.create({
      data: {
        teamId: team.id,
        name: "Sprint 1",
        goal: "Ship the core planning board",
        startDate: start,
        endDate: end,
        capacityPoints: 40,
        status: SprintStatus.planning,
        capacities: {
          create: [
            { userId: owner.id, availablePoints: 20 },
            { userId: member.id, availablePoints: 20 },
          ],
        },
      },
    });
  } else {
    const start = utcToday();
    const end = addDays(start, 13);
    sprint = await prisma.sprint.update({
      where: { id: sprint.id },
      data: { startDate: start, endDate: end },
    });
  }

  const seedItems = await prisma.backlogItem.findMany({
    where: { teamId: team.id },
    orderBy: { sortOrder: "asc" },
    take: 2,
  });

  if (seedItems.length >= 2) {
    const [capacityItem, inviteItem] = seedItems;
    const sprintStart = sprint.startDate;

    for (const item of [capacityItem, inviteItem]) {
      const existingSprintItem = await prisma.sprintItem.findUnique({
        where: { backlogItemId: item.id },
      });
      if (!existingSprintItem) {
        const maxOrder = await prisma.sprintItem.aggregate({
          where: { sprintId: sprint.id },
          _max: { sortOrder: true },
        });
        await prisma.sprintItem.create({
          data: {
            sprintId: sprint.id,
            backlogItemId: item.id,
            sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
          },
        });
        await prisma.backlogItem.update({
          where: { id: item.id },
          data: { status: BacklogStatus.committed },
        });
      }
    }

    await prisma.timelineBlock.deleteMany({ where: { teamId: team.id } });
    await prisma.timelineBlock.createMany({
      data: [
        {
          teamId: team.id,
          backlogItemId: capacityItem.id,
          assigneeId: owner.id,
          lane: WorkLane.development,
          startDate: sprintStart,
          endDate: addDays(sprintStart, 3),
        },
        {
          teamId: team.id,
          backlogItemId: capacityItem.id,
          assigneeId: member.id,
          lane: WorkLane.feature_testing,
          startDate: addDays(sprintStart, 4),
          endDate: addDays(sprintStart, 6),
        },
        {
          teamId: team.id,
          backlogItemId: inviteItem.id,
          assigneeId: member.id,
          lane: WorkLane.development,
          startDate: addDays(sprintStart, 2),
          endDate: addDays(sprintStart, 5),
        },
        {
          teamId: team.id,
          backlogItemId: inviteItem.id,
          assigneeId: owner.id,
          lane: WorkLane.feature_testing,
          startDate: addDays(sprintStart, 6),
          endDate: addDays(sprintStart, 8),
        },
      ],
    });
  }

  console.log("Seed complete.");
  console.log("Demo users:");
  console.log("  owner@example.com / password123");
  console.log("  member@example.com / password123");
  console.log("Team: /t/platform/backlog");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

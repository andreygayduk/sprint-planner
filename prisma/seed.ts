import { PrismaClient, Priority, Role, SprintStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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

  const existingSprint = await prisma.sprint.findFirst({
    where: { teamId: team.id, name: "Sprint 1" },
  });

  if (!existingSprint) {
    const start = new Date();
    const end = new Date();
    end.setDate(start.getDate() + 13);

    await prisma.sprint.create({
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

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

const links = [
  { href: "backlog", label: "Backlog" },
  { href: "sprints", label: "Sprints" },
  { href: "timeline", label: "Timeline" },
  { href: "members", label: "Members" },
] as const;

export function TeamNav({
  teamSlug,
  teams,
  userLabel,
}: {
  teamSlug: string;
  teams: { slug: string; name: string }[];
  userLabel: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const segment = pathname.split("/")[3] ?? "backlog";

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/" className="text-sm font-semibold text-accent">
            Sprint Planner
          </Link>
          <nav className="flex flex-wrap gap-1">
            {links.map((link) => {
              const active = segment === link.href;
              return (
                <Link
                  key={link.href}
                  href={`/t/${teamSlug}/${link.href}`}
                  className={`rounded-md px-2.5 py-1.5 text-sm ${
                    active
                      ? "bg-accent-soft font-medium text-accent"
                      : "text-muted hover:bg-background hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2 text-muted">
            Team
            <select
              className="rounded-md border border-border bg-white px-2 py-1 text-foreground"
              value={teamSlug}
              onChange={(event) => {
                router.push(`/t/${event.target.value}/${segment}`);
              }}
            >
              {teams.map((team) => (
                <option key={team.slug} value={team.slug}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <span className="text-muted">{userLabel}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

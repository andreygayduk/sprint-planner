export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function uniqueTeamSlug(
  base: string,
  exists: (slug: string) => Promise<boolean>,
): Promise<string> {
  let slug = slugify(base) || "team";
  let candidate = slug;
  let i = 2;
  while (await exists(candidate)) {
    candidate = `${slug}-${i}`;
    i += 1;
  }
  return candidate;
}

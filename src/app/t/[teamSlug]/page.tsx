import { redirect } from "next/navigation";

export default async function TeamIndexPage({
  params,
}: {
  params: Promise<{ teamSlug: string }>;
}) {
  const { teamSlug } = await params;
  redirect(`/t/${teamSlug}/backlog`);
}

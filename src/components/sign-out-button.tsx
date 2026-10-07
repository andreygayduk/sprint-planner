"use client";

import { signOutAction } from "@/app/actions/session";
import { Button } from "@/components/ui";

export function SignOutButton() {
  return (
    <form action={signOutAction}>
      <Button type="submit" variant="ghost">
        Sign out
      </Button>
    </form>
  );
}

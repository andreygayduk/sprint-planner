"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  githubSignInAction,
  loginAction,
  registerAction,
  type AuthActionState,
} from "@/app/actions/auth";
import { Button, ErrorBanner, Input, Label, Panel } from "@/components/ui";

const initialState: AuthActionState = {};

export function LoginForm({
  callbackUrl,
  githubEnabled,
}: {
  callbackUrl: string;
  githubEnabled: boolean;
}) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <Panel className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="mt-1 text-sm text-muted">
          Plan sprints across your teams.
        </p>
      </div>
      <ErrorBanner message={state.error} />
      <form action={action} className="space-y-4">
        <input type="hidden" name="callbackUrl" value={callbackUrl} />
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      {githubEnabled ? (
        <form action={githubSignInAction}>
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <Button type="submit" variant="secondary" className="w-full">
            Continue with GitHub
          </Button>
        </form>
      ) : null}
      <p className="text-center text-sm text-muted">
        No account?{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          Create one
        </Link>
      </p>
    </Panel>
  );
}

export function RegisterForm({ githubEnabled }: { githubEnabled: boolean }) {
  const [state, action, pending] = useActionState(registerAction, initialState);

  return (
    <Panel className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Create account</h1>
        <p className="mt-1 text-sm text-muted">
          Start planning with your scrum team.
        </p>
      </div>
      <ErrorBanner message={state.error} />
      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>
      {githubEnabled ? (
        <form action={githubSignInAction}>
          <input type="hidden" name="callbackUrl" value="/" />
          <Button type="submit" variant="secondary" className="w-full">
            Continue with GitHub
          </Button>
        </form>
      ) : null}
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Sign in
        </Link>
      </p>
    </Panel>
  );
}

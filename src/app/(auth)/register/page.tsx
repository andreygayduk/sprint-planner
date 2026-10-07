import { RegisterForm } from "@/components/auth-form";

export default function RegisterPage() {
  const githubEnabled = Boolean(
    process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET,
  );

  return <RegisterForm githubEnabled={githubEnabled} />;
}

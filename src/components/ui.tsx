import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-surface p-4 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function Label({
  children,
  htmlFor,
}: {
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-sm font-medium text-foreground"
    >
      {children}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none ring-accent focus:ring-2 ${props.className ?? ""}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none ring-accent focus:ring-2 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none ring-accent focus:ring-2 ${props.className ?? ""}`}
    />
  );
}

export function Button({
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
}) {
  const styles = {
    primary: "bg-accent text-white hover:opacity-90",
    secondary: "border border-border bg-white text-foreground hover:bg-background",
    danger: "bg-danger text-white hover:opacity-90",
    ghost: "text-muted hover:bg-background hover:text-foreground",
  }[variant];

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${props.className ?? ""}`}
    />
  );
}

export function Badge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "warning" | "danger";
}) {
  const styles = {
    default: "bg-background text-muted",
    accent: "bg-accent-soft text-accent",
    warning: "bg-amber-50 text-warning",
    danger: "bg-red-50 text-danger",
  }[tone];

  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${styles}`}
    >
      {children}
    </span>
  );
}

export function ErrorBanner({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-danger">
      {message}
    </div>
  );
}

export function CapacityBar({
  committed,
  capacity,
}: {
  committed: number;
  capacity: number;
}) {
  const ratio = capacity > 0 ? committed / capacity : committed > 0 ? 1 : 0;
  const over = capacity > 0 && committed > capacity;
  const width = Math.min(ratio * 100, 100);

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">
          {committed} / {capacity} points
        </span>
        {over ? (
          <Badge tone="danger">Over capacity</Badge>
        ) : capacity > 0 && ratio >= 0.9 ? (
          <Badge tone="warning">Near capacity</Badge>
        ) : (
          <Badge tone="accent">
            {capacity > 0 ? `${Math.round(ratio * 100)}% committed` : "No capacity set"}
          </Badge>
        )}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-background">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-danger" : "bg-accent"}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

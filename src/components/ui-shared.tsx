import type { ReactNode } from "react";

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {action}
    </div>
  );
}

export function MetricCard({ label, value, accent }: {
  label: string; value: string; accent?: "green" | "red";
}) {
  const color = accent === "green" ? "var(--green)" : accent === "red" ? "var(--red)" : "var(--foreground)";
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="text-xs text-text2 uppercase tracking-wide">{label}</div>
      <div className="mt-2 text-2xl font-semibold" style={{ color }}>{value}</div>
    </div>
  );
}

export function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return null;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg3 text-text2">{platform}</span>;
}

export function PriorityBadge({ priority }: { priority: string | null }) {
  const colors: Record<string,string> = { high: "var(--green)", medium: "var(--amber)", low: "#666" };
  const labels: Record<string,string> = { high: "High", medium: "Mid", low: "Low" };
  return (
    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-white"
      style={{ background: colors[priority ?? "medium"] }}>
      {labels[priority ?? "medium"]}
    </span>
  );
}

export function Empty({
  message,
  action,
  icon,
}: { message: string; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-10 text-center flex flex-col items-center gap-3">
      {icon && <div className="text-text3">{icon}</div>}
      <p className="text-sm text-text2">{message}</p>
      {action && <div>{action}</div>}
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-bg3 ${className}`}
      style={{ backgroundImage: "linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)" }}
    />
  );
}

export function SkeletonList({ rows = 5, className = "h-12" }: { rows?: number; className?: string }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className={className} />)}
    </div>
  );
}

export function SkeletonPage({ rows = 6 }: { rows?: number }) {
  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-72" />
      <div className="mt-6"><SkeletonList rows={rows} className="h-16" /></div>
    </div>
  );
}

const ACCOUNT_STATUS_COLORS: Record<string, string> = {
  active: "#34B98A",
  appeal: "#C98F3D",
  deactivated: "#555555",
  banned: "#E15B5B",
};
const ACCOUNT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  appeal: "Appeal",
  deactivated: "Deactivated",
  banned: "Banned",
};

export function StatusDot({ status }: { status: string | null | undefined }) {
  const color = ACCOUNT_STATUS_COLORS[status ?? "deactivated"] ?? "#555";
  return (
    <span
      className="inline-block h-2 w-2 rounded-full shrink-0"
      style={{ background: color, boxShadow: `0 0 0 2px ${color}22` }}
    />
  );
}

export function AccountStatusBadge({ status }: { status: string | null | undefined }) {
  const key = status ?? "deactivated";
  const color = ACCOUNT_STATUS_COLORS[key] ?? "#555";
  const label = ACCOUNT_STATUS_LABELS[key] ?? key;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded-full"
      style={{ background: `${color}22`, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

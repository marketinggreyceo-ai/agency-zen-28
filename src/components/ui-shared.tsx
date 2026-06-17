export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
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

export function Empty({ message, action }: { message: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center">
      <p className="text-sm text-text2">{message}</p>
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

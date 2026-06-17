import { X } from "lucide-react";

const STATUSES = [
  { value: "active",      label: "Active",      color: "#1D9E75" },
  { value: "appeal",      label: "Appeal",      color: "#BA7517" },
  { value: "deactivated", label: "Deactivated", color: "#555555" },
  { value: "banned",      label: "Banned",      color: "#E24B4A" },
];

export function StatusBottomSheet({
  open,
  current,
  onClose,
  onSelect,
}: {
  open: boolean;
  current: string | null;
  onClose: () => void;
  onSelect: (status: string) => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120] bg-black/60 flex items-end" onClick={onClose}>
      <div className="w-full bg-card border-t border-border rounded-t-2xl p-4 pb-8 animate-in slide-in-from-bottom"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Изменить статус</h3>
          <button onClick={onClose} className="p-1"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-1">
          {STATUSES.map((s) => {
            const active = current === s.value;
            return (
              <button key={s.value}
                onClick={() => { onSelect(s.value); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-md text-left ${active ? "bg-bg3" : "hover:bg-bg3"}`}
                style={{ minHeight: 44 }}>
                <span className="h-3 w-3 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="flex-1 text-sm" style={{ color: s.color, fontWeight: active ? 600 : 500 }}>
                  {s.label}
                </span>
                {active && <span className="text-xs text-text2">текущий</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

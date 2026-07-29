// "План создания" tab — table of every planned account across all pixels.
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { useModels } from "@/lib/lookups";
import { useVaNames } from "@/lib/vas";
import { usePixels, usePixelProfiles } from "@/lib/pixels";
import {
  useAllPlannedAccounts, useInvalidatePlanned, plannedStatusMeta,
  PLANNED_STATUSES, type PlannedAccount,
} from "@/lib/planned";
import { platformIcon, PLATFORMS } from "@/lib/platforms";
import { ConvertPlannedModal } from "@/components/PlannedAccountModals";
import { Empty } from "@/components/ui-shared";

const GREEN = "#34B98A";

type Row = PlannedAccount & {
  modelName: string; pixelName: string; profileName: string;
};

type SortKey = "modelName" | "platform" | "niche" | "pixelName" | "profileName" | "va_name" | "status" | "created_at";

export function PlannedPlanView({ canEdit, myVaName }: { canEdit: boolean; myVaName?: string | null }) {
  const { data: planned = [] } = useAllPlannedAccounts();
  const { data: models = [] } = useModels();
  const { data: pixels = [] } = usePixels();
  const { data: profiles = [] } = usePixelProfiles();
  const vaNames = useVaNames();
  const invalidate = useInvalidatePlanned();

  const [fModel, setFModel] = useState("");
  const [fPlatform, setFPlatform] = useState("");
  const [fVa, setFVa] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "created_at", dir: -1 });
  const [converting, setConverting] = useState<PlannedAccount | null>(null);

  const rows = useMemo<Row[]>(() => {
    const modelById = new Map(models.map((m: any) => [m.id, m.name]));
    const profById = new Map(profiles.map((p) => [p.id, p]));
    const pixelById = new Map(pixels.map((p) => [p.id, p]));
    return planned.map((p) => {
      const prof = profById.get(p.pixel_profile_id);
      const px = prof ? pixelById.get(prof.pixel_id) : undefined;
      return {
        ...p,
        modelName: modelById.get(p.model_id ?? "") ?? "—",
        pixelName: px?.name ?? "—",
        profileName: prof?.name ?? "—",
      };
    });
  }, [planned, models, profiles, pixels]);

  const filtered = useMemo(() => {
    const out = rows.filter((r) =>
      (!fModel || r.model_id === fModel) &&
      (!fPlatform || r.platform === fPlatform) &&
      (!fVa || (r.va_name ?? "") === fVa) &&
      (!fStatus || r.status === fStatus));
    return out.sort((a, b) => {
      const av = `${a[sort.key] ?? ""}`.toLowerCase();
      const bv = `${b[sort.key] ?? ""}`.toLowerCase();
      return av < bv ? -sort.dir : av > bv ? sort.dir : 0;
    });
  }, [rows, fModel, fPlatform, fVa, fStatus, sort]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  }

  async function patch(id: string, values: Record<string, any>) {
    const { error } = await (supabase as any).from("planned_accounts").update(values).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  }

  async function remove(id: string) {
    if (!confirm("Удалить план?")) return;
    const { error } = await (supabase as any).from("planned_accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Удалено");
    invalidate();
  }

  const openCount = rows.filter((r) => r.status !== "created").length;
  const mine = myVaName ? rows.filter((r) => r.va_name === myVaName && r.status !== "created").length : 0;

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="text-left font-medium px-3 py-2 cursor-pointer select-none hover:text-foreground"
      onClick={() => toggleSort(k)}>
      {children}{sort.key === k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4 text-xs rounded-lg border border-border bg-card px-4 py-3">
        <span className="text-text2">Всего планов: <span className="text-foreground font-semibold">{rows.length}</span></span>
        <span className="text-text2">Открытых: <span className="font-semibold" style={{ color: GREEN }}>{openCount}</span></span>
        {myVaName && <span className="text-text2">На мне: <span className="font-semibold" style={{ color: GREEN }}>{mine}</span></span>}
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={fModel} onChange={(e) => setFModel(e.target.value)}
          className="px-2 py-1.5 rounded bg-bg3 border border-border text-xs">
          <option value="">Все модели</option>
          {models.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={fPlatform} onChange={(e) => setFPlatform(e.target.value)}
          className="px-2 py-1.5 rounded bg-bg3 border border-border text-xs">
          <option value="">Все платформы</option>
          {PLATFORMS.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
        </select>
        <select value={fVa} onChange={(e) => setFVa(e.target.value)}
          className="px-2 py-1.5 rounded bg-bg3 border border-border text-xs">
          <option value="">Все VA</option>
          {vaNames.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}
          className="px-2 py-1.5 rounded bg-bg3 border border-border text-xs">
          <option value="">Все статусы</option>
          {PLANNED_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <Empty message="Нет запланированных аккаунтов" />
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
          <table className="w-full text-xs min-w-[900px]">
            <thead className="text-text2 border-b border-border">
              <tr>
                <Th k="modelName">Модель</Th>
                <Th k="platform">Платформа</Th>
                <Th k="niche">Ниша</Th>
                <Th k="pixelName">Пиксель</Th>
                <Th k="profileName">Профиль</Th>
                <Th k="va_name">VA</Th>
                <Th k="status">Статус</Th>
                <Th k="created_at">Дата плана</Th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const meta = plannedStatusMeta(r.status);
                const open = r.status !== "created";
                const isMine = !!myVaName && r.va_name === myVaName && open;
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-0"
                    style={isMine ? { background: `${GREEN}14` } : undefined}>
                    <td className="px-3 py-2 font-medium" style={open ? { color: GREEN } : undefined}>
                      {open && <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ background: GREEN }} />}
                      {r.modelName}
                    </td>
                    <td className="px-3 py-2">{platformIcon(r.platform)} {r.platform}</td>
                    <td className="px-3 py-2" style={open ? { color: GREEN } : { color: "var(--text2)" }}>{r.niche || "—"}</td>
                    <td className="px-3 py-2 text-text2">{r.pixelName}</td>
                    <td className="px-3 py-2 text-text2">{r.profileName}</td>
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <select value={r.va_name ?? ""} onChange={(e) => patch(r.id, { va_name: e.target.value || null })}
                          className="px-1.5 py-1 rounded bg-bg3 border border-border text-xs">
                          <option value="">— не назначен —</option>
                          {vaNames.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : (r.va_name || "—")}
                    </td>
                    <td className="px-3 py-2">
                      {canEdit ? (
                        <select value={r.status}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "created") setConverting(r);
                            else patch(r.id, { status: v });
                          }}
                          className="px-1.5 py-1 rounded bg-bg3 border border-border text-xs"
                          style={{ color: meta.color }}>
                          {PLANNED_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      ) : (
                        <span style={{ color: meta.color }}>{meta.label}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-text2">
                      {new Date(r.created_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {canEdit && (
                        <button onClick={() => remove(r.id)} className="text-text3 hover:text-[color:var(--red)]" title="Удалить">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {converting && (
        <ConvertPlannedModal
          planned={converting}
          onClose={() => setConverting(null)}
          onSaved={() => { setConverting(null); invalidate(); }}
        />
      )}
    </div>
  );
}

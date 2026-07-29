// Modals for planning an account in a pixel profile slot and converting it to a real account.
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useModels } from "@/lib/lookups";
import { useNiches, ensureNiche, type PlannedAccount } from "@/lib/planned";
import { platformIcon } from "@/lib/platforms";

function Shell({ title, onClose, children, footer }: {
  title: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-full max-w-md my-16" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium">{title}</span>
          <button onClick={onClose} className="text-text2 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="p-4 space-y-3">{children}</div>
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">{footer}</div>
      </div>
    </div>
  );
}

export function PlanAccountModal({ profileId, platform, onClose, onSaved }: {
  profileId: string; platform: string; onClose: () => void; onSaved: () => void;
}) {
  const { data: models = [] } = useModels();
  const { data: niches = [] } = useNiches();
  const [modelId, setModelId] = useState("");
  const [niche, setNiche] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!modelId) return toast.error("Выберите модель");
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("planned_accounts").insert({
        pixel_profile_id: profileId,
        platform,
        model_id: modelId,
        niche: niche.trim() || null,
        status: "planned",
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
      if (niche.trim() && !niches.some((n) => n.name.toLowerCase() === niche.trim().toLowerCase())) {
        await ensureNiche(niche);
      }
      toast.success("Запланировано");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Ошибка");
    } finally { setSaving(false); }
  }

  return (
    <Shell
      title={`Создать аккаунт — ${platformIcon(platform)} ${platform}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-border text-text2">Отмена</button>
          <button onClick={save} disabled={saving}
            className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground font-medium disabled:opacity-50">
            Запланировать
          </button>
        </>
      }
    >
      <div>
        <label className="block text-xs text-text2 mb-1">Модель</label>
        <select value={modelId} onChange={(e) => setModelId(e.target.value)}
          className="w-full px-3 py-2 rounded bg-bg3 border border-border text-sm">
          <option value="">— выберите —</option>
          {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-text2 mb-1">Ниша</label>
        <input list="niche-suggestions" value={niche} onChange={(e) => setNiche(e.target.value)}
          placeholder="feet, Dom, softcore…"
          className="w-full px-3 py-2 rounded bg-bg3 border border-border text-sm" />
        <datalist id="niche-suggestions">
          {niches.map((n) => <option key={n.id} value={n.name} />)}
        </datalist>
      </div>
    </Shell>
  );
}

export function ConvertPlannedModal({ planned, onClose, onSaved }: {
  planned: PlannedAccount; onClose: () => void; onSaved: () => void;
}) {
  const [accountName, setAccountName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const name = accountName.trim().replace(/^@/, "");
    if (!name) return toast.error("Введите юзернейм");
    setSaving(true);
    try {
      const { data: acc, error } = await (supabase as any).from("model_accounts").insert({
        account_name: name,
        account_url: url.trim() || null,
        platform: planned.platform,
        model_id: planned.model_id,
        notes: planned.niche ? `Ниша: ${planned.niche}` : null,
      }).select("id").single();
      if (error) throw error;

      const { error: linkErr } = await (supabase as any).from("pixel_profile_accounts")
        .insert({ profile_id: planned.pixel_profile_id, account_id: acc.id });
      if (linkErr) throw linkErr;

      const { error: upErr } = await (supabase as any).from("planned_accounts")
        .update({ status: "created" }).eq("id", planned.id);
      if (upErr) throw upErr;

      toast.success("Аккаунт создан");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Ошибка");
    } finally { setSaving(false); }
  }

  return (
    <Shell
      title="Аккаунт создан"
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-border text-text2">Отмена</button>
          <button onClick={save} disabled={saving}
            className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground font-medium disabled:opacity-50">
            Сохранить
          </button>
        </>
      }
    >
      <div>
        <label className="block text-xs text-text2 mb-1">Юзернейм</label>
        <input value={accountName} onChange={(e) => setAccountName(e.target.value)}
          placeholder="loona_softfeet"
          className="w-full px-3 py-2 rounded bg-bg3 border border-border text-sm" />
      </div>
      <div>
        <label className="block text-xs text-text2 mb-1">Ссылка (необязательно)</label>
        <input value={url} onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="w-full px-3 py-2 rounded bg-bg3 border border-border text-sm" />
      </div>
    </Shell>
  );
}

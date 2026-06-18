import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty } from "@/components/ui-shared";
import { useProfile } from "@/lib/auth";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/chatting")({
  ssr: false,
  component: Page,
});

function Page() {
  const { data: profile } = useProfile();
  const isOwner = profile?.role === "owner";
  const [tab, setTab] = useState<"sales" | "settings">(isOwner ? "settings" : "sales");

  useEffect(() => {
    if (!isOwner) setTab("sales");
  }, [isOwner]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader title="Чаттинг" />

      <div className="flex gap-1 border-b border-border">
        <button
          onClick={() => setTab("sales")}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === "sales" ? "border-teal text-text" : "border-transparent text-text2"
          }`}
        >
          Продажи
        </button>
        {isOwner && (
          <button
            onClick={() => setTab("settings")}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "settings" ? "border-teal text-text" : "border-transparent text-text2"
            }`}
          >
            Настройки
          </button>
        )}
      </div>

      {tab === "sales" && (
        <Empty message="Вкладка «Продажи» появится в следующем обновлении." />
      )}
      {tab === "settings" && isOwner && <SettingsTab />}
    </div>
  );
}

function SettingsTab() {
  return (
    <div className="space-y-8">
      <ChatterAccountsSection />
      <PeriodsSection />
    </div>
  );
}

/* ===================== Chatter accounts ===================== */

function ChatterAccountsSection() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ["chatter_accounts"],
    queryFn: async () => (await supabase.from("chatter_accounts").select("*").order("created_at")).data ?? [],
  });
  const { data: members = [] } = useQuery({
    queryKey: ["team_members_all"],
    queryFn: async () => (await supabase.from("team_members").select("id, name, role").order("name")).data ?? [],
  });
  const { data: models = [] } = useQuery({
    queryKey: ["models_list_chat"],
    queryFn: async () => (await supabase.from("models").select("id, name").order("name")).data ?? [],
  });

  const memberMap = new Map(members.map((m: any) => [m.id, m.name]));
  const modelMap = new Map(models.map((m: any) => [m.id, m.name]));

  const toggleActive = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase.from("chatter_accounts").update({ is_active: val }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chatter_accounts"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const removeAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chatter_accounts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Аккаунт удалён");
      qc.invalidateQueries({ queryKey: ["chatter_accounts"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Аккаунты чаттеров</h2>
        <button
          onClick={() => { setEditing(null); setOpen(true); }}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-teal text-primary-foreground text-sm font-medium"
        >
          <Plus className="h-4 w-4" /> Добавить аккаунт
        </button>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-x-auto">
        {accounts.length === 0 ? (
          <div className="p-6 text-center text-text2 text-sm">Нет аккаунтов</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-bg2 text-text2 text-xs uppercase">
              <tr>
                <th className="text-left p-3">Аккаунт</th>
                <th className="text-left p-3">Модель</th>
                <th className="text-left p-3">Чаттер</th>
                <th className="text-left p-3">Комиссия %</th>
                <th className="text-left p-3">Статус</th>
                <th className="text-right p-3">Действия</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a: any) => (
                <tr key={a.id} className="border-t border-border">
                  <td className="p-3 font-medium">{a.account_name}</td>
                  <td className="p-3">{modelMap.get(a.model_id) ?? "—"}</td>
                  <td className="p-3">{memberMap.get(a.chatter_id) ?? "—"}</td>
                  <td className="p-3">{a.commission_pct}%</td>
                  <td className="p-3">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={a.is_active}
                        onChange={(e) => toggleActive.mutate({ id: a.id, val: e.target.checked })}
                      />
                      <span className={a.is_active ? "text-teal" : "text-text2"}>
                        {a.is_active ? "Активен" : "Выключен"}
                      </span>
                    </label>
                  </td>
                  <td className="p-3 text-right space-x-2 whitespace-nowrap">
                    <button
                      onClick={() => { setEditing(a); setOpen(true); }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-xs"
                    >
                      <Pencil className="h-3 w-3" /> Изменить
                    </button>
                    <button
                      onClick={() => { if (confirm(`Удалить аккаунт "${a.account_name}"?`)) removeAccount.mutate(a.id); }}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-xs text-rose"
                    >
                      <Trash2 className="h-3 w-3" /> Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {open && (
        <AccountModal
          initial={editing}
          members={members}
          models={models}
          onClose={() => { setOpen(false); setEditing(null); }}
          onSaved={() => {
            setOpen(false);
            setEditing(null);
            qc.invalidateQueries({ queryKey: ["chatter_accounts"] });
            qc.invalidateQueries({ queryKey: ["team_members_all"] });
          }}
        />
      )}
    </section>
  );
}

function AccountModal({
  initial, members, models, onClose, onSaved,
}: {
  initial: any | null;
  members: any[];
  models: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [chatterId, setChatterId] = useState<string>(initial?.chatter_id ?? "");
  const [newChatterName, setNewChatterName] = useState("");
  const [modelId, setModelId] = useState<string>(initial?.model_id ?? "");
  const [accountName, setAccountName] = useState<string>(initial?.account_name ?? "");
  const [commission, setCommission] = useState<number>(initial?.commission_pct ?? 25);
  const [isActive, setIsActive] = useState<boolean>(initial?.is_active ?? true);

  const save = useMutation({
    mutationFn: async () => {
      let finalChatterId = chatterId;

      if (chatterId === "__new__") {
        const name = newChatterName.trim();
        if (!name) throw new Error("Введите имя чаттера");
        const { data, error } = await supabase
          .from("team_members")
          .insert({ name, role: "va" } as any)
          .select("id")
          .single();
        if (error) throw error;
        finalChatterId = (data as any).id;
      }

      if (!finalChatterId) throw new Error("Выберите чаттера");
      if (!modelId) throw new Error("Выберите модель");
      if (!accountName.trim()) throw new Error("Укажите название аккаунта");

      const payload = {
        chatter_id: finalChatterId,
        model_id: modelId,
        account_name: accountName.trim(),
        commission_pct: commission,
        is_active: isActive,
      };

      if (initial) {
        const { error } = await supabase.from("chatter_accounts").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("chatter_accounts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Сохранено"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-base font-semibold">{initial ? "Изменить аккаунт" : "Новый аккаунт"}</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-text2 mb-1">Чаттер</label>
            <select
              value={chatterId}
              onChange={(e) => setChatterId(e.target.value)}
              className="w-full px-3 py-2 rounded bg-bg2 border border-border text-sm"
            >
              <option value="">— выберите —</option>
              {members.map((m: any) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
              <option value="__new__">+ Новый чаттер…</option>
            </select>
            {chatterId === "__new__" && (
              <input
                value={newChatterName}
                onChange={(e) => setNewChatterName(e.target.value)}
                placeholder="Имя нового чаттера"
                className="mt-2 w-full px-3 py-2 rounded bg-bg2 border border-border text-sm"
              />
            )}
          </div>

          <div>
            <label className="block text-xs text-text2 mb-1">Модель</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full px-3 py-2 rounded bg-bg2 border border-border text-sm"
            >
              <option value="">— выберите —</option>
              {models.map((m: any) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-text2 mb-1">Название аккаунта</label>
            <input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder="Temikmiufeet"
              className="w-full px-3 py-2 rounded bg-bg2 border border-border text-sm"
            />
          </div>

          <div>
            <label className="block text-xs text-text2 mb-1">Комиссия %</label>
            <input
              type="number"
              min={0}
              max={100}
              value={commission}
              onChange={(e) => setCommission(Number(e.target.value))}
              className="w-full px-3 py-2 rounded bg-bg2 border border-border text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Активен
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded border border-border text-sm">Отмена</button>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="px-3 py-1.5 rounded bg-teal text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===================== Periods ===================== */

function PeriodsSection() {
  const qc = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["finance_settings"],
    queryFn: async () => (await supabase.from("finance_settings").select("*").limit(1).maybeSingle()).data,
  });
  const [mode, setMode] = useState<string>("biweekly");

  useEffect(() => {
    if (settings?.chatter_period_mode) setMode(settings.chatter_period_mode);
  }, [settings?.chatter_period_mode]);

  const save = useMutation({
    mutationFn: async () => {
      if (!settings?.id) {
        const { error } = await supabase.from("finance_settings").insert({ chatter_period_mode: mode });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("finance_settings").update({ chatter_period_mode: mode }).eq("id", settings.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Сохранено"); qc.invalidateQueries({ queryKey: ["finance_settings"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold">Периоды выплат</h2>
      <div className="rounded-lg border border-border bg-card p-4 space-y-3 max-w-md">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name="period" checked={mode === "biweekly"} onChange={() => setMode("biweekly")} />
          1–15 и 16–30 каждого месяца
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="radio" name="period" checked={mode === "monthly"} onChange={() => setMode("monthly")} />
          1 раз в месяц
        </label>
        <div className="pt-2">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="px-3 py-1.5 rounded bg-teal text-primary-foreground text-sm font-medium disabled:opacity-50"
          >
            Сохранить
          </button>
        </div>
      </div>
    </section>
  );
}

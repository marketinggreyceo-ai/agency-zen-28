import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { PageHeader } from "@/components/ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";

export const Route = createFileRoute("/app/voice-access")({
  ssr: false,
  component: Page,
});

type Profile = { id: string; full_name: string | null; email: string | null; role: string };
type Perm = {
  user_id: string;
  can_generate_voice: boolean;
  daily_limit: number;
  char_limit: number;
};
type UsageRow = { user_id: string; created_at: string; text_length: number | null };

function isAdminRole(role: string | undefined) {
  return role === "owner" || role === "production";
}

function todayISO() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.toISOString();
}

function Page() {
  const { data: profile, isLoading } = useProfile();
  const admin = isAdminRole(profile?.role);
  const qc = useQueryClient();

  const usersQ = useQuery({
    enabled: admin,
    queryKey: ["voice_access_users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, role")
        .eq("status", "active")
        .order("full_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });

  const permsQ = useQuery({
    enabled: admin,
    queryKey: ["voice_access_perms"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("voice_permissions")
        .select("user_id, can_generate_voice, daily_limit, char_limit");
      if (error) throw error;
      return (data ?? []) as Perm[];
    },
  });

  const usageQ = useQuery({
    enabled: admin,
    queryKey: ["voice_access_usage"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("voice_generation_log")
        .select("user_id, created_at, text_length");
      if (error) throw error;
      return (data ?? []) as UsageRow[];
    },
  });

  const permMap = useMemo(() => {
    const m = new Map<string, Perm>();
    for (const p of permsQ.data ?? []) m.set(p.user_id, p);
    return m;
  }, [permsQ.data]);

  const usageStats = useMemo(() => {
    const start = todayISO();
    const stats = new Map<string, { total: number; today: number }>();
    for (const r of usageQ.data ?? []) {
      const s = stats.get(r.user_id) ?? { total: 0, today: 0 };
      s.total += 1;
      if (r.created_at >= start) s.today += 1;
      stats.set(r.user_id, s);
    }
    return stats;
  }, [usageQ.data]);

  const upsert = useMutation({
    mutationFn: async (row: Perm) => {
      const { error } = await (supabase as any)
        .from("voice_permissions")
        .upsert(row, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Сохранено");
      qc.invalidateQueries({ queryKey: ["voice_access_perms"] });
    },
    onError: (e: any) => toast.error(e?.message || "Ошибка сохранения"),
  });

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto">
        <PageHeader title="Voice Access Management" />
        <div className="p-8 text-center text-text2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Загрузка…
        </div>
      </div>
    );
  }
  if (!admin) return <Navigate to="/app" />;

  const users = usersQ.data ?? [];

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader title="Voice Access Management" />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-bg2 text-[11px] uppercase tracking-wide text-text2">
              <tr>
                <th className="text-left px-3 py-2">Пользователь</th>
                <th className="text-center px-3 py-2">Доступ</th>
                <th className="text-center px-3 py-2">Лимит в день</th>
                <th className="text-center px-3 py-2">Лимит символов</th>
                <th className="text-center px-3 py-2">Сегодня</th>
                <th className="text-center px-3 py-2">Всего</th>
                <th className="text-right px-3 py-2">Действие</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  perm={permMap.get(u.id)}
                  usage={usageStats.get(u.id) ?? { total: 0, today: 0 }}
                  onSave={(row) => upsert.mutate(row)}
                  saving={upsert.isPending}
                />
              ))}
              {users.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-8 text-center text-text3">Нет пользователей</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserRow({
  user, perm, usage, onSave, saving,
}: {
  user: Profile;
  perm: Perm | undefined;
  usage: { total: number; today: number };
  onSave: (row: Perm) => void;
  saving: boolean;
}) {
  const [can, setCan] = useState(perm?.can_generate_voice ?? false);
  const [daily, setDaily] = useState(perm?.daily_limit ?? 10);
  const [chars, setChars] = useState(perm?.char_limit ?? 500);

  const dirty =
    can !== (perm?.can_generate_voice ?? false) ||
    daily !== (perm?.daily_limit ?? 10) ||
    chars !== (perm?.char_limit ?? 500);

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-2">
        <div className="font-medium">{user.full_name || "—"}</div>
        <div className="text-xs text-text3">{user.email}</div>
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="checkbox"
          checked={can}
          onChange={(e) => setCan(e.target.checked)}
          className="h-4 w-4 accent-[#C8A566]"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="number"
          min={0}
          value={daily}
          onChange={(e) => setDaily(Math.max(0, parseInt(e.target.value || "0", 10)))}
          className="w-20 rounded-md bg-bg2 border border-border px-2 py-1 text-sm text-center"
        />
      </td>
      <td className="px-3 py-2 text-center">
        <input
          type="number"
          min={0}
          value={chars}
          onChange={(e) => setChars(Math.max(0, parseInt(e.target.value || "0", 10)))}
          className="w-24 rounded-md bg-bg2 border border-border px-2 py-1 text-sm text-center"
        />
      </td>
      <td className="px-3 py-2 text-center text-text2">{usage.today}</td>
      <td className="px-3 py-2 text-center text-text2">{usage.total}</td>
      <td className="px-3 py-2 text-right">
        <button
          disabled={!dirty || saving}
          onClick={() => onSave({
            user_id: user.id,
            can_generate_voice: can,
            daily_limit: daily,
            char_limit: chars,
          })}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-[#C8A566] text-black disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save className="h-3.5 w-3.5" /> Сохранить
        </button>
      </td>
    </tr>
  );
}

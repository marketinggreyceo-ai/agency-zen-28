// "Пиксели" tab on the Модели page: pixels → profiles → assigned accounts.
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, Plus, Edit, Trash2, X, ArrowUp, ArrowDown, GripVertical, Link2 } from "lucide-react";
import { Empty } from "@/components/ui-shared";
import {
  usePixels, usePixelProfiles, usePixelProfileAccounts, useInvalidatePixels,
  type PixelProfile,
} from "@/lib/pixels";

import { PIXEL_GROUP_PLATFORMS as GROUP_PLATFORMS, platformIcon } from "@/lib/platforms";
import { usePlannedAccounts, useInvalidatePlanned, type PlannedAccount } from "@/lib/planned";
import { PlanAccountModal, ConvertPlannedModal } from "@/components/PlannedAccountModals";
import { useModels } from "@/lib/lookups";

export function PixelsView({ accounts, canEdit }: { accounts: any[]; canEdit: boolean }) {
  const { data: pixels = [] } = usePixels();
  const { data: profiles = [] } = usePixelProfiles();
  const { data: links = [] } = usePixelProfileAccounts();
  const { data: planned = [] } = usePlannedAccounts();
  const { data: models = [] } = useModels({ includeArchived: true });
  const invalidate = useInvalidatePixels();
  const invalidatePlanned = useInvalidatePlanned();

  const [open, setOpen] = useState<Set<string>>(new Set());
  const [editingProfile, setEditingProfile] = useState<{ profile: PixelProfile | null; pixelId: string } | null>(null);
  const [planning, setPlanning] = useState<{ profileId: string; platform: string } | null>(null);
  const [converting, setConverting] = useState<PlannedAccount | null>(null);

  const modelName = useMemo(() => new Map(models.map((m: any) => [m.id, m.name])), [models]);
  const plannedByProfile = useMemo(() => {
    const m = new Map<string, PlannedAccount[]>();
    for (const p of planned) {
      const arr = m.get(p.pixel_profile_id) ?? [];
      arr.push(p); m.set(p.pixel_profile_id, arr);
    }
    return m;
  }, [planned]);

  async function deletePlanned(id: string) {
    if (!window.confirm("Удалить запланированный аккаунт?")) return;
    const { error } = await (supabase as any).from("planned_accounts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidatePlanned();
  }

  const accountById = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);
  const profilesByPixel = useMemo(() => {
    const m = new Map<string, PixelProfile[]>();
    for (const p of profiles) {
      const arr = m.get(p.pixel_id) ?? [];
      arr.push(p); m.set(p.pixel_id, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at));
    }
    return m;
  }, [profiles]);

  const accountIdsByProfile = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const l of links) {
      const arr = m.get(l.profile_id) ?? [];
      arr.push(l.account_id); m.set(l.profile_id, arr);
    }
    return m;
  }, [links]);

  // account_id → label, for the "already assigned" hint in the modal
  const assignmentLabel = useMemo(() => {
    const pixelById = new Map(pixels.map((p) => [p.id, p]));
    const profileById = new Map(profiles.map((p) => [p.id, p]));
    const m = new Map<string, { profileId: string; label: string }>();
    for (const l of links) {
      const prof = profileById.get(l.profile_id);
      const px = prof ? pixelById.get(prof.pixel_id) : null;
      if (!prof || !px) continue;
      m.set(l.account_id, { profileId: prof.id, label: `${px.name} → ${prof.name}` });
    }
    return m;
  }, [pixels, profiles, links]);

  async function addPixel() {
    const name = window.prompt("Название пикселя", `Pixel ${pixels.length + 1}`);
    if (!name?.trim()) return;
    const { error } = await (supabase as any).from("pixels").insert({ name: name.trim() });
    if (error) return toast.error(error.message);
    invalidate(); toast.success("Пиксель добавлен");
  }
  async function renamePixel(id: string, current: string) {
    const name = window.prompt("Новое название", current);
    if (!name?.trim() || name.trim() === current) return;
    const { error } = await (supabase as any).from("pixels").update({ name: name.trim() }).eq("id", id);
    if (error) return toast.error(error.message);
    invalidate();
  }
  async function deletePixel(id: string, name: string) {
    if (!window.confirm(`Удалить пиксель «${name}» со всеми профилями?`)) return;
    const { error } = await (supabase as any).from("pixels").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate(); toast.success("Удалено");
  }
  async function deleteProfile(id: string, name: string) {
    if (!window.confirm(`Удалить профиль «${name}»?`)) return;
    const { error } = await (supabase as any).from("pixel_profiles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    invalidate(); toast.success("Удалено");
  }

  /** Move a profile up/down inside its pixel and persist sort_order. */
  async function moveProfile(pixelId: string, index: number, dir: -1 | 1) {
    const list = [...(profilesByPixel.get(pixelId) ?? [])];
    const target = index + dir;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    const updates = list.map((p, i) =>
      (supabase as any).from("pixel_profiles").update({ sort_order: i }).eq("id", p.id));
    const results = await Promise.all(updates);
    const bad = results.find((r: any) => r.error);
    if (bad) return toast.error(bad.error.message);
    invalidate();
  }


  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="rounded-lg border border-border bg-card p-3 flex flex-wrap items-center gap-3 text-xs">
        <span className="text-text2">Всего пикселей: <span className="text-foreground font-semibold">{pixels.length}</span></span>
        <span className="text-text3">·</span>
        <span className="text-text2">Всего профилей: <span className="text-foreground font-semibold">{profiles.length}</span></span>
        <span className="text-text3">·</span>
        <span className="text-text2">
          Аккаунтов привязано: <span className="text-foreground font-semibold">{links.length}</span> / {accounts.length}
        </span>
        <span className="text-text3">·</span>
        <span className="text-text2">Планируется: <span className="text-foreground font-semibold">{planned.length}</span></span>

        {canEdit && (
          <button onClick={addPixel}
            className="ml-auto px-3 py-1.5 rounded bg-primary text-primary-foreground font-medium inline-flex items-center gap-1">
            <Plus className="h-3.5 w-3.5" /> Новый пиксель
          </button>
        )}
      </div>

      {pixels.length === 0 && <Empty message="Пикселей пока нет" />}

      {pixels.map((px) => {
        const pxProfiles = profilesByPixel.get(px.id) ?? [];
        const accountCount = pxProfiles.reduce((n, p) => n + (accountIdsByProfile.get(p.id)?.length ?? 0), 0);
        const isOpen = open.has(px.id);
        return (
          <div key={px.id} className="rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 px-3 py-3">
              <button
                onClick={() => {
                  const s = new Set(open);
                  isOpen ? s.delete(px.id) : s.add(px.id);
                  setOpen(s);
                }}
                className="text-text2 hover:text-foreground"
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <span className="font-medium text-foreground text-sm">{px.name}</span>
              <span className="text-xs text-text3">
                Профилей: {pxProfiles.length} · Аккаунтов: {accountCount}
              </span>
              {canEdit && (
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={() => setEditingProfile({ profile: null, pixelId: px.id })}
                    className="text-xs px-2 py-1 rounded border border-border text-text2 hover:text-foreground inline-flex items-center gap-1">
                    <Plus className="h-3 w-3" /> Новый профиль
                  </button>
                  <button onClick={() => renamePixel(px.id, px.name)}
                    className="p-1 rounded border border-border text-text2 hover:text-foreground" title="Переименовать">
                    <Edit className="h-3 w-3" />
                  </button>
                  <button onClick={() => deletePixel(px.id, px.name)}
                    className="p-1 rounded border border-border text-text2 hover:text-[color:var(--red)]" title="Удалить">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>

            {isOpen && (
              <div className="border-t border-border divide-y divide-border">
                {pxProfiles.length === 0 && (
                  <div className="px-4 py-3 text-xs text-text3">Профилей нет</div>
                )}
                {pxProfiles.map((p, pi) => {
                  const ids = accountIdsByProfile.get(p.id) ?? [];
                  const accs = ids.map((id) => accountById.get(id)).filter(Boolean);
                  const platforms = Array.from(new Set([...GROUP_PLATFORMS, ...accs.map((a: any) => a.platform ?? "—")]));
                  return (
                    <div key={p.id} className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        {canEdit && (
                          <div className="flex items-center gap-0.5 shrink-0">
                            <GripVertical className="h-3.5 w-3.5 text-text3" />
                            <button
                              onClick={() => moveProfile(px.id, pi, -1)}
                              disabled={pi === 0}
                              title="Выше"
                              className="p-0.5 rounded border border-border text-text2 hover:text-foreground disabled:opacity-30"
                            >
                              <ArrowUp className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => moveProfile(px.id, pi, 1)}
                              disabled={pi === pxProfiles.length - 1}
                              title="Ниже"
                              className="p-0.5 rounded border border-border text-text2 hover:text-foreground disabled:opacity-30"
                            >
                              <ArrowDown className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        <span className="text-sm text-foreground">{p.name}</span>
                        <span className="text-[11px] text-text3">{ids.length} аккаунтов</span>
                        {canEdit && (
                          <div className="ml-auto flex items-center gap-1">
                            <button onClick={() => setEditingProfile({ profile: p, pixelId: px.id })}
                              className="text-xs px-2 py-1 rounded border border-border text-text2 hover:text-foreground">
                              Привязать аккаунты
                            </button>
                            <button onClick={() => deleteProfile(p.id, p.name)}
                              className="p-1 rounded border border-border text-text2 hover:text-[color:var(--red)]" title="Удалить">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        {platforms.map((pl) => {
                          const list = accs.filter((a: any) => (a.platform ?? "—") === pl);
                          const plans = (plannedByProfile.get(p.id) ?? []).filter((x) => x.platform === pl);
                          if (!GROUP_PLATFORMS.includes(pl) && list.length === 0 && plans.length === 0) return null;
                          return (
                            <div key={pl} className="text-xs flex flex-wrap items-center gap-1.5">
                              <span className="text-text2 w-28 shrink-0">{platformIcon(pl)} {pl}:</span>
                              {list.length === 0 && plans.length === 0 && <span className="text-text3">(нет)</span>}
                              {list.map((a: any) => (
                                <span key={a.id}
                                  className={`px-1.5 py-0.5 rounded border ${
                                    a.is_external
                                      ? "bg-bg3/50 border-dashed border-border text-text2 opacity-70"
                                      : "bg-bg3 border-border text-foreground"
                                  }`}>
                                  {a.account_name || "—"}
                                  {a.is_external && <span className="ml-1 text-[10px] text-text3">внешний</span>}
                                </span>
                              ))}
                              {plans.map((pa) => (
                                <span key={pa.id}
                                  className="px-2 py-0.5 rounded-md border inline-flex items-center gap-1.5 font-medium"
                                  style={{ borderColor: "#34B98A", background: "#34B98A1F", color: "#34B98A" }}>
                                  <span className="h-2 w-2 rounded-full shrink-0" style={{ background: "#34B98A" }} />
                                  {modelName.get(pa.model_id ?? "") ?? "—"}
                                  {pa.niche && <span style={{ color: "#34B98A" }}>({pa.niche})</span>}
                                  <span className="text-[10px]" style={{ color: "#34B98A" }}>
                                    — {pa.status === "in_progress" ? "в процессе" : "планируется"}
                                  </span>
                                  {pa.va_name && <span className="text-[10px] opacity-80">· VA: {pa.va_name}</span>}
                                  {canEdit && (
                                    <>
                                      <button onClick={() => setConverting(pa)}
                                        className="text-[10px] underline hover:opacity-80" style={{ color: "#34B98A" }}>
                                        Аккаунт создан
                                      </button>
                                      <button onClick={() => deletePlanned(pa.id)}
                                        className="opacity-70 hover:text-[color:var(--red)]" title="Удалить">
                                        <X className="h-3 w-3" />
                                      </button>
                                    </>
                                  )}
                                </span>
                              ))}

                              {canEdit && (
                                <button onClick={() => setPlanning({ profileId: p.id, platform: pl })}
                                  className="px-1.5 py-0.5 rounded border border-dashed border-border text-text3 hover:text-foreground">
                                  + Создать
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {editingProfile && (
        <ProfileModal
          profile={editingProfile.profile}
          pixelId={editingProfile.pixelId}
          nextSortOrder={profilesByPixel.get(editingProfile.pixelId)?.length ?? 0}
          accounts={accounts}
          assignmentLabel={assignmentLabel}
          assignedIds={editingProfile.profile ? (accountIdsByProfile.get(editingProfile.profile.id) ?? []) : []}
          onClose={() => setEditingProfile(null)}
          onSaved={() => { setEditingProfile(null); invalidate(); }}
        />
      )}

      {planning && (
        <PlanAccountModal
          profileId={planning.profileId}
          platform={planning.platform}
          onClose={() => setPlanning(null)}
          onSaved={() => { setPlanning(null); invalidatePlanned(); }}
        />
      )}

      {converting && (
        <ConvertPlannedModal
          planned={converting}
          onClose={() => setConverting(null)}
          onSaved={() => { setConverting(null); invalidatePlanned(); invalidate(); }}
        />
      )}
    </div>
  );
}

function ProfileModal({
  profile, pixelId, nextSortOrder, accounts, assignmentLabel, assignedIds, onClose, onSaved,
}: {
  profile: PixelProfile | null;
  pixelId: string;
  nextSortOrder: number;
  accounts: any[];
  assignmentLabel: Map<string, { profileId: string; label: string }>;
  assignedIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(profile?.name ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedIds));
  const [saving, setSaving] = useState(false);
  // Manually added external accounts created within this modal session.
  const [extraAccounts, setExtraAccounts] = useState<any[]>([]);
  const [manual, setManual] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState<string | null>(null);

  const allAccounts = useMemo(() => [...accounts, ...extraAccounts], [accounts, extraAccounts]);

  const platforms = useMemo(() => {
    const s = new Set<string>(GROUP_PLATFORMS);
    for (const a of allAccounts) if (a.platform) s.add(a.platform);
    return Array.from(s);
  }, [allAccounts]);

  /** Create an external (not-our-pool) account for a platform and select it. */
  async function addManual(platform: string) {
    const value = (manual[platform] ?? "").trim().replace(/^@/, "");
    if (!value) return;
    setAdding(platform);
    try {
      const { data, error } = await (supabase as any).from("model_accounts")
        .insert({ account_name: value, platform, is_external: true })
        .select("*").single();
      if (error) throw error;
      setExtraAccounts((prev) => [...prev, data]);
      setSelected((prev) => new Set(prev).add(data.id));
      setManual((m) => ({ ...m, [platform]: "" }));
      qc.invalidateQueries({ queryKey: ["model_accounts"] });
      toast.success("Внешний аккаунт добавлен");
    } catch (e: any) {
      toast.error(e.message ?? "Не удалось добавить");
    } finally {
      setAdding(null);
    }
  }


  async function save() {
    const n = name.trim();
    if (!n) return toast.error("Введите название профиля");
    setSaving(true);
    try {
      let profileId = profile?.id ?? null;
      if (profileId) {
        const { error } = await (supabase as any).from("pixel_profiles").update({ name: n }).eq("id", profileId);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any).from("pixel_profiles")
          .insert({ pixel_id: pixelId, name: n, sort_order: nextSortOrder }).select("id").single();
        if (error) throw error;
        profileId = data.id as string;
      }

      const before = new Set(assignedIds);
      const toAdd = Array.from(selected).filter((id) => !before.has(id));
      const toRemove = assignedIds.filter((id) => !selected.has(id));

      if (toRemove.length) {
        const { error } = await (supabase as any).from("pixel_profile_accounts").delete().in("account_id", toRemove);
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await (supabase as any).from("pixel_profile_accounts")
          .insert(toAdd.map((account_id) => ({ profile_id: profileId, account_id })));
        if (error) throw error;
      }
      toast.success("Сохранено");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl my-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-medium">{profile ? "Профиль" : "Новый профиль"}</span>
          <button onClick={onClose} className="text-text2 hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs text-text2 mb-1">Название профиля</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Profile 1"
              className="w-full px-3 py-2 rounded bg-bg3 border border-border text-sm" />
          </div>

          <div>
            <div className="text-xs text-text2 mb-2">Привязать аккаунты</div>
            <div className="space-y-3 max-h-[45vh] overflow-y-auto pr-1">
              {platforms.map((pl) => {
                const list = allAccounts.filter((a) => (a.platform ?? "") === pl);
                return (
                  <div key={pl}>
                    <div className="text-xs text-foreground mb-1">{platformIcon(pl)} {pl}</div>
                    {list.length === 0 && <div className="text-xs text-text3">Нет аккаунтов</div>}
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((a) => {
                        const other = assignmentLabel.get(a.id);
                        const takenByOther = !!other && other.profileId !== profile?.id;
                        const isSel = selected.has(a.id);
                        return (
                          <button
                            key={a.id}
                            disabled={takenByOther}
                            onClick={() => {
                              const s = new Set(selected);
                              isSel ? s.delete(a.id) : s.add(a.id);
                              setSelected(s);
                            }}
                            className={`text-xs px-2 py-1 rounded border ${
                              takenByOther
                                ? "bg-bg3 border-border text-text3 opacity-50 cursor-not-allowed"
                                : isSel
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : `bg-bg3 border-border text-text2${a.is_external ? " border-dashed opacity-80" : ""}`
                            }`}
                            title={takenByOther ? other!.label : a.is_external ? "Внешний аккаунт" : undefined}
                          >
                            {a.account_name || "—"}
                            {a.is_external && !isSel && <span className="ml-1 text-[10px] text-text3">внешний</span>}
                            {takenByOther && <span className="ml-1">({other!.label})</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <input
                        value={manual[pl] ?? ""}
                        onChange={(e) => setManual((m) => ({ ...m, [pl]: e.target.value }))}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addManual(pl); } }}
                        placeholder="Добавить вручную (внешний аккаунт)"
                        className="flex-1 min-w-0 px-2 py-1 rounded bg-bg3 border border-border text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => addManual(pl)}
                        disabled={adding === pl || !(manual[pl] ?? "").trim()}
                        className="px-2 py-1 rounded border border-border text-text2 hover:text-foreground disabled:opacity-40"
                        title="Добавить вручную"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );

              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
          <button onClick={onClose} className="px-3 py-1.5 text-sm rounded border border-border text-text2">Отмена</button>
          <button onClick={save} disabled={saving}
            className="px-3 py-1.5 text-sm rounded bg-primary text-primary-foreground font-medium disabled:opacity-50">
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}

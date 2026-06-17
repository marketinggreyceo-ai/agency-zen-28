// Generic editor for simple lookup tables (name [+ color | icon_name], sort_order, is_archived).
// Renders inline rows; owner-only writes.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Archive, ArchiveRestore, Trash2, Save } from "lucide-react";

type Field = "color" | "icon_name" | "none";

const COLOR_PALETTE = [
  "#5DCAA5", "#1D9E75", "#5B8DEF", "#9D6FD4", "#BA7517",
  "#E24B4A", "#D85A30", "#888888", "#555555", "#7F77DD",
];

export function LookupManager({
  table, title, queryKey, field = "color", showKey = false,
}: {
  table: string;
  title: string;
  queryKey: string[];
  field?: Field;
  /** When true, edit the stable `key` field too (only useful for first-class statuses) */
  showKey?: boolean;
}) {
  const qc = useQueryClient();
  const rows = qc.getQueryData<any[]>([table, true]) ?? qc.getQueryData<any[]>([table, false]) ?? [];

  // We deliberately re-query directly to always get full (incl. archived) list
  const [, force] = useState(0);
  if (rows.length === 0) {
    (async () => {
      const { data } = await (supabase as any).from(table).select("*").order("sort_order").order("name");
      qc.setQueryData([table, true], data ?? []);
      force((n) => n + 1);
    })();
  }
  const list: any[] = qc.getQueryData<any[]>([table, true]) ?? [];

  const [draft, setDraft] = useState<{ name: string; color: string; icon_name: string; key: string }>({
    name: "", color: COLOR_PALETTE[0], icon_name: "", key: "",
  });

  async function refresh() {
    const { data } = await (supabase as any).from(table).select("*").order("sort_order").order("name");
    qc.setQueryData([table, true], data ?? []);
    qc.invalidateQueries({ queryKey }); // also pages using the active-only key
    force((n) => n + 1);
  }

  async function add() {
    if (!draft.name.trim()) { toast.error("Введите название"); return; }
    const payload: any = { name: draft.name.trim() };
    if (field === "color")      payload.color = draft.color;
    if (field === "icon_name")  payload.icon_name = draft.icon_name || null;
    if (showKey) {
      const k = draft.key.trim() || draft.name.trim().toLowerCase().replace(/\s+/g, "_");
      payload.key = k;
    }
    payload.sort_order = (list.at(-1)?.sort_order ?? 0) + 10;
    const { error } = await (supabase as any).from(table).insert(payload);
    if (error) return toast.error(error.message);
    setDraft({ name: "", color: COLOR_PALETTE[0], icon_name: "", key: "" });
    refresh(); toast.success("Добавлено");
  }
  async function patch(id: string, p: any) {
    const { error } = await (supabase as any).from(table).update(p).eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  }
  async function hardDelete(id: string) {
    if (!confirm("Удалить безвозвратно? Записи, ссылающиеся на него, могут потерять связь.")) return;
    const { error } = await (supabase as any).from(table).delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh(); toast.success("Удалено");
  }

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="px-4 py-3 border-b border-border text-sm font-medium">{title}</div>
      <ul className="divide-y divide-border">
        {list.map((r) => (
          <Row key={r.id} row={r} field={field} showKey={showKey}
            onPatch={(p) => patch(r.id, p)} onDelete={() => hardDelete(r.id)} />
        ))}
        {list.length === 0 && <li className="px-4 py-3 text-xs text-text3">Пусто</li>}
      </ul>
      <div className="p-3 border-t border-border flex flex-wrap items-center gap-2 bg-bg2">
        {showKey && (
          <input value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })}
            placeholder="key" className="w-20 px-2 py-1.5 rounded bg-bg3 border border-border text-xs font-mono" />
        )}
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="Название"
          className="flex-1 min-w-[140px] px-2 py-1.5 rounded bg-bg3 border border-border text-sm" />
        {field === "color" && (
          <ColorSwatch value={draft.color} onChange={(c) => setDraft({ ...draft, color: c })} />
        )}
        {field === "icon_name" && (
          <input value={draft.icon_name} onChange={(e) => setDraft({ ...draft, icon_name: e.target.value })}
            placeholder="icon name" className="w-28 px-2 py-1.5 rounded bg-bg3 border border-border text-xs" />
        )}
        <button onClick={add} className="px-3 py-1.5 rounded bg-teal text-primary-foreground text-xs inline-flex items-center gap-1">
          <Plus className="h-3 w-3" /> Добавить
        </button>
      </div>
    </div>
  );
}

function Row({ row, field, showKey, onPatch, onDelete }: {
  row: any; field: Field; showKey: boolean;
  onPatch: (p: any) => void; onDelete: () => void;
}) {
  const [name, setName] = useState(row.name);
  const [iconName, setIconName] = useState(row.icon_name ?? "");
  const [color, setColor] = useState(row.color ?? COLOR_PALETTE[0]);
  const [keyVal, setKeyVal] = useState(row.key ?? "");
  const dirty =
    name !== row.name ||
    (field === "color" && color !== row.color) ||
    (field === "icon_name" && (iconName || null) !== (row.icon_name || null)) ||
    (showKey && keyVal !== row.key);

  return (
    <li className={`flex flex-wrap items-center gap-2 px-3 py-2 text-sm ${row.is_archived ? "opacity-50" : ""}`}>
      {showKey && (
        <input value={keyVal} onChange={(e) => setKeyVal(e.target.value)}
          className="w-20 px-2 py-1 rounded bg-bg3 border border-border text-xs font-mono" />
      )}
      <input value={name} onChange={(e) => setName(e.target.value)}
        className="flex-1 min-w-[140px] px-2 py-1 rounded bg-bg3 border border-border text-sm" />
      {field === "color" && (<ColorSwatch value={color} onChange={setColor} />)}
      {field === "icon_name" && (
        <input value={iconName} onChange={(e) => setIconName(e.target.value)}
          placeholder="icon" className="w-28 px-2 py-1 rounded bg-bg3 border border-border text-xs" />
      )}
      {dirty && (
        <button onClick={() => {
          const p: any = { name };
          if (field === "color") p.color = color;
          if (field === "icon_name") p.icon_name = iconName || null;
          if (showKey) p.key = keyVal;
          onPatch(p);
        }} className="text-text2 hover:text-foreground p-1" title="Сохранить">
          <Save className="h-3.5 w-3.5" />
        </button>
      )}
      <button onClick={() => onPatch({ is_archived: !row.is_archived })}
        className="text-text2 hover:text-foreground p-1" title={row.is_archived ? "Восстановить" : "Архивировать"}>
        {row.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
      </button>
      <button onClick={onDelete} className="text-text2 hover:text-red p-1" title="Удалить навсегда">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

function ColorSwatch({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)}
        className="h-7 w-7 rounded border border-border" style={{ background: value }} />
      {open && (
        <div className="absolute z-20 right-0 mt-1 p-2 rounded-md bg-card border border-border flex flex-wrap gap-1.5 w-44">
          {COLOR_PALETTE.map((c) => (
            <button key={c} onClick={() => { onChange(c); setOpen(false); }}
              className={`h-5 w-5 rounded ${value === c ? "ring-2 ring-foreground" : ""}`} style={{ background: c }} />
          ))}
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)}
            className="h-5 w-12 bg-transparent border border-border rounded" />
        </div>
      )}
    </div>
  );
}

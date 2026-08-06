import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Empty, SkeletonPage } from "@/components/ui-shared";
import { useProfile } from "@/lib/auth";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Plus, X, Copy, CalendarDays } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/app/fansly-fyp")({
  ssr: false,
  component: Page,
});

const DAY_NAMES = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

function getMonday(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day));
  x.setHours(0, 0, 0, 0);
  return x;
}
function fmtISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtRange(monday: Date) {
  const sun = addDays(monday, 6);
  const f = (x: Date) => x.toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  return `${f(monday)} — ${f(sun)} ${sun.getFullYear()}`;
}
function fmtDay(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

type Day = { id: string; week_id: string; day_of_week: number; date: string; sort_order: number };
type Tag = { id: string; day_id: string; tag: string };

function Page() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const canEdit = profile?.role === "owner" || profile?.role === "production" || profile?.role === "creative";
  const [monday, setMonday] = useState<Date>(getMonday(new Date()));
  const weekISO = fmtISO(monday);
  const prevISO = fmtISO(addDays(monday, -7));

  const { data, isLoading } = useQuery({
    queryKey: ["fansly-fyp", weekISO],
    queryFn: async () => {
      const { data: weeks, error } = await (supabase as any)
        .from("fansly_fyp_weeks").select("id, week_start_date").eq("week_start_date", weekISO).maybeSingle();
      if (error) { toast.error(error.message); }
      const week = weeks as { id: string } | null;
      if (!week) return { weekId: null as string | null, days: [] as Day[], tags: [] as Tag[] };
      const { data: days = [] } = await (supabase as any)
        .from("fansly_fyp_days").select("*").eq("week_id", week.id).order("day_of_week");
      const ids = (days as Day[]).map((d) => d.id);
      let tags: Tag[] = [];
      if (ids.length) {
        const { data: t = [] } = await (supabase as any)
          .from("fansly_fyp_tags").select("id, day_id, tag").in("day_id", ids).order("created_at");
        tags = t as Tag[];
      }
      return { weekId: week.id, days: days as Day[], tags };
    },
  });

  const days = data?.days ?? [];
  const tags = data?.tags ?? [];
  const tagsByDay = useMemo(() => {
    const m: Record<string, Tag[]> = {};
    for (const t of tags) (m[t.day_id] ??= []).push(t);
    return m;
  }, [tags]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["fansly-fyp", weekISO] });

  async function ensureWeek(iso = weekISO): Promise<string | null> {
    const { data: existing } = await (supabase as any)
      .from("fansly_fyp_weeks").select("id").eq("week_start_date", iso).maybeSingle();
    if (existing?.id) return existing.id as string;
    const { data: created, error } = await (supabase as any)
      .from("fansly_fyp_weeks").insert({ week_start_date: iso }).select("id").single();
    if (error) { toast.error(error.message); return null; }
    return created.id as string;
  }

  async function addDay(dow: number) {
    const weekId = await ensureWeek();
    if (!weekId) return;
    const { error } = await (supabase as any).from("fansly_fyp_days").insert({
      week_id: weekId, day_of_week: dow, date: fmtISO(addDays(monday, dow)), sort_order: dow,
    });
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function removeDay(id: string) {
    const { error } = await (supabase as any).from("fansly_fyp_days").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function addTag(dayId: string, value: string) {
    const tag = value.trim();
    if (!tag) return;
    const { error } = await (supabase as any).from("fansly_fyp_tags").insert({ day_id: dayId, tag });
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function removeTag(id: string) {
    const { error } = await (supabase as any).from("fansly_fyp_tags").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refresh();
  }

  async function copyPrevWeek() {
    const { data: pw } = await (supabase as any)
      .from("fansly_fyp_weeks").select("id").eq("week_start_date", prevISO).maybeSingle();
    if (!pw?.id) { toast.error("Прошлая неделя пуста"); return; }
    const { data: pDays = [] } = await (supabase as any)
      .from("fansly_fyp_days").select("*").eq("week_id", pw.id).order("day_of_week");
    if (!(pDays as Day[]).length) { toast.error("Прошлая неделя пуста"); return; }
    const pIds = (pDays as Day[]).map((d) => d.id);
    const { data: pTags = [] } = await (supabase as any)
      .from("fansly_fyp_tags").select("day_id, tag").in("day_id", pIds);

    const weekId = await ensureWeek();
    if (!weekId) return;
    const existing = new Set(days.map((d) => d.day_of_week));
    const toCreate = (pDays as Day[]).filter((d) => !existing.has(d.day_of_week));
    if (!toCreate.length) { toast.error("Все дни уже добавлены"); return; }
    const { data: newDays, error } = await (supabase as any).from("fansly_fyp_days").insert(
      toCreate.map((d) => ({
        week_id: weekId, day_of_week: d.day_of_week,
        date: fmtISO(addDays(monday, d.day_of_week)), sort_order: d.sort_order,
      })),
    ).select("id, day_of_week");
    if (error) { toast.error(error.message); return; }

    const oldByDow: Record<number, string> = {};
    for (const d of pDays as Day[]) oldByDow[d.day_of_week] = d.id;
    const rows: { day_id: string; tag: string }[] = [];
    for (const nd of (newDays ?? []) as { id: string; day_of_week: number }[]) {
      const oldId = oldByDow[nd.day_of_week];
      for (const t of (pTags ?? []) as { day_id: string; tag: string }[]) {
        if (t.day_id === oldId) rows.push({ day_id: nd.id, tag: t.tag });
      }
    }
    if (rows.length) await (supabase as any).from("fansly_fyp_tags").insert(rows);
    toast.success("Скопировано");
    refresh();
  }

  const usedDows = new Set(days.map((d) => d.day_of_week));
  const freeDows = [0, 1, 2, 3, 4, 5, 6].filter((i) => !usedDows.has(i));

  if (isLoading) return <div className="p-6"><SkeletonPage /></div>;

  return (
    <div className="p-4 md:p-6">
      <PageHeader
        title="Fansly FYP"
        action={canEdit ? (
          <div className="flex items-center gap-2">
            <button onClick={copyPrevWeek}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-bg3 border border-border text-xs text-text2 hover:text-foreground">
              <Copy className="h-3.5 w-3.5" /> Скопировать прошлую неделю
            </button>
            <AddDayButton freeDows={freeDows} onPick={addDay} />
          </div>
        ) : undefined}
      />

      <div className="flex items-center justify-between gap-3 mb-6 bg-card border border-border rounded-lg px-3 py-2">
        <button onClick={() => setMonday(addDays(monday, -7))}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs text-text2 hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Предыдущая неделя
        </button>
        <div className="text-center">
          <div className="text-sm font-medium">{fmtRange(monday)}</div>
          <button onClick={() => setMonday(getMonday(new Date()))} className="text-[11px] text-text3 hover:text-foreground">
            Текущая неделя
          </button>
        </div>
        <button onClick={() => setMonday(addDays(monday, 7))}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded text-xs text-text2 hover:text-foreground">
          Следующая неделя <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {days.length === 0 ? (
        <Empty message="На этой неделе пока нет дней" icon={<CalendarDays className="h-6 w-6 text-text3" />} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {days.map((d) => (
            <DayCard key={d.id} day={d} tags={tagsByDay[d.id] ?? []} canEdit={canEdit}
              onAddTag={addTag} onRemoveTag={removeTag} onRemoveDay={removeDay} />
          ))}
        </div>
      )}
    </div>
  );
}

function AddDayButton({ freeDows, onPick }: { freeDows: number[]; onPick: (d: number) => void }) {
  const [open, setOpen] = useState(false);
  if (!freeDows.length) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium">
          <Plus className="h-3.5 w-3.5" /> Добавить день
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        {freeDows.map((i) => (
          <button key={i} onClick={() => { onPick(i); setOpen(false); }}
            className="w-full text-left px-2.5 py-1.5 rounded text-sm hover:bg-bg3">
            {DAY_NAMES[i]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function DayCard({ day, tags, canEdit, onAddTag, onRemoveTag, onRemoveDay }: {
  day: Day; tags: Tag[]; canEdit: boolean;
  onAddTag: (dayId: string, v: string) => void;
  onRemoveTag: (id: string) => void;
  onRemoveDay: (id: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="bg-card border border-border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{DAY_NAMES[day.day_of_week]}, {fmtDay(day.date)}</div>
          <div className="text-[11px] text-text3 uppercase tracking-wide mt-0.5">Теги на день</div>
        </div>
        {canEdit && (
          <button onClick={() => onRemoveDay(day.id)} className="text-text3 hover:text-red p-1" title="Удалить день">
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {tags.length === 0 && <span className="text-xs text-text3">Тегов пока нет</span>}
        {tags.map((t) => (
          <span key={t.id}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border"
            style={{ background: "rgba(200,165,102,0.12)", borderColor: "rgba(200,165,102,0.4)", color: "#C8A566" }}>
            {t.tag}
            {canEdit && (
              <button onClick={() => onRemoveTag(t.id)} className="opacity-70 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
      </div>

      {canEdit && (
        <form
          onSubmit={(e) => { e.preventDefault(); onAddTag(day.id, value); setValue(""); }}
          className="flex items-center gap-2"
        >
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Добавить тег"
            className="flex-1 bg-bg3 border border-border rounded px-2.5 py-1.5 text-sm" />
          <button type="submit" disabled={!value.trim()}
            className="px-3 py-1.5 rounded bg-bg3 border border-border text-xs hover:text-foreground disabled:opacity-50">
            Добавить
          </button>
        </form>
      )}
    </div>
  );
}

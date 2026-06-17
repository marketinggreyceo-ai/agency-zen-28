import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PlatformBadge, PriorityBadge, fmt, Empty } from "@/components/ui-shared";
import { useProfile } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Link2, X, GripVertical } from "lucide-react";

export const Route = createFileRoute("/app/second-brain")({
  ssr: false, component: Page,
});

const BLOCK_COLORS: Record<string, string> = {
  teal: "#1FB8B0",
  red: "#E24B4A",
  amber: "#BA7517",
  purple: "#8B5CF6",
  coral: "#F97066",
  gray: "#6B7280",
};
const COLOR_KEYS = Object.keys(BLOCK_COLORS);

function Page() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const isOwner = profile?.role === "owner";
  const now = new Date();
  const month = now.getMonth() + 1, year = now.getFullYear();

  const { data: models = [], isLoading } = useQuery({
    queryKey: ["models"],
    queryFn: async () => (await supabase.from("models").select("*").order("name")).data ?? [],
  });
  const { data: revenue = [] } = useQuery({
    queryKey: ["revenue", year, month],
    queryFn: async () => (await supabase.from("revenue").select("*").eq("year", year).eq("month", month)).data ?? [],
  });
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => (await supabase.from("tasks").select("*")).data ?? [],
  });
  const { data: blocks = [] } = useQuery({
    queryKey: ["model_brain_blocks"],
    queryFn: async () => (await supabase.from("model_brain_blocks").select("*").order("position")).data ?? [],
  });

  const updateBlock = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("model_brain_blocks").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model_brain_blocks"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const addBlock = useMutation({
    mutationFn: async (model_id: string) => {
      const max = Math.max(0, ...blocks.filter((b: any) => b.model_id === model_id).map((b: any) => b.position ?? 0));
      const { error } = await supabase.from("model_brain_blocks").insert({
        model_id, position: max + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model_brain_blocks"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      // also remove from connections of other blocks
      const referencing = blocks.filter((b: any) => (b.connections ?? []).includes(id));
      for (const b of referencing) {
        await supabase.from("model_brain_blocks").update({
          connections: (b.connections ?? []).filter((c: string) => c !== id),
        }).eq("id", b.id);
      }
      const { error } = await supabase.from("model_brain_blocks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["model_brain_blocks"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  async function handleConnectTarget(targetId: string) {
    if (!connectingId || connectingId === targetId) { setConnectingId(null); return; }
    const a = blocks.find((b: any) => b.id === connectingId);
    const b = blocks.find((x: any) => x.id === targetId);
    if (!a || !b) return setConnectingId(null);
    const aConns: string[] = a.connections ?? [];
    const bConns: string[] = b.connections ?? [];
    if (!aConns.includes(targetId)) {
      await supabase.from("model_brain_blocks").update({ connections: [...aConns, targetId] }).eq("id", a.id);
    }
    if (!bConns.includes(connectingId)) {
      await supabase.from("model_brain_blocks").update({ connections: [...bConns, connectingId] }).eq("id", b.id);
    }
    qc.invalidateQueries({ queryKey: ["model_brain_blocks"] });
    setConnectingId(null);
    toast.success("Связано");
  }

  async function removeConnection(blockId: string, otherId: string) {
    const a = blocks.find((b: any) => b.id === blockId);
    const b = blocks.find((x: any) => x.id === otherId);
    if (a) await supabase.from("model_brain_blocks").update({ connections: (a.connections ?? []).filter((c: string) => c !== otherId) }).eq("id", a.id);
    if (b) await supabase.from("model_brain_blocks").update({ connections: (b.connections ?? []).filter((c: string) => c !== blockId) }).eq("id", b.id);
    qc.invalidateQueries({ queryKey: ["model_brain_blocks"] });
  }

  async function handleDrop(targetBlock: any) {
    if (!draggingId || draggingId === targetBlock.id) { setDraggingId(null); return; }
    const src = blocks.find((b: any) => b.id === draggingId);
    if (!src || src.model_id !== targetBlock.model_id) { setDraggingId(null); return; }
    const list = blocks.filter((b: any) => b.model_id === targetBlock.model_id).sort((a: any, b: any) => a.position - b.position);
    const reordered = list.filter((b: any) => b.id !== draggingId);
    const targetIdx = reordered.findIndex((b: any) => b.id === targetBlock.id);
    reordered.splice(targetIdx, 0, src);
    await Promise.all(reordered.map((b: any, i: number) =>
      supabase.from("model_brain_blocks").update({ position: i + 1 }).eq("id", b.id)
    ));
    qc.invalidateQueries({ queryKey: ["model_brain_blocks"] });
    setDraggingId(null);
  }

  if (isLoading) return <div className="p-8 text-text2">Загрузка...</div>;

  const blockById = (id: string) => blocks.find((b: any) => b.id === id);
  const modelById = (id: string) => models.find((m: any) => m.id === id);

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <PageHeader title="Second Brain" />
      {connectingId && (
        <div className="mb-4 rounded-md border border-teal/40 bg-teal/10 px-3 py-2 text-sm flex items-center justify-between">
          <span>Выберите блок для связи…</span>
          <button onClick={() => setConnectingId(null)} className="text-text2 hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-4">
        {models.map((m: any) => {
          const r = revenue.find((x: any) => x.model_id === m.id);
          const gross = Number(r?.gross_amount ?? 0);
          const cut = r?.agency_cut_override ?? m.agency_cut ?? 0;
          const net = gross * cut / 100;
          const activeTasks = tasks.filter((t: any) => t.model_id === m.id && t.status !== "done").length;
          const modelBlocks = blocks.filter((b: any) => b.model_id === m.id).sort((a: any, b: any) => a.position - b.position);
          return (
            <div key={m.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{m.name}</h3>
                  <PlatformBadge platform={m.platform} />
                </div>
                <PriorityBadge priority={m.priority} />
              </div>
              <div className="flex items-center justify-between text-sm text-text2 mb-4 pb-3 border-b border-border">
                <span>Net месяц: <span className="text-foreground font-medium">{fmt(net)}</span></span>
                <span>Задач: <span className="text-foreground">{activeTasks}</span></span>
              </div>

              <div className="space-y-2">
                {modelBlocks.map((b: any) => (
                  <BlockCard
                    key={b.id}
                    block={b}
                    canEdit={isOwner}
                    isConnectingSource={connectingId === b.id}
                    isConnectTarget={!!connectingId && connectingId !== b.id}
                    onTitleChange={(v: string) => updateBlock.mutate({ id: b.id, patch: { title: v } })}
                    onContentChange={(v: string) => updateBlock.mutate({ id: b.id, patch: { content: v } })}
                    onColorChange={(c: string) => updateBlock.mutate({ id: b.id, patch: { color: c } })}

                    onDelete={() => { if (confirm("Удалить блок?")) deleteBlock.mutate(b.id); }}
                    onStartConnect={() => setConnectingId(b.id)}
                    onConnectTarget={() => handleConnectTarget(b.id)}
                    connections={(b.connections ?? []).map((cid: string) => {
                      const cb = blockById(cid);
                      if (!cb) return null;
                      return { id: cid, title: cb.title, modelName: modelById(cb.model_id)?.name ?? "—" };
                    }).filter(Boolean)}
                    onRemoveConnection={(otherId: string) => removeConnection(b.id, otherId)}
                    draggable={isOwner}
                    onDragStart={() => setDraggingId(b.id)}
                    onDragOver={(e: any) => e.preventDefault()}
                    onDrop={() => handleDrop(b)}
                  />
                ))}
                {modelBlocks.length === 0 && (
                  <p className="text-xs text-text3 py-2">Нет блоков</p>
                )}
                {isOwner && (
                  <button onClick={() => addBlock.mutate(m.id)}
                    className="w-full text-xs text-teal flex items-center justify-center gap-1 py-2 border border-dashed border-border rounded-md hover:bg-bg3">
                    <Plus className="h-3 w-3" /> Добавить блок
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {models.length === 0 && <Empty message="Нет моделей" />}
    </div>
  );
}

function BlockCard({
  block, canEdit, isConnectingSource, isConnectTarget,
  onTitleChange, onContentChange, onColorChange, onDelete,
  onStartConnect, onConnectTarget, connections, onRemoveConnection,
  draggable, onDragStart, onDragOver, onDrop,
}: any) {
  const [title, setTitle] = useState(block.title);
  const [content, setContent] = useState(block.content);
  const [showColors, setShowColors] = useState(false);
  const accent = BLOCK_COLORS[block.color] ?? BLOCK_COLORS.teal;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onClick={() => { if (isConnectTarget) onConnectTarget(); }}
      className={`rounded-md bg-bg2 p-3 border border-border relative ${isConnectingSource ? "ring-2 ring-teal" : ""} ${isConnectTarget ? "cursor-pointer hover:ring-2 hover:ring-teal/50" : ""}`}
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-center gap-2 mb-2">
        {draggable && <GripVertical className="h-3.5 w-3.5 text-text3 cursor-grab" />}
        <input
          value={title}
          disabled={!canEdit}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => title !== block.title && onTitleChange(title)}
          className="flex-1 bg-transparent text-sm font-medium outline-none focus:bg-bg3 rounded px-1"
        />
        {canEdit && (
          <div className="flex items-center gap-1 relative">
            <button onClick={(e) => { e.stopPropagation(); setShowColors((s) => !s); }}
              className="h-4 w-4 rounded-full border border-border" style={{ background: accent }} />
            {showColors && (
              <div className="absolute right-0 top-6 z-10 flex gap-1 p-1.5 rounded-md bg-card border border-border shadow-lg">
                {COLOR_KEYS.map((c) => (
                  <button key={c} onClick={(e) => { e.stopPropagation(); onColorChange(c); setShowColors(false); }}
                    className="h-4 w-4 rounded-full border border-border" style={{ background: BLOCK_COLORS[c] }} />
                ))}
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); onStartConnect(); }}
              className="text-text3 hover:text-teal" title="Связать">
              <Link2 className="h-3.5 w-3.5" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="text-text3 hover:text-red">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
      <textarea
        value={content}
        disabled={!canEdit}
        onChange={(e) => setContent(e.target.value)}
        onBlur={() => content !== block.content && onContentChange(content)}
        placeholder="Содержание..."
        rows={2}
        className="w-full bg-transparent text-sm text-text2 outline-none focus:bg-bg3 rounded px-1 py-1 resize-none"
      />
      {connections.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border text-[11px] text-text3">
          Связано с:
          <div className="mt-1 flex flex-wrap gap-1">
            {connections.map((c: any) => (
              <span key={c.id} className="inline-flex items-center gap-1 bg-bg3 border border-border rounded px-1.5 py-0.5">
                {c.title} <span className="text-text3/70">({c.modelName})</span>
                {canEdit && (
                  <button onClick={(e) => { e.stopPropagation(); onRemoveConnection(c.id); }} className="text-text3 hover:text-red">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

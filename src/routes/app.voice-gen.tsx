import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Download, Sparkles, Lock } from "lucide-react";
import { PageHeader } from "@/components/ui-shared";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/auth";

export const Route = createFileRoute("/app/voice-gen")({
  ssr: false,
  component: Page,
});

type Voice = { voice_id: string; name: string; category?: string; preview_url?: string };

const MODELS = [
  { value: "eleven_flash_v2_5",        label: "Flash v2.5 (Fastest)" },
  { value: "eleven_multilingual_v2",   label: "Multilingual v2 (Best quality)" },
  { value: "eleven_turbo_v2_5",        label: "Turbo v2.5 (Fast + quality)" },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ??
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string);
const FN_URL = `${SUPABASE_URL}/functions/v1/generate-voice`;

function startOfTodayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function Page() {
  const { data: profile } = useProfile();
  const userId = profile?.id;
  const qc = useQueryClient();

  const isAdmin = profile?.role === "owner" || profile?.role === "production";

  const permQuery = useQuery({
    enabled: !!userId,
    queryKey: ["voice_permissions", userId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("voice_permissions")
        .select("can_generate_voice, daily_limit, char_limit")
        .eq("user_id", userId)
        .maybeSingle();
      return (data ?? null) as
        | { can_generate_voice: boolean; daily_limit: number; char_limit: number }
        | null;
    },
  });

  const todayQuery = useQuery({
    enabled: !!userId,
    queryKey: ["voice_gen_today", userId],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("voice_generation_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfTodayISO());
      return count ?? 0;
    },
  });

  const canUse = isAdmin || !!permQuery.data?.can_generate_voice;
  const dailyLimit = isAdmin ? 9999 : (permQuery.data?.daily_limit ?? 0);
  const charLimit = isAdmin ? 5000 : (permQuery.data?.char_limit ?? 500);

  const todayQuery = useQuery({
    enabled: !!userId,
    queryKey: ["voice_gen_today", userId],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("voice_generation_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", startOfTodayISO());
      return count ?? 0;
    },
  });

  const canUse = !!permQuery.data?.can_generate_voice;
  const dailyLimit = permQuery.data?.daily_limit ?? 0;
  const charLimit = permQuery.data?.char_limit ?? 500;
  const usedToday = todayQuery.data ?? 0;
  const remaining = Math.max(0, dailyLimit - usedToday);

  const [text, setText] = useState("");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [modelId, setModelId] = useState(MODELS[0].value);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!canUse) { setLoadingVoices(false); return; }
    (async () => {
      try {
        const res = await fetch(`${FN_URL}?action=list-voices`, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Не удалось загрузить голоса");
        const list: Voice[] = data?.voices ?? [];
        setVoices(list);
        if (list.length && !voiceId) setVoiceId(list[0].voice_id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Ошибка загрузки голосов");
      } finally {
        setLoadingVoices(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUse]);

  useEffect(() => () => { if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current); }, []);

  const charCount = text.length;
  const overLimit = charCount > charLimit;
  const canGenerate =
    canUse && text.trim().length > 0 && !!voiceId && !generating && remaining > 0 && !overLimit;

  const groupedVoices = useMemo(() => {
    const groups = new Map<string, Voice[]>();
    for (const v of voices) {
      const key = v.category || "other";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(v);
    }
    return Array.from(groups.entries());
  }, [voices]);

  async function generate() {
    if (!canGenerate || !userId) return;
    setGenerating(true);
    try {
      const res = await fetch(`${FN_URL}?action=generate`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ text: text.trim(), voice_id: voiceId, model_id: modelId }),
      });
      if (!res.ok) {
        let msg = "Ошибка генерации";
        try { const j = await res.json(); msg = j?.error || j?.details || msg; } catch { /* noop */ }
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
      lastUrlRef.current = url;
      setAudioUrl(url);

      await (supabase as any).from("voice_generation_log").insert({
        user_id: userId,
        voice_id: voiceId,
        model_id: modelId,
        text_length: text.trim().length,
      });
      qc.invalidateQueries({ queryKey: ["voice_gen_today", userId] });
      toast.success("Готово");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка генерации");
    } finally {
      setGenerating(false);
    }
  }

  function download() {
    if (!audioUrl) return;
    const a = document.createElement("a");
    a.href = audioUrl;
    a.download = `voice-${Date.now()}.mp3`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  if (permQuery.isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader title="Голосові повідомлення" />
        <div className="rounded-lg border border-border bg-card p-8 text-center text-text2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Загрузка…
        </div>
      </div>
    );
  }

  if (!canUse) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader title="Голосові повідомлення" />
        <div className="rounded-lg border border-border bg-card p-8 text-center space-y-3">
          <Lock className="h-8 w-8 mx-auto text-text3" />
          <p className="text-sm text-text2">
            You don't have access to voice generation. Contact your admin.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="Голосові повідомлення"
        action={
          <span className="text-xs text-text2 px-2 py-1 rounded bg-bg3 border border-border">
            {remaining}/{dailyLimit} generations remaining today
          </span>
        }
      />

      <div className="rounded-lg border border-border bg-card p-5 space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-wide text-text2 mb-2">Текст</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, charLimit))}
            maxLength={charLimit}
            rows={6}
            placeholder="Введите текст сообщения…"
            className="w-full rounded-md bg-bg2 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#C8A566] resize-y"
          />
          <div className="mt-1 text-right text-[11px] text-text3">
            {charCount}/{charLimit}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs uppercase tracking-wide text-text2 mb-2">Голос</label>
            <select
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
              disabled={loadingVoices}
              className="w-full rounded-md bg-bg2 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#C8A566]"
            >
              {loadingVoices && <option>Загрузка…</option>}
              {!loadingVoices && voices.length === 0 && <option value="">Нет голосов</option>}
              {groupedVoices.map(([cat, vs]) => (
                <optgroup key={cat} label={cat}>
                  {vs.map((v) => (
                    <option key={v.voice_id} value={v.voice_id}>{v.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wide text-text2 mb-2">Модель</label>
            <select
              value={modelId}
              onChange={(e) => setModelId(e.target.value)}
              className="w-full rounded-md bg-bg2 border border-border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#C8A566]"
            >
              {MODELS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={generate}
          disabled={!canGenerate}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium bg-[#C8A566] text-black hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating
            ? "Генерация…"
            : remaining === 0
              ? "Дневной лимит исчерпан"
              : "Сгенерировать"}
        </button>

        {audioUrl && (
          <div className="pt-2 border-t border-border space-y-3">
            <audio controls src={audioUrl} className="w-full" />
            <button
              onClick={download}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-bg3 border border-border hover:bg-bg2 transition"
            >
              <Download className="h-4 w-4" />
              Скачать MP3
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

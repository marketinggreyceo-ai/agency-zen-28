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
type Generation = {
  id: string;
  voice_id: string;
  voice_name: string | null;
  model_id: string | null;
  text: string;
  audio_file_path: string | null;
  created_at: string;
};

const MODELS = [
  { value: "eleven_flash_v2_5",        label: "Flash v2.5 (Fastest)" },
  { value: "eleven_multilingual_v2",   label: "Multilingual v2 (Best quality)" },
  { value: "eleven_turbo_v2_5",        label: "Turbo v2.5 (Fast + quality)" },
];

const CHAR_LIMIT_MAX = 500;

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

  const historyQuery = useQuery({
    enabled: !!userId,
    queryKey: ["voice_generations", userId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("voice_generations")
        .select("id, voice_id, voice_name, model_id, text, audio_file_path, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as Generation[];
    },
  });

  const canUse = isAdmin || !!permQuery.data?.can_generate_voice;
  const dailyLimit = isAdmin ? 9999 : (permQuery.data?.daily_limit ?? 0);
  const charLimit = Math.min(
    CHAR_LIMIT_MAX,
    isAdmin ? CHAR_LIMIT_MAX : (permQuery.data?.char_limit ?? CHAR_LIMIT_MAX),
  );

  const usedToday = todayQuery.data ?? 0;
  const remaining = Math.max(0, dailyLimit - usedToday);

  const [text, setText] = useState("");
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [modelId, setModelId] = useState(MODELS[0].value);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [speed, setSpeed] = useState(1.0);
  const [stability, setStability] = useState(0.5);
  const [similarity, setSimilarity] = useState(0.75);
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!canUse) { setLoadingVoices(false); return; }
    (async () => {
      try {
        console.log("[voice-gen] fetching voices from", FN_URL);
        const res = await fetch(`${FN_URL}?action=list-voices`, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });
        const data = await res.json();
        console.log("[voice-gen] list-voices response", res.status, data);
        if (!res.ok) throw new Error(data?.error ? `${data.error}${data.details ? ": " + data.details : ""}` : "Не удалось загрузить голоса");
        const list: Voice[] = data?.voices ?? [];
        setVoices(list);
        if (list.length && !voiceId) setVoiceId(list[0].voice_id);
      } catch (e) {
        console.error("[voice-gen] list-voices failed", e);
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
        body: JSON.stringify({
          text: text.trim(),
          voice_id: voiceId,
          model_id: modelId,
          speed,
          stability,
          similarity_boost: similarity,
        }),
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

      // Upload to storage
      const filePath = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp3`;
      let storedPath: string | null = null;
      const { error: upErr } = await supabase
        .storage
        .from("voice-messages")
        .upload(filePath, blob, { contentType: "audio/mpeg", upsert: false });
      if (upErr) {
        console.error("[voice-gen] upload failed", upErr);
      } else {
        storedPath = filePath;
      }

      const voiceName = voices.find((v) => v.voice_id === voiceId)?.name ?? null;

      await (supabase as any).from("voice_generation_log").insert({
        user_id: userId,
        voice_id: voiceId,
        model_id: modelId,
        text_length: text.trim().length,
      });

      await (supabase as any).from("voice_generations").insert({
        user_id: userId,
        voice_id: voiceId,
        voice_name: voiceName,
        model_id: modelId,
        text: text.trim(),
        audio_file_path: storedPath,
      });

      qc.invalidateQueries({ queryKey: ["voice_gen_today", userId] });
      qc.invalidateQueries({ queryKey: ["voice_generations", userId] });
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

  async function downloadFromStorage(path: string | null) {
    if (!path) { toast.error("Файл недоступен"); return; }
    try {
      const { data, error } = await supabase.storage.from("voice-messages").createSignedUrl(path, 60);
      if (error || !data?.signedUrl) throw error || new Error("Не удалось получить ссылку");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = path.split("/").pop() || "voice.mp3";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка скачивания");
    }
  }

  if (permQuery.isLoading) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader title="Голосовые сообщения" />
        <div className="rounded-lg border border-border bg-card p-8 text-center text-text2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Загрузка…
        </div>
      </div>
    );
  }

  if (!canUse) {
    return (
      <div className="max-w-2xl mx-auto">
        <PageHeader title="Голосовые сообщения" />
        <div className="rounded-lg border border-border bg-card p-8 text-center space-y-3">
          <Lock className="h-8 w-8 mx-auto text-text3" />
          <p className="text-sm text-text2">
            У вас нет доступа к генерации голосовых сообщений. Обратитесь к администратору.
          </p>
        </div>
      </div>
    );
  }

  const history = historyQuery.data ?? [];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Голосовые сообщения"
        action={
          <span className="text-xs text-text2 px-2 py-1 rounded bg-bg3 border border-border">
            {isAdmin ? "Без ограничений" : `Осталось сегодня: ${remaining}/${dailyLimit}`}
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

      {/* History */}
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text2 mb-3">
          История генераций
        </h2>
        {historyQuery.isLoading ? (
          <div className="text-sm text-text3 py-4 text-center">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Загрузка…
          </div>
        ) : history.length === 0 ? (
          <div className="text-sm text-text3 py-4 text-center">Пока нет генераций</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-text2">
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2">Дата</th>
                  <th className="text-left px-2 py-2">Голос</th>
                  <th className="text-left px-2 py-2">Модель</th>
                  <th className="text-left px-2 py-2">Текст</th>
                  <th className="text-right px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {history.map((g) => {
                  const preview = g.text.length > 50 ? g.text.slice(0, 50) + "…" : g.text;
                  const date = new Date(g.created_at).toLocaleString("ru-RU", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  });
                  return (
                    <tr key={g.id} className="border-b border-border/50">
                      <td className="px-2 py-2 whitespace-nowrap text-text2">{date}</td>
                      <td className="px-2 py-2 whitespace-nowrap">{g.voice_name || g.voice_id.slice(0, 8)}</td>
                      <td className="px-2 py-2 whitespace-nowrap text-text2">{g.model_id || "—"}</td>
                      <td className="px-2 py-2">{preview}</td>
                      <td className="px-2 py-2 text-right">
                        <button
                          onClick={() => downloadFromStorage(g.audio_file_path)}
                          disabled={!g.audio_file_path}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs bg-bg3 border border-border hover:bg-bg2 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Скачать
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

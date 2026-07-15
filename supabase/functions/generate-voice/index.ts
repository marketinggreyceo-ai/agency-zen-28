// ElevenLabs TTS proxy: list voices + generate audio.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json", ...extra },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "ELEVENLABS_API_KEY is not configured" }, 500);
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "list-voices") {
      const res = await fetch("https://api.elevenlabs.io/v1/voices", {
        method: "GET",
        headers: { "xi-api-key": apiKey },
      });
      if (!res.ok) {
        const errText = await res.text();
        return jsonResponse({ error: "ElevenLabs error", details: errText }, res.status);
      }
      const data = await res.json();
      const voices = (data?.voices ?? []).map((v: any) => ({
        voice_id: v.voice_id,
        name: v.name,
        category: v.category,
        preview_url: v.preview_url,
      }));
      return jsonResponse({ voices });
    }

    if (action === "generate") {
      if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
      }
      let body: any = {};
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Invalid JSON body" }, 400);
      }
      const text: string | undefined = body?.text;
      const voice_id: string | undefined = body?.voice_id;
      const model_id: string = body?.model_id ?? "eleven_flash_v2_5";
      if (!text || !voice_id) {
        return jsonResponse({ error: "text and voice_id are required" }, 400);
      }

      const res = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice_id)}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "content-type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text,
            model_id,
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        return jsonResponse({ error: "ElevenLabs error", details: errText }, res.status);
      }

      const audio = await res.arrayBuffer();
      return new Response(audio, {
        status: 200,
        headers: {
          ...corsHeaders,
          "content-type": "audio/mpeg",
          "cache-control": "no-store",
        },
      });
    }

    return jsonResponse({ error: "Unknown action. Use ?action=list-voices or ?action=generate" }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: "Unexpected error", details: msg }, 500);
  }
});

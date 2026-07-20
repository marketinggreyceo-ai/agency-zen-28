// Telegram webhook receiver — runs on Supabase Edge Functions (Deno)
// Public endpoint, verify_jwt = false. Telegram POSTs updates here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const APP_URL = Deno.env.get("APP_URL") || "https://greymedia.company/app";

function normalize(value: string | null | undefined) {
  return (value ?? "").trim().replace(/^@/, "").toLocaleLowerCase("ru-RU");
}

function normalizeSearch(value: string | null | undefined) {
  return normalize(value)
    .replace(/дж/g, "j")
    .replace(/ей/g, "ey")
    .replace(/[а-яё]/g, (char) => ({
      а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
      й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
      у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ы: "y", э: "e", ю: "yu", я: "ya",
      ь: "", ъ: "",
    } as Record<string, string>)[char] ?? char)
    .replace(/[^a-z0-9а-яё]+/gi, "");
}

function extractMention(msg: any): string | null {
  const text: string = msg?.text ?? msg?.caption ?? "";
  const entities: any[] = msg?.entities ?? msg?.caption_entities ?? [];
  for (const entity of entities) {
    if (entity.type === "mention") {
      const mentionText = text.slice(entity.offset, entity.offset + entity.length);
      const username = mentionText.replace(/^@/, "");
      if (username) return username;
    }
    if (entity.type === "text_mention" && entity.user?.username) return entity.user.username;
  }
  const match = text.match(/@([\p{L}\p{N}_]+)/u);
  if (match) return match[1];
  return null;
}

function parseTaskMessage(msg: any): { title: string; mention: string | null } | null {
  const text: string = msg?.text ?? msg?.caption ?? "";
  if (!/#задача/i.test(text)) return null;
  const mention = extractMention(msg);
  let title = text
    .replace(/#задача\b/gi, "")
    .replace(mention ? new RegExp(`@${mention}`, "gi") : /(?!x)x/, "")
    .split("\n")
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0 && !l.match(/^@[\p{L}\p{N}_]+$/u))
    .join(" ")
    .trim();
  if (!title) title = "Задача из Telegram";
  return { title, mention };
}

// Labeled-line parser for #кастом messages.
// Supports Russian and English labels on the same line, and multi-line values
// for the fan description (until next label or end).
type CustomFields = {
  customer_nickname: string;
  price: number | null;
  duration: string | null;
  description: string | null;
  fan_description: string | null;
  costume: string | null;
  modelToken: string | null;
};

const LABELS: Array<{ key: keyof CustomFields; re: RegExp; multiline?: boolean }> = [
  { key: "customer_nickname", re: /^\s*(?:фан|fan(?:\s*name)?)\s*[:\-]\s*(.+)$/i },
  { key: "price",             re: /^\s*(?:цена|agreed\s*price|price)\s*[:\-]\s*(.+)$/i },
  { key: "duration",          re: /^\s*(?:длительность|duration|длина)\s*[:\-]\s*(.+)$/i },
  { key: "description",       re: /^\s*(?:описание|description)\s*[:\-]\s*(.+)$/i, multiline: true },
  { key: "fan_description",   re: /^\s*(?:от\s*фана|description\s*by\s*fan|fan\s*description)\s*[:\-]\s*(.*)$/i, multiline: true },
  { key: "costume",           re: /^\s*(?:костюм|costume|outfit)\s*[:\-]\s*(.+)$/i },
];

function parseCustomMessage(text: string): CustomFields {
  const mentionMatch = text.match(/@([\p{L}\p{N}_.-]+)/u);
  const modelToken = mentionMatch ? mentionMatch[1] : null;

  const out: CustomFields = {
    customer_nickname: "",
    price: null,
    duration: null,
    description: null,
    fan_description: null,
    costume: null,
    modelToken,
  };

  const lines = text.split(/\r?\n/);
  let currentMultiKey: keyof CustomFields | null = null;
  const buffers: Partial<Record<keyof CustomFields, string[]>> = {};

  for (const raw of lines) {
    const line = raw ?? "";
    let matched = false;
    for (const lab of LABELS) {
      const m = line.match(lab.re);
      if (m) {
        const val = (m[1] ?? "").trim();
        buffers[lab.key] = val ? [val] : [];
        currentMultiKey = lab.multiline ? lab.key : null;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (currentMultiKey) {
      const trimmed = line.trim();
      if (!trimmed) { currentMultiKey = null; continue; }
      (buffers[currentMultiKey] ||= []).push(trimmed);
    }
  }

  const get = (k: keyof CustomFields) => (buffers[k]?.join("\n").trim() || null);
  out.customer_nickname = get("customer_nickname") ?? "";
  out.duration = get("duration");
  out.description = get("description");
  out.fan_description = get("fan_description");
  out.costume = get("costume");
  const priceRaw = get("price");
  if (priceRaw) {
    const clean = priceRaw.replace(/\$/g, "").replace(/\s/g, "").replace(/,/g, ".");
    const n = Number(clean.match(/-?\d+(\.\d+)?/)?.[0]);
    out.price = Number.isFinite(n) ? n : null;
  } else {
    const priceMatch = text.match(/\$\s*([0-9][0-9.,]*)/);
    if (priceMatch) {
      const n = Number(priceMatch[1].replace(/,/g, ""));
      out.price = Number.isFinite(n) ? n : null;
    }
  }

  // Fallbacks (keep prior behavior when labels are absent)
  if (!out.description) {
    let desc = text.replace(/#кастом/gi, "");
    if (mentionMatch) desc = desc.replace(mentionMatch[0], "");
    // Strip out any labeled lines so we don't dump the whole message
    desc = desc.split(/\r?\n/).filter((l) => !LABELS.some((lab) => lab.re.test(l))).join("\n");
    desc = desc.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
    if (desc) out.description = desc;
  }
  if (!out.customer_nickname) {
    const fanMatch = text.match(/fan\s*name\s*:\s*([^\n\r]+)/i);
    if (fanMatch) out.customer_nickname = fanMatch[1].trim();
  }

  return out;
}

async function findModel(text: string, explicitToken?: string | null) {
  const { data: models } = await admin
    .from("models")
    .select("id, name, english_name")
    .eq("is_archived", false);
  const list = (models ?? []) as Array<{ id: string; name: string; english_name: string | null }>;
  const nameVariants = (m: { name: string; english_name: string | null }) =>
    [m.name, m.english_name].filter(Boolean).map((s) => String(s).trim()) as string[];

  if (explicitToken) {
    const key = normalize(explicitToken);
    const keyN = normalizeSearch(explicitToken);
    const exact = list.find((m) => nameVariants(m).some((v) =>
      normalize(v) === key || normalizeSearch(v) === keyN
    ));
    if (exact) return exact;
    const partial = list.find((m) => nameVariants(m).some((v) => {
      const n = normalize(v);
      const ns = normalizeSearch(v);
      return (n && (n.includes(key) || key.includes(n))) ||
        (ns && (ns.includes(keyN) || keyN.includes(ns)));
    }));
    if (partial) return partial;
  }

  const haystack = text.toLocaleLowerCase("ru-RU");
  const normalizedHaystack = normalizeSearch(text);
  return list
    .slice()
    .sort((a, b) => {
      const al = Math.max(...nameVariants(a).map((v) => v.length));
      const bl = Math.max(...nameVariants(b).map((v) => v.length));
      return bl - al;
    })
    .find((m) => nameVariants(m).some((v) => {
      const lower = v.toLocaleLowerCase("ru-RU");
      return haystack.includes(lower) || normalizedHaystack.includes(normalizeSearch(v));
    })) ?? null;
}

async function resolveAssignee(mention: string | null): Promise<string> {
  if (!mention) return "Я";
  const key = normalize(mention);
  const { data: profiles } = await admin.from("profiles").select("full_name, telegram_handle");
  const profMatch = (profiles ?? []).find((p: any) => normalize(p.telegram_handle) === key);
  if (profMatch?.full_name) return profMatch.full_name;
  const { data: members } = await admin.from("team_members")
    .select("name, assignee_name, telegram_handle").eq("is_archived", false);
  const tgExact = (members ?? []).find((m: any) => normalize(m.telegram_handle) === key);
  if (tgExact) return tgExact.assignee_name || tgExact.name || mention;
  const asgPartial = (members ?? []).find((m: any) => {
    const n = normalize(m.assignee_name);
    return n && (n.includes(key) || key.includes(n));
  });
  if (asgPartial) return asgPartial.assignee_name || asgPartial.name || mention;
  const namePartial = (members ?? []).find((m: any) => {
    const n = normalize(m.name);
    return n && (n.includes(key) || key.includes(n));
  });
  if (namePartial) return namePartial.assignee_name || namePartial.name || mention;
  return `@${mention}`;
}

async function resolveChatter(senderUsername: string | null, fallback: string) {
  if (!senderUsername) return fallback;
  const key = normalize(senderUsername);
  const { data: profiles } = await admin.from("profiles").select("full_name, telegram_handle");
  const p = (profiles ?? []).find((x: any) => normalize(x.telegram_handle) === key);
  if (p?.full_name) return p.full_name;
  const { data: members } = await admin.from("team_members")
    .select("name, assignee_name, telegram_handle").eq("is_archived", false);
  const m = (members ?? []).find((x: any) => normalize(x.telegram_handle) === key);
  return m?.assignee_name || m?.name || fallback;
}

async function writeLog(entry: {
  chat_id?: string | null;
  message_text?: string | null;
  parsed_action: string;
  success: boolean;
  error_message?: string | null;
}) {
  await admin.from("telegram_logs").insert({
    chat_id: entry.chat_id ?? null,
    message_text: entry.message_text ?? null,
    parsed_action: entry.parsed_action,
    success: entry.success,
    error_message: entry.error_message ?? null,
  });
}

async function sendMessage(token: string, chatId: string | number, text: string) {
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (_) { /* ignore */ }
}

// Pick largest photo size's file_id
function extractPhotoFileId(msg: any): string | null {
  const photos = msg?.photo;
  if (!Array.isArray(photos) || photos.length === 0) return null;
  const biggest = photos.reduce((a: any, b: any) =>
    ((a?.file_size ?? a?.width ?? 0) >= (b?.file_size ?? b?.width ?? 0) ? a : b));
  return biggest?.file_id ?? null;
}

// ============== #продажи parsing ==============
function bratislavaParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bratislava",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false,
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), day: get("day"), hour: get("hour") };
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

function fallbackSaleDate(now: Date): { iso: string; label: string } {
  const b = bratislavaParts(now);
  let y = b.y, m = b.m, day = b.day;
  if (b.hour < 8) {
    const d = new Date(Date.UTC(y, m - 1, day));
    d.setUTCDate(d.getUTCDate() - 1);
    y = d.getUTCFullYear(); m = d.getUTCMonth() + 1; day = d.getUTCDate();
  }
  return { iso: `${y}-${pad2(m)}-${pad2(day)}`, label: `${pad2(day)}.${pad2(m)}` };
}

function stripDecor(s: string): string {
  return s
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}\p{So}\p{Sk}]/gu, "")
    .replace(/[«»""''`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAmount(raw: string): number | null {
  const clean = raw.replace(/\$/g, "").replace(/\s/g, "").replace(/,/g, ".");
  const m = clean.match(/-?\d+(\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

type SalesBlock = {
  rawName: string;
  name: string;
  headerAmount: number | null;
  buyers: Array<{ line: string; amount: number | null }>;
};

type ParsedSales = {
  dateLabel: string | null;   // "DD.MM" if explicit
  dateIso: string | null;     // "YYYY-MM-DD" if explicit
  blocks: SalesBlock[];
};

function parseSalesMessage(text: string, defaultYear: number): ParsedSales {
  const out: ParsedSales = { dateLabel: null, dateIso: null, blocks: [] };
  const lines = text.split(/\r?\n/);
  let current: SalesBlock | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { continue; }
    // separator lines
    if (/^[—\-–_=]{2,}$/.test(line)) continue;
    // skip the tag itself
    if (/^#продажи\b/i.test(line)) continue;
    // date line
    const dateMatch = line.match(/^\s*(?:дата|date)\s*[:\-]\s*(\d{1,2})[.\/](\d{1,2})(?:[.\/](\d{2,4}))?\s*$/i);
    if (dateMatch) {
      const dd = Number(dateMatch[1]);
      const mm = Number(dateMatch[2]);
      let yy = dateMatch[3] ? Number(dateMatch[3]) : defaultYear;
      if (yy < 100) yy += 2000;
      out.dateLabel = `${pad2(dd)}.${pad2(mm)}`;
      out.dateIso = `${yy}-${pad2(mm)}-${pad2(dd)}`;
      continue;
    }
    // total line — ignore
    if (/^\s*[^\wа-яё]*\s*(?:общий\s+заработок|итого|total)\b/i.test(line)) continue;

    // buyer line (starts with • or · or *)
    const buyerMatch = line.match(/^\s*[•·∙◦●▪■\*]\s*(.+?)\s*[—\-–]\s*(.+?)\s*$/);
    if (buyerMatch && current) {
      current.buyers.push({ line: line, amount: parseAmount(buyerMatch[2]) });
      continue;
    }

    // header line "{name} — {amount}"
    const headMatch = line.match(/^(?!\s*[•·∙◦●▪■\*])(.+?)\s*[—\-–]\s*(\$?\s*[\d][\d.,\s]*)\s*$/);
    if (headMatch) {
      const name = stripDecor(headMatch[1]);
      if (!name) continue;
      current = {
        rawName: headMatch[1].trim(),
        name,
        headerAmount: parseAmount(headMatch[2]),
        buyers: [],
      };
      out.blocks.push(current);
      continue;
    }
    // otherwise ignore
  }
  return out;
}

async function resolveChatterFromTelegram(username: string | null): Promise<{ chatter_id: string | null; profile_id: string | null; name: string | null }> {
  if (!username) return { chatter_id: null, profile_id: null, name: null };
  const key = normalize(username);

  // 1) team_members.telegram_handle
  const { data: members } = await admin.from("team_members")
    .select("id, name, assignee_name, profile_id, telegram_handle").eq("is_archived", false);
  const m = (members ?? []).find((x: any) => normalize(x.telegram_handle) === key);
  if (m) return { chatter_id: (m as any).id, profile_id: (m as any).profile_id ?? null, name: (m as any).assignee_name || (m as any).name || null };

  // 2) profiles.telegram_handle (Команда page stores handles here)
  const { data: profs } = await admin.from("profiles")
    .select("id, full_name, telegram_handle, status")
    .eq("status", "active");
  const pr = (profs ?? []).find((x: any) => normalize(x.telegram_handle) === key);
  if (pr) {
    // link back to team_members if a row references this profile
    const linked = (members ?? []).find((x: any) => (x as any).profile_id === (pr as any).id);
    return {
      chatter_id: linked ? (linked as any).id : null,
      profile_id: (pr as any).id,
      name: (pr as any).full_name ?? (linked as any)?.name ?? null,
    };
  }
  return { chatter_id: null, profile_id: null, name: null };
}

async function handleSalesMessage(msg: any, chatId: string | null, botToken: string | null, text: string) {
  const now = new Date();
  const bNow = bratislavaParts(now);
  const parsed = parseSalesMessage(text, bNow.y);

  const sender = msg.from?.username ?? null;
  const chatterInfo = await resolveChatterFromTelegram(sender);
  if (!chatterInfo.chatter_id && !chatterInfo.profile_id) {
    if (botToken && chatId) await sendMessage(botToken, chatId, `⚠️ Не нашёл чаттера по @${sender ?? "—"}. Проверь telegram_handle в команде.`);
    await writeLog({ chat_id: chatId, message_text: text, parsed_action: "sales_no_chatter", success: false, error_message: "no_chatter" });
    return;
  }

  // Determine sale_date
  let saleDateIso: string;
  let saleDateLabel: string;
  let missingDateNote = "";
  if (parsed.dateIso) {
    saleDateIso = parsed.dateIso;
    saleDateLabel = parsed.dateLabel!;
  } else {
    const fb = fallbackSaleDate(now);
    saleDateIso = fb.iso;
    saleDateLabel = fb.label;
    missingDateNote = `\n📅 Строки Дата не было, записал за ${saleDateLabel}`;
  }
  const y = Number(saleDateIso.slice(0, 4));
  const mo = Number(saleDateIso.slice(5, 7));
  const day = Number(saleDateIso.slice(8, 10));
  const period: "1-15" | "16-30" = day <= 15 ? "1-15" : "16-30";

  // Load accounts for this chatter
  const { data: accountsForChatter } = await admin
    .from("chatter_accounts")
    .select("id, account_name")
    .eq("chatter_id", chatterInfo.chatter_id);
  const accounts = (accountsForChatter ?? []) as Array<{ id: string; account_name: string }>;
  const findAccount = (name: string) => {
    const key = name.trim().toLocaleLowerCase();
    return accounts.find((a) => a.account_name.trim().toLocaleLowerCase() === key) ?? null;
  };

  const written: Array<{ name: string; amount: number }> = [];
  const warnings: string[] = [];
  let grand = 0;

  for (const block of parsed.blocks) {
    const acct = findAccount(block.name);
    if (!acct) {
      warnings.push(`⚠️ Не нашёл аккаунт ${block.name} — эти продажи НЕ записаны`);
      continue;
    }
    const buyerSum = block.buyers.reduce((s, b) => s + (b.amount ?? 0), 0);
    const hasBuyers = block.buyers.length > 0 && block.buyers.some((b) => b.amount != null);
    let amount = hasBuyers ? Math.round(buyerSum * 100) / 100 : (block.headerAmount ?? 0);
    if (hasBuyers && block.headerAmount != null && Math.abs(buyerSum - block.headerAmount) > 0.01) {
      warnings.push(`⚠️ В ${block.name}: сумма позиций $${buyerSum.toFixed(2)} не сходится с заголовком $${block.headerAmount.toFixed(2)}, записал $${buyerSum.toFixed(2)}`);
    }
    if (!(amount > 0)) continue;
    const notes = block.buyers.length ? block.buyers.map((b) => b.line).join("\n") : null;

    // Upsert on chatter_account_id + sale_date
    const { data: existing } = await admin
      .from("chatter_daily_sales")
      .select("id")
      .eq("chatter_account_id", acct.id)
      .eq("sale_date", saleDateIso)
      .maybeSingle();
    if (existing) {
      const { error } = await admin.from("chatter_daily_sales")
        .update({ amount, notes, chatter_id: chatterInfo.chatter_id, chatter_profile_id: chatterInfo.profile_id, month: mo, year: y, period })
        .eq("id", (existing as any).id);
      if (error) { warnings.push(`⚠️ Ошибка записи ${block.name}: ${error.message}`); continue; }
    } else {
      const { error } = await admin.from("chatter_daily_sales").insert({
        chatter_account_id: acct.id,
        chatter_id: chatterInfo.chatter_id,
        chatter_profile_id: chatterInfo.profile_id,
        sale_date: saleDateIso,
        amount,
        month: mo, year: y, period,
        notes,
      });
      if (error) { warnings.push(`⚠️ Ошибка записи ${block.name}: ${error.message}`); continue; }
    }
    written.push({ name: acct.account_name, amount });
    grand += amount;
  }

  const fmtAmt = (n: number) => `$${n.toFixed(2)}`;
  let reply: string;
  if (written.length === 0 && warnings.length === 0) {
    reply = `⚠️ Не нашёл ни одного блока продаж в сообщении.${missingDateNote}`;
  } else {
    const parts = written.map((w) => `${w.name} — ${fmtAmt(w.amount)}`).join(", ");
    reply = `✅ Записал продажи за ${saleDateLabel}: ${parts}. Итого: ${fmtAmt(grand)}${missingDateNote}`;
    if (warnings.length) reply += "\n\n" + warnings.join("\n");
  }
  if (botToken && chatId) await sendMessage(botToken, chatId, reply);
  await writeLog({ chat_id: chatId, message_text: text, parsed_action: "sales", success: true });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: true, info: "telegram webhook alive" }), {
      headers: { "content-type": "application/json" },
    });
  }

  let update: any = null;
  try { update = await req.json(); } catch { /* noop */ }
  if (!update) {
    await writeLog({ parsed_action: "invalid", success: false, error_message: "bad_json" });
    return new Response("bad", { status: 400 });
  }

  const msg = update.message ?? update.edited_message ?? update.channel_post;
  const text: string = msg?.text ?? msg?.caption ?? "";
  const chat = msg?.chat;
  const chatId = chat?.id ? String(chat.id) : null;
  const mediaGroupId: string | null = msg?.media_group_id ? String(msg.media_group_id) : null;
  const photoFileId = extractPhotoFileId(msg);

  console.log("[telegram-webhook] incoming", { chatId, text: text.slice(0, 100), update_id: update.update_id, mediaGroupId, hasPhoto: !!photoFileId });

  try {
    if (!chat) {
      await writeLog({ parsed_action: "ignored", success: true, message_text: text });
      return Response.json({ ok: true, ignored: true });
    }

    const chatTitle =
      chat.title ||
      [chat.first_name, chat.last_name].filter(Boolean).join(" ") ||
      chat.username || String(chat.id);

    await admin.from("telegram_chats").upsert(
      { chat_id: chatId, title: chatTitle, type: chat.type },
      { onConflict: "chat_id" },
    );

    const { data: settings } = await admin
      .from("telegram_settings")
      .select("auto_tasks_enabled, bot_token")
      .limit(1)
      .maybeSingle();
    const botToken: string | null = settings?.bot_token ?? null;

    // /start model_<uuid> deep-link
    const startMatch = text.match(/^\/start(?:@\w+)?\s+model_([0-9a-f-]{36})\b/i);
    if (startMatch && chat.type === "private") {
      const modelId = startMatch[1];
      const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRe.test(modelId)) {
        if (botToken) await sendMessage(botToken, chat.id, "❌ Некорректная ссылка. Попроси свою команду прислать новую.");
        await writeLog({ chat_id: chatId, message_text: text, parsed_action: "start_model_invalid", success: false, error_message: "bad_uuid" });
        return Response.json({ ok: true });
      }
      const { data: model } = await admin.from("models").select("id, name").eq("id", modelId).maybeSingle();
      if (!model) {
        if (botToken) await sendMessage(botToken, chat.id, "❌ Модель не найдена. Попроси свою команду прислать новую ссылку.");
        await writeLog({ chat_id: chatId, message_text: text, parsed_action: "start_model_unknown", success: false, error_message: "no_model" });
        return Response.json({ ok: true });
      }
      const { error: updErr } = await admin.from("models").update({ telegram_chat_id: chatId }).eq("id", modelId);
      if (updErr) throw updErr;
      if (botToken) await sendMessage(botToken, chat.id, `Привет, ${model.name}! Теперь я буду присылать тебе твои кастомы каждый день 🎬`);
      await writeLog({ chat_id: chatId, message_text: text, parsed_action: "start_model_connected", success: true });
      return Response.json({ ok: true, connected: model.name });
    }

    // === Private-chat handling for daily task DMs ===
    if (chat.type === "private" && msg.from?.id) {
      const fromId = Number(msg.from.id);
      const fromUsername = msg.from.username ?? null;

      // Auto-link telegram_user_id to profile / team_member by username or existing id
      const key = normalize(fromUsername);
      if (key) {
        const { data: profs } = await admin
          .from("profiles").select("id, telegram_user_id, telegram_handle")
          .not("telegram_handle", "is", null);
        const prof = (profs ?? []).find((p: any) => normalize(p.telegram_handle) === key);
        if (prof && (prof as any).telegram_user_id !== fromId) {
          await admin.from("profiles").update({ telegram_user_id: fromId }).eq("id", (prof as any).id);
        }
        const { data: members } = await admin
          .from("team_members").select("id, telegram_user_id, telegram_handle")
          .not("telegram_handle", "is", null);
        const tm = (members ?? []).find((m: any) => normalize(m.telegram_handle) === key);
        if (tm && (tm as any).telegram_user_id !== fromId) {
          await admin.from("team_members").update({ telegram_user_id: fromId }).eq("id", (tm as any).id);
        }
      }

      // Bare /start — activate bot for this user (team member or model)
      if (/^\/start(?:@\w+)?\s*$/i.test(text.trim())) {
        const { data: prof } = await admin
          .from("profiles").select("id").eq("telegram_user_id", fromId).maybeSingle();
        const { data: tm } = await admin
          .from("team_members").select("id").eq("telegram_user_id", fromId).maybeSingle();
        const { data: modelByChat } = await admin
          .from("models").select("id, name").eq("telegram_chat_id", chatId).maybeSingle();
        console.log("[telegram-webhook] /start", { fromId, chatId, hasProfile: !!prof, hasTeamMember: !!tm, hasModel: !!modelByChat });
        if (modelByChat) {
          if (botToken) await sendMessage(botToken, chat.id, "✅ Бот активирован! Вы будете получать уведомления о кастомах.");
          await writeLog({ chat_id: chatId, message_text: text, parsed_action: "start_model_activated", success: true });
        } else if (prof || tm) {
          if (botToken) await sendMessage(botToken, chat.id, "✅ Бот активирован! Вы будете получать ежедневные задачи.");
          await writeLog({ chat_id: chatId, message_text: text, parsed_action: "start_activated", success: true });
        } else {
          if (botToken) await sendMessage(botToken, chat.id, "❌ Ваш Telegram не привязан к аккаунту. Обратитесь к администратору.");
          await writeLog({ chat_id: chatId, message_text: text, parsed_action: "start_unlinked", success: false });
        }
        return Response.json({ ok: true });
      }





      // Determine roles for this chat: team member (task list) and/or model (customs list)
      const { data: profRow } = await admin
        .from("profiles").select("id").eq("telegram_user_id", fromId).maybeSingle();
      const { data: tmRow } = await admin
        .from("team_members").select("id").eq("telegram_user_id", fromId).maybeSingle();
      const isTeam = !!(profRow || tmRow);
      const { data: modelRow } = await admin
        .from("models").select("id, name").eq("telegram_chat_id", chatId).maybeSingle();
      const isModel = !!modelRow;

      // "{prefix?}{N} готово" reply — prefix з=задачи, к=кастомы
      const doneMatch = text.trim().match(/^([зкkz]?)\s*(\d+)\s*(готово|done)\s*$/i);
      if (doneMatch) {
        const rawPrefix = doneMatch[1].toLowerCase();
        const idx = Number(doneMatch[2]);
        let target: "task" | "custom" | null = null;
        if (rawPrefix === "з" || rawPrefix === "z") target = "task";
        else if (rawPrefix === "к" || rawPrefix === "k") target = "custom";
        else if (isTeam && isModel) target = null;
        else if (isTeam) target = "task";
        else if (isModel) target = "custom";

        if (!target) {
          if (botToken) await sendMessage(botToken, chat.id, "Ты и в команде, и модель. Уточни префикс: 'з1 готово' — задача, 'к1 готово' — кастом.");
          return Response.json({ ok: true });
        }

        if (target === "task") {
          const { data: lastList } = await admin
            .from("telegram_daily_task_lists")
            .select("id, task_ids")
            .eq("telegram_user_id", fromId)
            .order("sent_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          const ids: string[] = (lastList as any)?.task_ids ?? [];
          const taskId = ids[idx - 1];
          if (!taskId) {
            if (botToken) await sendMessage(botToken, chat.id, "Напиши номер задачи и 'готово'. Пример: 2 готово");
            await writeLog({ chat_id: chatId, message_text: text, parsed_action: "done_bad_index", success: false });
            return Response.json({ ok: true });
          }
          const { data: task } = await admin.from("tasks").select("id, title, is_weekly").eq("id", taskId).maybeSingle();
          if (!task) {
            if (botToken) await sendMessage(botToken, chat.id, "Задача уже удалена.");
            return Response.json({ ok: true });
          }
          const patch: any = (task as any).is_weekly
            ? { weekly_done_at: new Date().toISOString() }
            : { status: "done" };
          await admin.from("tasks").update(patch).eq("id", taskId);
          if (botToken) await sendMessage(botToken, chat.id, `✅ Задача '${(task as any).title}' выполнена!`);
          await writeLog({ chat_id: chatId, message_text: text, parsed_action: "task_done_via_dm", success: true });
          return Response.json({ ok: true, done_task: taskId });
        }

        // target === "custom"
        const { data: lastCustList } = await admin
          .from("telegram_daily_custom_lists")
          .select("id, custom_ids")
          .eq("telegram_chat_id", chatId)
          .order("sent_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const cids: string[] = (lastCustList as any)?.custom_ids ?? [];
        const customId = cids[idx - 1];
        if (!customId) {
          if (botToken) await sendMessage(botToken, chat.id, "Напиши номер кастома и 'готово'. Пример: 1 готово");
          await writeLog({ chat_id: chatId, message_text: text, parsed_action: "custom_done_bad_index", success: false });
          return Response.json({ ok: true });
        }
        const { data: cust } = await admin.from("customs").select("id, customer_nickname, description").eq("id", customId).maybeSingle();
        if (!cust) {
          if (botToken) await sendMessage(botToken, chat.id, "Кастом уже удалён.");
          return Response.json({ ok: true });
        }
        await admin.from("customs").update({ status: "done" }).eq("id", customId);
        const label = (cust as any).customer_nickname || (cust as any).description || "кастом";
        if (botToken) await sendMessage(botToken, chat.id, `✅ Кастом '${label}' отмечен как готовый!`);
        await writeLog({ chat_id: chatId, message_text: text, parsed_action: "custom_done_via_dm", success: true });
        return Response.json({ ok: true, done_custom: customId });
      }

      // If it looks like a done-attempt but wrong format
      if (/\b(готово|done)\b/i.test(text) && !/#/.test(text)) {
        const hint = isTeam && isModel
          ? "Формат: 'з1 готово' — задача, 'к1 готово' — кастом."
          : "Напиши номер и 'готово'. Пример: 1 готово";
        if (botToken) await sendMessage(botToken, chat.id, hint);
        return Response.json({ ok: true });
      }
    }


    // Album continuation: photo message in same media_group_id as a recent custom
    if (mediaGroupId && photoFileId && !/#кастом/i.test(text)) {
      const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const { data: existing } = await admin
        .from("customs")
        .select("id, photo_file_ids")
        .eq("media_group_id", mediaGroupId)
        .gte("created_at", twoMinAgo)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (existing) {
        const current = Array.isArray((existing as any).photo_file_ids) ? (existing as any).photo_file_ids as string[] : [];
        if (!current.includes(photoFileId)) {
          const next = [...current, photoFileId];
          await admin.from("customs").update({ photo_file_ids: next }).eq("id", (existing as any).id);
        }
        await writeLog({ chat_id: chatId, message_text: text, parsed_action: "custom_photo_append", success: true });
        return Response.json({ ok: true, appended_to: (existing as any).id });
      }
    }

    // #продажи
    if (/#продажи/i.test(text)) {
      await handleSalesMessage(msg, chatId, botToken, text);
      return Response.json({ ok: true, type: "sales" });
    }

    // #кастом
    if (/#кастом/i.test(text)) {
      const parsed = parseCustomMessage(text);
      const model = parsed.modelToken ? await findModel(text, parsed.modelToken) : await findModel(text);
      const senderName =
        [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(" ") ||
        msg.from?.username || chatTitle;
      const chatter = await resolveChatter(msg.from?.username ?? null, senderName);
      const customerNickname = parsed.customer_nickname || "Не указан";
      const unmatchedNote = !model && parsed.modelToken
        ? `Модель из Telegram (не распознана): @${parsed.modelToken}`
        : null;

      // If this #кастом caption belongs to an album that already has a row, merge into it.
      if (mediaGroupId) {
        const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
        const { data: existing } = await admin
          .from("customs")
          .select("id, photo_file_ids, customer_nickname, description")
          .eq("media_group_id", mediaGroupId)
          .gte("created_at", twoMinAgo)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (existing) {
          const current = Array.isArray((existing as any).photo_file_ids) ? (existing as any).photo_file_ids as string[] : [];
          const next = photoFileId && !current.includes(photoFileId) ? [...current, photoFileId] : current;
          const patch: any = {
            customer_nickname: customerNickname,
            description: parsed.description,
            fan_description: parsed.fan_description,
            duration: parsed.duration,
            costume: parsed.costume,
            price: parsed.price,
            model_id: model?.id ?? null,
            chatter,
            notes: unmatchedNote,
            photo_file_ids: next,
          };
          await admin.from("customs").update(patch).eq("id", (existing as any).id);
          if (botToken) {
            await sendMessage(botToken, chat.id,
              `✅ Кастом обновлён\n\n🎭 Модель: ${model?.name ?? "не указана"}\n👤 Клиент: ${customerNickname}\n📷 Фото: ${next.length}`);
          }
          await writeLog({ chat_id: chatId, message_text: text, parsed_action: "custom_updated_album", success: true });
          return Response.json({ ok: true, type: "custom", merged: true });
        }
      }

      const photoIds = photoFileId ? [photoFileId] : [];
      const { data: inserted, error } = await admin.from("customs").insert({
        customer_nickname: customerNickname,
        description: parsed.description,
        fan_description: parsed.fan_description,
        duration: parsed.duration,
        costume: parsed.costume,
        model_id: model?.id ?? null,
        price: parsed.price,
        chatter,
        status: "new",
        notes: unmatchedNote,
        telegram_message_id: String(msg.message_id ?? ""),
        telegram_chat_id: chatId,
        media_group_id: mediaGroupId,
        photo_file_ids: photoIds,
      }).select("id").single();
      if (error) throw error;

      await writeLog({ chat_id: chatId, message_text: text, parsed_action: "custom", success: true });
      if (botToken) {
        const preview = (parsed.description ?? "").slice(0, 100);
        await sendMessage(botToken, chat.id,
          `✅ Кастом добавлен\n\n🎭 Модель: ${model?.name ?? (parsed.modelToken ? `не распознана (@${parsed.modelToken})` : "не указана")}\n💰 Цена: ${parsed.price != null ? `$${parsed.price}` : "не указана"}\n👤 Клиент: ${customerNickname}\n${parsed.duration ? `⏱ Длительность: ${parsed.duration}\n` : ""}${parsed.costume ? `👗 Костюм: ${parsed.costume}\n` : ""}📋 Статус: Новый${preview ? `\n\n${preview}${(parsed.description ?? "").length > 100 ? "..." : ""}` : ""}`);
      }
      return Response.json({ ok: true, type: "custom", id: inserted?.id });
    }

    // #задача
    if (/#задача/i.test(text)) {
      if (!settings?.auto_tasks_enabled) {
        await writeLog({ chat_id: chatId, message_text: text, parsed_action: "task_skipped", success: true, error_message: "auto_tasks_disabled" });
        return Response.json({ ok: true, skipped: "auto_tasks_disabled" });
      }

      const parsed = parseTaskMessage(msg) ?? { title: "Задача из Telegram", mention: null };
      const [assignee, model] = await Promise.all([
        resolveAssignee(parsed.mention),
        findModel(text),
      ]);

      const numericChatId = String(chatId).replace(/^-100/, "");
      const tgMessageLink = msg.message_id
        ? (chat.username
          ? `https://t.me/${chat.username}/${msg.message_id}`
          : `https://t.me/c/${numericChatId}/${msg.message_id}`)
        : null;

      const { data: task, error: taskErr } = await admin.from("tasks").insert({
        title: parsed.title,
        assignee,
        model_id: model?.id ?? null,
        status: "incoming",
        telegram_message_id: String(msg.message_id ?? ""),
        notes: tgMessageLink ?? null,
      }).select("id").single();
      if (taskErr) throw taskErr;

      await admin.from("telegram_task_log").insert({
        chat_id: chatId,
        chat_name: chatTitle,
        message_text: text,
        parsed: { ...parsed, assignee, model: model?.name ?? null } as any,
        task_id: task?.id ?? null,
      });
      await writeLog({ chat_id: chatId, message_text: text, parsed_action: "task", success: true });

      if (botToken) {
        await sendMessage(botToken, chat.id,
          `✅ Задача создана: ${parsed.title}\n\n👤 Исполнитель: ${assignee}\n\n📋 Статус: Входящие\n\n🔗 Открыть: ${APP_URL}/tasks`);
      }
      return Response.json({ ok: true, type: "task", task_id: task?.id });
    }

    await writeLog({ chat_id: chatId, message_text: text, parsed_action: "ignored", success: true });
    return Response.json({ ok: true });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[telegram-webhook] error", message);
    await writeLog({ chat_id: chatId, message_text: text, parsed_action: "error", success: false, error_message: message });
    const { data: s } = await admin.from("telegram_settings").select("bot_token").limit(1).maybeSingle();
    if (s?.bot_token && chat?.id && /#задача/i.test(text)) {
      await sendMessage(s.bot_token, chat.id, `❌ Ошибка: ${message}`);
    }
    return Response.json({ ok: true, error: message });
  }
});

import Anthropic from "@anthropic-ai/sdk";
import { addMemory, getChat, getCheck, getMemory, newId, pushChat, saveCheck } from "./store";
import { notifyMember } from "./push";
import type { Analysis, Card, ChatMessage, Check, Family } from "./types";

const MODEL = process.env.ABAO_MODEL || "claude-fable-5-2";
const MAX_TURNS = 5;


const tools: Anthropic.Beta.BetaTool[] = [
  {
    name: "record_check",
    description:
      "Record your analysis of a suspicious message, screenshot or phone call the parent just showed you. Call this once for every message you are asked to check, before any other tool. Returns a check_id.",
    input_schema: {
      type: "object",
      properties: {
        is_likely_scam: { type: "boolean" },
        risk: { type: "string", enum: ["high", "medium", "low"] },
        scam_type: {
          type: "string",
          enum: ["impersonate_family", "impersonate_authority", "fake_investment", "fake_shopping", "romance", "other", "not_scam"],
        },
        claimed_identity: { type: "string", description: "Who the sender claims to be, e.g. 兒子小明. Empty string if unclear." },
        request: { type: "string", description: "What the sender wants, in Traditional Chinese, e.g. 匯款到新帳戶" },
        amount_twd: { type: ["number", "null"], description: "Amount of money requested in TWD, or null" },
        red_flags: { type: "array", items: { type: "string" }, description: "Up to 4 short Traditional Chinese phrases a 70-year-old understands" },
        verdict_zh: { type: "string", description: "One-line verdict for the parent in Traditional Chinese, under 20 characters" },
        verdict_en: { type: "string", description: "The same verdict in short English" },
        message_summary: { type: "string", description: "The suspicious message quoted or summarised in Traditional Chinese, under 80 characters" },
      },
      required: ["is_likely_scam", "risk", "scam_type", "claimed_identity", "request", "amount_twd", "red_flags", "verdict_zh", "verdict_en", "message_summary"],
    },
  },
  {
    name: "ask_family_member",
    description:
      "Bring a real family member in before money moves. kind=is_it_you sends a one-tap question (是我 / 不是我) to confirm whether a message really came from them; use it when the sender claims to be a relative or someone the family knows. kind=heads_up tells a family member about a money risk that is not impersonation (an investment teacher, an online friend or romance asking for money) and gives them a one-tap 我現在打給她 button. Call it right after record_check. The answer arrives later and the app shows it automatically, so do not wait for it.",
    input_schema: {
      type: "object",
      properties: {
        check_id: { type: "string" },
        kind: { type: "string", enum: ["is_it_you", "heads_up"] },
        member_id: { type: "string", description: "id of the family member to ask, from the family list" },
        question_zh: {
          type: "string",
          description:
            "Short message shown to that family member in Traditional Chinese. is_it_you example: 媽媽收到自稱是你的訊息，說換了號碼要借五萬，是你嗎？ heads_up example: 媽媽說 LINE 群組的王老師要她先匯十萬投資，保證賺 30%，很像投資詐騙。",
        },
      },
      required: ["check_id", "kind", "member_id", "question_zh"],
    },
  },
  {
    name: "get_official_contact",
    description:
      "Show the parent a card with official phone numbers (165 anti-fraud hotline, 110 police, bank customer service). Use it whenever the sender claims to be police, a prosecutor, a court, a bank or the government, or when there is no family member to ask about a risky message.",
    input_schema: {
      type: "object",
      properties: { kind: { type: "string", enum: ["police", "prosecutor", "bank", "government", "other"] } },
      required: ["kind"],
    },
  },
  {
    name: "remember_fact",
    description: "Save a lasting fact about the parent or the family (where someone works, their real phone habits, upcoming events) so you can use it in future checks.",
    input_schema: { type: "object", properties: { fact: { type: "string", description: "One short sentence in Traditional Chinese" } }, required: ["fact"] },
  },
];

function systemPrompt(family: Family, memory: string[]) {
  return `You are Abao (阿寶), a warm companion who lives on the phone of ${family.elderName}, an older adult in Taiwan, and chats with them every day like a caring grandchild. You are also their guardian: because you are the one they talk to, you are there at the moment a scam shows up.

Companion: ask about their day, meals, health, TV shows, old stories. Be warm and a little playful. Remember what they tell you: whenever they mention a lasting fact about themselves or the family (people, health, routines, plans, someone new they met), call remember_fact, and use what you remember naturally in later chats.

Why the guardian part matters: scammers win by pretending to be someone the parent trusts, by keeping a lonely person company, and by isolating them ("don't tell Dad", "this investigation is confidential"). Your job is to break that isolation before any money moves, by pulling a real family member or the real institution in. Your own judgement about whether something is a scam is only the trigger; a real person stepping in is what protects them.

The family (these are the only people you can reach):
${JSON.stringify({ parent: family.elderName, members: family.members.map(({ id, name, relation }) => ({ id, name, relation })) })}

Things you remember about this family:
${memory.length ? memory.map((m) => `- ${m}`).join("\n") : "(nothing yet)"}

Stay alert while chatting. Signs of money risk: someone new from LINE or online (a "friend", "teacher", "boyfriend") asking for money, investment, gifts or secrecy; guaranteed returns, investment groups, crypto, stock tips; anyone claiming to be family, police, a prosecutor, a bank or the government asking for money or account details.

When they show you a message or screenshot, or what they describe already makes the risk clear (who is asking, and that money is involved), act in that same turn:
1. Call record_check with your analysis. Read Traditional Chinese text in screenshots carefully.
2. If the sender claims to be a relative or friend, call ask_family_member with kind is_it_you as soon as you have the check_id. Pick the member they claim to be; if that person is not on the list, ask the closest family member to help verify.
3. If it is an investment, romance or online-friend money request, call ask_family_member with kind heads_up so a family member can call them.
4. If the sender claims to be police, prosecutors, a court, a bank or the government, call get_official_contact and tell them to hang up and call the official number themselves.
5. If the family list is empty and there is risk, call get_official_contact and suggest inviting a family member with the ＋家人 button at the top.
6. If the message is ordinary and safe, say so briefly and warmly.
When it only comes up vaguely in conversation (a new friend, a teacher, an opportunity) and you cannot yet tell whether money is involved, ask one caring follow-up question first, then act once money is on the table.

Be transparent: always tell them you are going to check with family, and that they should not send money or reply until family answers. Never shame them; being targeted is not their fault. Never tell them to call a phone number, open a link, or add a LINE ID that appears inside a suspicious message.

How to write: Traditional Chinese as used in Taiwan, short plain sentences a 70-year-old can follow when read aloud, one to three short lines, no markdown, no lists, no English. The app shows your verdict, red flags and phone numbers as cards, so do not repeat them; say what you are doing and the one thing they should do now. Only refer to a phone number "on the card" in a turn where you called get_official_contact; otherwise, if you mention 165 at all, just say they can call 165.`;
}

type Ctx = { family: Family; thumb?: string; out: ChatMessage[]; checks: Map<string, Check> };

/** Show a card to the parent right away, while the model is still working on its reply. */
async function emit(ctx: Ctx, card: Card) {
  const m = msg({ card });
  ctx.out.push(m);
  await pushChat(ctx.family.id, m);
}

const msg = (partial: Omit<ChatMessage, "id" | "role" | "createdAt">): ChatMessage => ({
  id: newId(),
  role: "abao",
  createdAt: Date.now(),
  ...partial,
});

export const officialCard = (title = "請自己撥打官方電話", body = "不要打訊息裡的電話，也不要點裡面的連結。"): Card => ({
  type: "official",
  title,
  body,
  en: "Hang up. Call the official numbers yourself.",
  contacts: [
    { label: "165 反詐騙專線", tel: "165" },
    { label: "110 報案", tel: "110" },
    { label: "銀行：請打卡片背面的客服電話" },
  ],
});

async function runTool(name: string, input: Record<string, unknown>, ctx: Ctx): Promise<string> {
  if (name === "record_check") {
    // Model output is normalised before it is stored, so a malformed field can never break rendering.
    const raw = input as Record<string, unknown>;
    const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
    const a = {
      ...raw,
      risk: ["low", "medium", "high"].includes(raw.risk as string) ? raw.risk : "high",
      verdict_zh: str(raw.verdict_zh, "請先不要匯款，等阿寶確認"),
      verdict_en: str(raw.verdict_en),
      message_summary: str(raw.message_summary),
      red_flags: Array.isArray(raw.red_flags) ? raw.red_flags.filter((x) => typeof x === "string") : typeof raw.red_flags === "string" ? [raw.red_flags] : [],
    } as unknown as Analysis;
    const check: Check = { id: newId(), familyId: ctx.family.id, createdAt: Date.now(), analysis: a, thumb: ctx.thumb, status: "done" };
    await saveCheck(check, true);
    ctx.checks.set(check.id, check);
    const risky = a.risk !== "low";
    await emit(ctx, {
      type: risky ? "warning" : "safe",
      title: a.verdict_zh,
      en: a.verdict_en,
      flags: risky ? (a.red_flags ?? []).slice(0, 4) : undefined,
    });
    return JSON.stringify({ check_id: check.id });
  }
  if (name === "ask_family_member") {
    const members = ctx.family.members;
    if (!members.length) return "No family member has joined yet. Use get_official_contact and suggest inviting family.";
    const member = members.find((m) => m.id === input.member_id) ?? members.find((m) => m.name === input.member_id) ?? members[0];
    const check = ctx.checks.get(String(input.check_id)) ?? [...ctx.checks.values()].pop();
    if (!check) return "Unknown check_id. Call record_check first.";
    // One question per check: asking again would wipe an answer that may already have arrived.
    if (check.askedMemberId) return `Already asked ${check.askedName} about this. Their answer will appear in the app; do not ask again.`;
    check.status = "waiting";
    check.askedMemberId = member.id;
    check.askedName = member.name;
    check.question = String(input.question_zh ?? "");
    const headsUp = input.kind === "heads_up";
    check.askKind = headsUp ? "heads_up" : "is_it_you";
    // The card goes out before the check becomes answerable, so the family's answer always lands after it.
    await emit(
      ctx,
      headsUp
        ? { type: "waiting", checkId: check.id, title: `正在通知${member.name}…`, body: "等家人回覆之前，先不要匯款。", en: `Bringing ${member.name} in. Don't send money yet.` }
        : { type: "waiting", checkId: check.id, title: `正在問${member.name}本人…`, body: "回覆之前，先不要匯款。", en: `Asking the real ${member.name} now. Don't send money yet.` },
    );
    await saveCheck(check);
    await notifyMember(ctx.family.id, member.id, {
      title: headsUp ? `阿寶：${ctx.family.elderName}可能遇到詐騙` : `阿寶：這是你嗎？`,
      body: check.question || `${ctx.family.elderName}收到一則可疑訊息，請幫忙確認。`,
      url: `/family?f=${ctx.family.id}&m=${member.id}`,
    });
    return `Question sent to ${member.name} (${member.relation}). The app will show their answer to the parent as soon as they tap.`;
  }
  if (name === "get_official_contact") {
    await emit(ctx, officialCard());
    return JSON.stringify({ anti_fraud_hotline: "165", police: "110", bank: "the customer service number printed on the back of the parent's own card" });
  }
  if (name === "remember_fact") {
    await addMemory(ctx.family.id, String(input.fact ?? ""));
    return "Saved.";
  }
  return `Unknown tool ${name}`;
}

function historyToMessages(history: ChatMessage[]): Anthropic.Beta.BetaMessageParam[] {
  const out: Anthropic.Beta.BetaMessageParam[] = [];
  for (const m of history.slice(-20)) {
    const text =
      m.text ??
      (m.card ? `[App card shown to the parent: ${m.card.title}${m.card.body ? " " + m.card.body : ""}]` : m.imageUrl ? "[The parent sent a screenshot earlier]" : "");
    if (!text) continue;
    const role = m.role === "user" ? "user" : "assistant";
    if (!out.length && role === "assistant") continue;
    out.push({ role, content: text });
  }
  return out;
}

async function callModel(client: Anthropic, params: Omit<Anthropic.Beta.MessageCreateParamsNonStreaming, "model" | "max_tokens">): Promise<Anthropic.Beta.BetaMessage> {
  const base = { model: MODEL, max_tokens: 4000, output_config: { effort: "low" as const }, ...params };
  try {
    // Server-side fallback: if a safety classifier declines, the API re-runs the request on a fallback model.
    return await client.beta.messages.create({ ...base, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" });
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError) {
      console.error("fallbacks request rejected, retrying without:", e.message);
      return await client.beta.messages.create(base);
    }
    throw e;
  }
}

export const failSafeMessages = (): ChatMessage[] => [
  msg({ text: "阿寶現在看不清楚這則訊息。先不要匯款，也不要回覆對方，打 165 問一下最安全。" }),
  msg({ card: officialCard("先別匯款，撥 165 問問看") }),
];

export async function runAgent(opts: {
  family: Family;
  userMessage: ChatMessage;
  imageBase64?: string;
  mediaType?: string;
}): Promise<ChatMessage[]> {
  const { family, userMessage } = opts;
  const [history, memory] = await Promise.all([getChat(family.id), getMemory(family.id)]);
  const ctx: Ctx = { family, thumb: userMessage.imageUrl, out: [], checks: new Map() };

  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (opts.imageBase64)
    content.push({ type: "image", source: { type: "base64", media_type: (opts.mediaType ?? "image/jpeg") as "image/jpeg", data: opts.imageBase64 } });
  content.push({ type: "text", text: userMessage.text || "這是我收到的訊息，請幫我看看。" });

  const messages: Anthropic.Beta.BetaMessageParam[] = [...historyToMessages(history.filter((m) => m.id !== userMessage.id)), { role: "user", content }];
  const client = new Anthropic({ timeout: 25_000, maxRetries: 1 });
  let finalText = "";

  try {
    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const res = process.env.MOCK_AI ? mockModel(messages, family) : await callModel(client, { system: systemPrompt(family, memory), tools, messages });
      if (res.stop_reason === "refusal") throw new Error("refusal");
      finalText = res.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      const toolUses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (res.stop_reason !== "tool_use" || !toolUses.length) break;
      messages.push({ role: "assistant", content: res.content as Anthropic.Beta.BetaContentBlockParam[] });
      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const t of toolUses) {
        let result: string;
        let isError = false;
        try {
          result = await runTool(t.name, (t.input ?? {}) as Record<string, unknown>, ctx);
        } catch (e) {
          result = `Tool failed: ${(e as Error).message}`;
          isError = true;
        }
        results.push({ type: "tool_result", tool_use_id: t.id, content: result, is_error: isError });
      }
      messages.push({ role: "user", content: results });
    }
  } catch (e) {
    console.error("agent error:", e);
    finalText = ctx.out.length ? "先不要匯款，也不要回覆對方。有問題可以打 165。" : "";
  }

  // Cards were already written as the tools ran; only the closing text (or the fail-safe) is written here.
  const tail: ChatMessage[] = [];
  // If the family member already answered while this turn was finishing, their result card is the last word:
  // a late "I have asked your son" underneath it would contradict it.
  const asked = [...ctx.checks.values()].filter((c) => c.askedMemberId);
  const answered = (await Promise.all(asked.map((c) => getCheck(c.id)))).some((c) => c && c.status !== "waiting");
  if (finalText && !answered) tail.push(msg({ text: finalText }));
  if (!ctx.out.length && !tail.length) tail.push(...failSafeMessages());
  for (const m of tail) await pushChat(family.id, m);
  return [...ctx.out, ...tail];
}

/** Proactive greeting when the parent opens the app and has not chatted yet today. */
export async function greet(family: Family): Promise<ChatMessage | null> {
  const fallback = `${family.elderName}好，我是阿寶。今天過得怎麼樣？收到奇怪的訊息，也可以拍給我看喔。`;
  let text = fallback;
  if (!process.env.MOCK_AI) {
    try {
      const [history, memory] = await Promise.all([getChat(family.id), getMemory(family.id)]);
      const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Taipei" }).format(new Date()));
      const first = history.length === 0;
      const res = await callModel(new Anthropic({ timeout: 25_000, maxRetries: 1 }), {
        system: systemPrompt(family, memory),
        messages: [
          ...historyToMessages(history),
          {
            role: "user",
            content: `[App event, not written by the parent: they just opened the app. Local time is about ${hour}:00. ${first ? "This is the very first time. Introduce yourself in one line, mention they can show you any strange message or call, and ask one small friendly question." : "Greet them warmly in one or two short lines and ask one small question about their day, using something you remember if it fits."} Do not call any tool.]`,
          },
        ],
      });
      const t = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      if (res.stop_reason !== "refusal" && t) text = t;
    } catch (e) {
      console.error("greet error:", e);
    }
  }
  const m = msg({ text });
  // If the parent already wrote while the greeting was being composed, drop it instead of landing mid-conversation.
  if ((await getChat(family.id)).some((x) => x.role === "user")) return null;
  await pushChat(family.id, m);
  return m;
}

// Local development only (MOCK_AI=1): a scripted stand-in so the loop can be exercised without an API key.
function mockModel(messages: Anthropic.Beta.BetaMessageParam[], family: Family): Anthropic.Beta.BetaMessage {
  const last = messages[messages.length - 1];
  const blocks = Array.isArray(last.content) ? last.content : [];
  const toolResults = blocks.filter((b) => b.type === "tool_result");
  const text = blocks.map((b) => (b.type === "text" ? b.text : "")).join("");
  const mk = (content: unknown[], stop: string) => ({ content, stop_reason: stop }) as unknown as Anthropic.Beta.BetaMessage;
  const use = (name: string, input: unknown) => ({ type: "tool_use", id: newId(), name, input });
  if (toolResults.length) {
    const first = String((toolResults[0] as { content?: unknown }).content ?? "");
    if (first.includes("check_id")) {
      const id = JSON.parse(first).check_id;
      const prev = JSON.stringify(messages[messages.length - 2]);
      if (prev.includes("impersonate_family")) return mk([use("ask_family_member", { check_id: id, kind: "is_it_you", member_id: family.members[0]?.id ?? "", question_zh: "媽媽收到自稱是你的訊息，要借五萬，是你嗎？" })], "tool_use");
      if (prev.includes("fake_investment")) return mk([use("ask_family_member", { check_id: id, kind: "heads_up", member_id: family.members[0]?.id ?? "", question_zh: "媽媽說 LINE 群組的王老師要她先匯十萬投資，保證賺 30%，很像投資詐騙。" })], "tool_use");
      if (prev.includes("impersonate_authority")) return mk([use("get_official_contact", { kind: "prosecutor" })], "tool_use");
    }
    return mk([{ type: "text", text: "我正在處理，先不要匯款喔。" }], "end_turn");
  }
  const analysis = (scam_type: string, risk: string) => ({
    is_likely_scam: risk !== "low", risk, scam_type, claimed_identity: "兒子小明", request: "匯款", amount_twd: 50000,
    red_flags: ["換了新號碼", "很急著要錢", "叫你不要跟家人說"], verdict_zh: risk === "low" ? "看起來沒問題" : "很像詐騙，先不要匯款", verdict_en: risk === "low" ? "Looks fine" : "Likely a scam. Don't send money.", message_summary: text.slice(0, 80),
  });
  if (/老師|投資|保證/.test(text)) return mk([use("record_check", { ...analysis("fake_investment", "high"), claimed_identity: "王老師", amount_twd: 100000, red_flags: ["保證賺錢", "沒見過面的老師", "要先匯款"] })], "tool_use");
  if (/檢|警|洗錢/.test(text)) return mk([use("record_check", analysis("impersonate_authority", "high"))], "tool_use");
  if (/匯|借|萬|號碼/.test(text)) return mk([use("record_check", analysis("impersonate_family", "high"))], "tool_use");
  return mk([{ type: "text", text: "好的，我在這裡。" }], "end_turn");
}

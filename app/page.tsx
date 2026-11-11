"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import CardView, { cardSpeech } from "@/components/CardView";
import { type ElderId, type FamilyId, load, prepareImage, save, speak, stopSpeaking } from "@/lib/client";
import type { ChatMessage, Family } from "@/lib/types";

const SAMPLES_EN = [
  { label: "“Mom, I got a new number”", text: "I just got this text: “Mom, it’s Michael. I dropped my phone and this is my new number. I need $2,000 today for an emergency, I’ll pay you back tonight. Please don’t tell Dad.”" },
  { label: "“My trading coach has a sure thing”", text: "Mr. Wang from my investing group chat says tomorrow he will show us a stock that is guaranteed to go up 30%. I have to wire $5,000 first. I met him in the group two weeks ago and we have never met in person." },
  { label: "“Notice from the IRS”", text: "I got this text: “IRS notice: your account is linked to a money laundering case. Call 202-555-0147 immediately to cooperate or your accounts will be frozen.”" },
];
const SAMPLES = [
  { label: "「王老師要帶我買股票」", text: "LINE 上那個王老師說明天要帶我們買一支保證賺 30% 的股票，要先匯 10 萬。我是在群組認識他的，兩個禮拜了，沒見過面。" },
  { label: "「媽，我換號碼了」", text: "我剛剛收到這則 LINE：「媽，我是小明，我手機壞了換新號碼，這是我新的 LINE。我現在急需 5 萬塊周轉，下午就還妳，先不要跟爸說。」" },
  { label: "「地檢署通知」", text: "我收到簡訊：「臺北地檢署通知：您的帳戶涉及洗錢案，請立即撥打 02-2345-6789 配合調查，否則將凍結帳戶。」" },
];

type SR = { lang: string; interimResults: boolean; onresult: (e: { results: { 0: { transcript: string } }[] }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };

export default function Home() {
  const [me, setMe] = useState<ElderId | null>(null);
  const [familyMe, setFamilyMe] = useState<FamilyId | null>(null);
  const [ready, setReady] = useState(false);
  const [en, setEn] = useState(false);

  useEffect(() => {
    // /?f=<familyId>&n=<name> opens a specific family without touching saved identity (used by /demo).
    const q = new URLSearchParams(location.search);
    const f = q.get("f");
    setEn(q.get("lang") === "en");
    setMe(f ? { familyId: f, name: q.get("n") || "媽媽" } : load<ElderId>("abao.elder"));
    setFamilyMe(load<FamilyId>("abao.family"));
    setReady(true);
  }, []);

  if (!ready) return null;
  if (!me) return <Onboarding familyMe={familyMe} onDone={setMe} en={en} />;
  return <Chat me={me} langEn={en} />;
}

function Onboarding({ familyMe, onDone, en }: { familyMe: FamilyId | null; onDone: (e: ElderId) => void; en: boolean }) {
  const t = (zh: string, e: string) => (en ? e : zh);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function start() {
    setBusy(true);
    setErr("");
    try {
      const res = await fetch("/api/family", { method: "POST", body: JSON.stringify({ elderName: name.trim() || t("媽媽", "Mom"), lang: en ? "en" : undefined }) });
      const family: Family = await res.json();
      const id = { familyId: family.id, name: family.elderName };
      save("abao.elder", id);
      onDone(id);
    } catch {
      setErr(t("連線有問題，請再試一次。", "Connection problem. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="stagger mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="阿寶" className="h-28 w-28 rounded-[28px] shadow-lg" />
      <div>
        <h1 className="title text-4xl font-extrabold">阿寶 Abao</h1>
        <p className="mt-3 text-xl leading-relaxed text-stone-700">
          {t("收到奇怪的訊息，先給阿寶看。", "Got a strange message? Show Abao first.")}
          <br />
          {t("阿寶會幫您問家人本人。", "Abao checks with your real family before any money moves.")}
        </p>
        <p className="mt-2 text-sm text-stone-500">A personal AI agent for your parents. It checks with family before money moves.</p>
      </div>
      <div className="w-full space-y-3">
        <label className="block text-left text-xl font-bold">{t("家人都怎麼叫您？", "What does your family call you?")}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("例如：媽媽、阿嬤、爸爸", "e.g. Mom, Grandma, Dad")} className="h-16 w-full rounded-2xl border-2 border-orange-300 bg-white px-4 text-2xl outline-none focus:border-orange-500" />
        <button onClick={start} disabled={busy} className="h-16 w-full rounded-2xl bg-orange-500 text-2xl font-extrabold text-white shadow-lg disabled:opacity-60">
          {busy ? t("準備中…", "Getting ready…") : t("開始使用阿寶", "Start using Abao")}
        </button>
        {err && <p className="text-lg text-red-600">{err}</p>}
      </div>
      <div className="text-base text-stone-500">
        {t("我是家人：請點長輩傳給您的邀請連結。", "Family member? Open the invite link your parent sent you.")}
        {familyMe && (
          <a href="/family" className="ml-1 font-bold text-orange-600 underline">
            {t("回到我的通知頁", "Back to my alerts")}
          </a>
        )}
      </div>
    </main>
  );
}

function Chat({ me, langEn }: { me: ElderId; langEn: boolean }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [family, setFamily] = useState<Family | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [voiceOn, setVoiceOn] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [listening, setListening] = useState(false);
  const [canListen, setCanListen] = useState(false);
  const seen = useRef(new Set<string>());
  const loaded = useRef(false);
  const cursor = useRef<number | null>(null);
  const voiceRef = useRef(true);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<SR | null>(null);
  const en = langEn || family?.lang === "en";
  const enRef = useRef(en);
  enRef.current = en;
  const t = (zh: string, e: string) => (en ? e : zh);

  useEffect(() => {
    const v = new URLSearchParams(location.search).get("quiet") ? false : load<boolean>("abao.voice");
    if (v === false) {
      setVoiceOn(false);
      voiceRef.current = false;
    }
    setCanListen("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  }, []);

  const merge = useCallback((incoming: ChatMessage[], announce: boolean) => {
    const fresh = incoming.filter((m) => !seen.current.has(m.id));
    if (!fresh.length) return;
    fresh.forEach((m) => seen.current.add(m.id));
    setMessages((prev) => [...prev.filter((p) => !fresh.some((f) => f.id === p.id)), ...fresh].sort((a, b) => a.createdAt - b.createdAt));
    if (announce && voiceRef.current) {
      for (const m of fresh) if (m.role === "abao") speak(m.text ?? (m.card ? cardSpeech(m.card) : ""), enRef.current ? "en-US" : "zh-TW");
    }
    if (announce && fresh.some((m) => m.card?.type === "warning" && m.card.call165)) navigator.vibrate?.([300, 150, 300, 150, 300]);
  }, []);

  useEffect(() => {
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(`/api/chat/history?familyId=${me.familyId}${cursor.current === null ? "" : `&after=${cursor.current}`}`, { cache: "no-store" });
        if (res.status === 404) {
          localStorage.removeItem("abao.elder");
          location.reload();
          return;
        }
        const data = await res.json();
        if (stop) return;
        setFamily(data.family);
        cursor.current = data.next;
        merge(data.messages, loaded.current);
        if (!loaded.current) {
          loaded.current = true;
          // Abao speaks first when the parent opens the app and has not chatted yet today.
          fetch("/api/chat/greet", { method: "POST", body: JSON.stringify({ familyId: me.familyId }) })
            .then((r) => r.json())
            .then((d) => d.message && merge([d.message], true))
            .catch(() => {});
        }
      } catch {}
    }
    poll();
    const t = setInterval(poll, 2000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [me.familyId, merge]);

  useEffect(() => {
    // Scroll the list itself (scrollIntoView would also scroll parent frames).
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(payload: { text?: string; imageBase64?: string; thumb?: string }) {
    if (busy) return;
    stopSpeaking();
    if (voiceRef.current) speak("", en ? "en-US" : "zh-TW"); // unlock speech on iOS inside the tap
    const id = `u${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
    const local: ChatMessage = { id, role: "user", text: payload.text, imageUrl: payload.thumb, createdAt: Date.now() };
    seen.current.add(id);
    setMessages((prev) => [...prev, local]);
    setBusy(true);
    setText("");
    try {
      const res = await fetch("/api/chat", { method: "POST", body: JSON.stringify({ id, familyId: me.familyId, mediaType: "image/jpeg", ...payload }) });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      merge(data.messages.filter((m: ChatMessage) => m.id !== id), true);
    } catch {
      merge(
        [
          { id: `e${Date.now()}`, role: "abao", text: t("阿寶連不上網路。先不要匯款，有疑問請打 165。", "Abao can’t reach the network. Please hold the money and call the fraud helpline if unsure."), createdAt: Date.now() },
          {
            id: `e${Date.now()}c`,
            role: "abao",
            createdAt: Date.now() + 1,
            card: en
              ? { type: "official", title: "Hold the money. Call and ask first.", contacts: [{ label: "AARP Fraud Helpline 877-908-3360", tel: "8779083360" }, { label: "Police 911", tel: "911" }] }
              : { type: "official", title: "先別匯款，撥 165 問問看", contacts: [{ label: "165 反詐騙專線", tel: "165" }, { label: "110 報案", tel: "110" }] },
          },
        ],
        true,
      );
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const img = await prepareImage(file);
      await send({ ...img, text: text.trim() || undefined });
    } catch {
      alert(t("這張圖片打不開，請再選一次。", "That picture would not open. Please pick it again."));
    }
  }

  function toggleListen() {
    if (listening) return recRef.current?.stop();
    const W = window as unknown as { webkitSpeechRecognition?: new () => SR; SpeechRecognition?: new () => SR };
    const Rec = W.webkitSpeechRecognition ?? W.SpeechRecognition;
    if (!Rec) return;
    stopSpeaking();
    const rec = new Rec();
    rec.lang = en ? "en-US" : "zh-TW";
    rec.interimResults = false;
    rec.onresult = (e) => {
      const said = e.results[0]?.[0]?.transcript;
      if (said) send({ text: said });
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  function toggleVoice() {
    const next = !voiceOn;
    setVoiceOn(next);
    voiceRef.current = next;
    save("abao.voice", next);
    if (!next) stopSpeaking();
  }

  const members = family?.members ?? [];

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-orange-50">
      <header className="flex items-center gap-2 bg-orange-500 px-3 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] text-white shadow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl border-2 border-white/60" />
        <div className="mr-auto leading-tight">
          <div className="text-2xl font-extrabold">{t("阿寶", "Abao")}</div>
          <div className="text-xs opacity-90">{en ? `${family?.elderName ?? me.name}’s guardian` : `${me.name}的守護小幫手`}</div>
        </div>
        <div className="flex items-center gap-1.5">
          {members.slice(0, 3).map((m) => (
            <a key={m.id} href={m.phone ? `tel:${m.phone}` : undefined} title={m.name} className="press flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full bg-white px-2 text-base font-bold text-orange-700">
              {m.name.slice(0, 2)}
            </a>
          ))}
          <button onClick={() => setShowInvite(true)} className="h-11 shrink-0 whitespace-nowrap rounded-full bg-orange-700 px-3 text-base font-bold">
            {t("＋家人", "+ Family")}
          </button>
          <button onClick={toggleVoice} aria-label="語音開關" className="h-11 w-11 shrink-0 rounded-full bg-orange-600 text-xl">
            {voiceOn ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {members.length === 0 && (
          <button onClick={() => setShowInvite(true)} className="w-full rounded-3xl border-2 border-dashed border-orange-400 bg-white p-4 text-left text-xl font-bold text-orange-700">
            {t("👨‍👩‍👧 先邀請一位家人，阿寶才能幫您問本人 →", "👨‍👩‍👧 Invite a family member first, so Abao can ask the real person →")}
          </button>
        )}
        {messages.map((m, i) =>
          m.card ? (
            <CardView key={m.id} card={m.card} en={en} done={m.card.type === "waiting" && messages.slice(i + 1).some((x) => x.card && x.card.type !== "waiting")} />
          ) : (
            <Bubble key={m.id} role={m.role}>
              {m.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.imageUrl} alt="截圖" className="mb-1 max-h-64 rounded-xl" />
              )}
              {m.text}
            </Bubble>
          ),
        )}
        {messages.filter((m) => m.role === "user").length === 0 && (
          <div className="stagger space-y-2 pt-1">
            <div className="text-base text-stone-500">{t("試試看 Try an example：", "Try an example:")}</div>
            {(en ? SAMPLES_EN : SAMPLES).map((s) => (
              <button key={s.label} onClick={() => send({ text: s.text })} className="block w-full rounded-2xl bg-white p-3 text-left text-xl shadow-sm">
                {s.label}
              </button>
            ))}
          </div>
        )}
        {busy && (
          <Bubble role="abao">
            <span className="inline-flex items-center gap-3 text-stone-500">
              <span className="dots" aria-hidden>
                <i />
                <i />
                <i />
              </span>
              {t("阿寶正在看…", "Abao is looking…")}
            </span>
          </Bubble>
        )}
      </div>

      <footer className="space-y-2 border-t border-orange-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && text.trim() && send({ text: text.trim() })}
            placeholder={t("打字，或把訊息貼在這裡", "Type, or paste the message here")}
            className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-stone-200 px-4 text-xl outline-none focus:border-orange-400"
          />
          <button onClick={() => text.trim() && send({ text: text.trim() })} disabled={busy || !text.trim()} className="h-14 rounded-2xl bg-orange-500 px-5 text-xl font-bold text-white disabled:opacity-40">
            {t("送出", "Send")}
          </button>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="h-16 flex-1 rounded-2xl bg-orange-500 text-2xl font-extrabold text-white shadow disabled:opacity-50">
            {t("📷 拍照／截圖", "📷 Photo")}
          </button>
          {canListen && (
            <button onClick={toggleListen} disabled={busy} className={`h-16 flex-1 rounded-2xl text-2xl font-extrabold shadow disabled:opacity-50 ${listening ? "bg-red-600 text-white" : "bg-stone-800 text-white"}`}>
              {listening ? t("● 我在聽…", "● Listening…") : t("🎤 用說的", "🎤 Speak")}
            </button>
          )}
        </div>
      </footer>

      {showInvite && <Invite familyId={me.familyId} elderName={me.name} en={en} onClose={() => setShowInvite(false)} />}
    </main>
  );
}

function Bubble({ role, children }: { role: "user" | "abao"; children: React.ReactNode }) {
  return (
    <div className={`enter flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] whitespace-pre-wrap rounded-3xl px-4 py-3 text-[22px] leading-relaxed shadow-sm ${role === "user" ? "rounded-br-md bg-orange-500 text-white" : "rounded-bl-md bg-white"}`}>{children}</div>
    </div>
  );
}

function Invite({ familyId, elderName, en, onClose }: { familyId: string; elderName: string; en: boolean; onClose: () => void }) {
  const t = (zh: string, e: string) => (en ? e : zh);
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/join/${familyId}`;
  const shareText = t("我在用「阿寶」防詐騙小幫手。點這個連結當我的家人，有人冒充你的時候阿寶會直接問你：", "I’m using Abao to stay safe from scams. Tap this link to be my family contact, so Abao can ask you directly when someone pretends to be you:");

  async function share() {
    try {
      if (navigator.share) return await navigator.share({ title: "阿寶 Abao", text: shareText, url: link });
    } catch {
      return;
    }
    await navigator.clipboard?.writeText(link);
    setCopied(true);
  }

  return (
    <div className="backdrop fixed inset-0 z-10 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div className="sheet w-full max-w-md space-y-4 rounded-t-3xl bg-white p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] text-center" onClick={(e) => e.stopPropagation()}>
        <h2 className="title text-2xl font-extrabold">{t("邀請家人", "Invite family")}</h2>
        <p className="text-lg text-stone-600">{t("按下面的綠色按鈕，選一位家人傳給他就好。以後有人冒充他，阿寶會直接問他本人。", "Have them scan this code, or send them the link. If anyone ever pretends to be them, Abao asks the real person.")}</p>
        <div className="flex justify-center">
          <QRCodeSVG value={link} size={en ? 190 : 130} />
        </div>
        <div className="break-all rounded-xl bg-stone-100 p-2 text-sm text-stone-600">{link}</div>
        {!en && (
          <a href={`https://line.me/R/share?text=${encodeURIComponent(`${shareText}\n${link}`)}`} target="_blank" rel="noreferrer" className="flex h-16 w-full items-center justify-center rounded-2xl bg-[#06C755] text-2xl font-extrabold text-white">
            用 LINE 傳給家人
          </a>
        )}
        <button onClick={share} className={`h-16 w-full rounded-2xl text-2xl font-extrabold ${en ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-700"}`}>
          {copied ? t("已複製連結 ✓", "Link copied ✓") : t("用其他方式傳", "Send to family")}
        </button>
        <button onClick={onClose} className="h-12 w-full text-xl text-stone-500">
          {t("關閉", "Close")}
        </button>
        <p className="text-xs text-stone-400">Invite link for {elderName}&apos;s family. No app store, no account.</p>
      </div>
    </div>
  );
}

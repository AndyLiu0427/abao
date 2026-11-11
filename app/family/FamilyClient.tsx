"use client";
import { useEffect, useRef, useState } from "react";
import { type FamilyId, type PushState, beep, clearBadge, enablePush, load, pushState } from "@/lib/client";
import type { Check, Family } from "@/lib/types";

const clean = (t: string) => t.replace(/^[「『"“\s]+|[」』"”\s]+$/g, "");
const STATUS: Record<string, string> = { done: "阿寶已提醒", waiting: "正在問其他家人", confirmed_me: "✅ 確認是本人", confirmed_not_me: "🚫 不是本人，已擋下", family_calling: "📞 家人已打電話關心" };

export default function FamilyClient() {
  const [me, setMe] = useState<{ familyId: string; memberId: string } | null>(null);
  const [none, setNone] = useState(false);
  const [family, setFamily] = useState<Family | null>(null);
  const [pending, setPending] = useState<Check[]>([]);
  const [history, setHistory] = useState<Check[]>([]);
  const [answering, setAnswering] = useState("");
  const known = useRef<Set<string> | null>(null);
  const [push, setPush] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    pushState().then(setPush).catch(() => setPush("unsupported"));
    clearBadge();
  }, []);

  async function turnOnPush() {
    if (!me) return;
    beep();
    setPushBusy(true);
    try {
      setPush(await enablePush(me.familyId, me.memberId));
    } catch {
      setPush("off");
    } finally {
      setPushBusy(false);
    }
  }

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const stored = load<FamilyId>("abao.family");
    const familyId = q.get("f") ?? stored?.familyId;
    const memberId = q.get("m") ?? stored?.memberId;
    if (familyId && memberId) {
      setMe({ familyId, memberId });
      // Keep identity in the URL so installing to the home screen keeps it.
      // Make sure "Add to Home Screen" installs this member's page even if we got here by a client transition.
      const href = `/api/manifest?f=${familyId}&m=${memberId}`;
      let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "manifest";
        document.head.appendChild(link);
      }
      if (!link.getAttribute("href")?.startsWith("/api/manifest")) link.href = href;
      if (!q.get("f")) window.history.replaceState(null, "", `/family?f=${familyId}&m=${memberId}`);
    } else setNone(true);
  }, []);

  useEffect(() => {
    if (!me) return;
    let stop = false;
    async function poll() {
      try {
        const res = await fetch(`/api/family/pending?familyId=${me!.familyId}&memberId=${me!.memberId}`, { cache: "no-store" });
        if (!res.ok || stop) return;
        const data = await res.json();
        setFamily(data.family);
        setPending(data.pending);
        setHistory(data.history);
        const ids = new Set<string>(data.pending.map((c: Check) => c.id));
        if (known.current && [...ids].some((id) => !known.current!.has(id))) beep();
        known.current = ids;
      } catch {}
    }
    poll();
    const t = setInterval(poll, 2000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [me]);

  async function respond(id: string, answer: "me" | "not_me" | "will_call") {
    setAnswering(id);
    try {
      await fetch(`/api/checks/${id}/respond`, { method: "POST", body: JSON.stringify({ memberId: me?.memberId, answer }) });
      setPending((p) => p.filter((c) => c.id !== id));
    } finally {
      setAnswering("");
    }
  }

  if (none) return <main className="p-8 text-center text-xl">請先點長輩傳給你的邀請連結加入。</main>;
  if (!family || !me) return null;
  const self = family.members.find((m) => m.id === me.memberId);
  const elder = family.elderName;

  return (
    <main className="mx-auto min-h-full max-w-md bg-orange-50">
      <header className="flex items-center gap-3 bg-orange-500 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white shadow">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-xl border-2 border-white/60" />
        <div className="leading-tight">
          <div className="text-2xl font-extrabold">阿寶通知</div>
          <div className="text-sm opacity-90">
            {self?.name ?? "家人"} · 守護{elder}
          </div>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <div className="text-center">
              {push === "on" ? (
                <div className="inline-block rounded-full bg-green-100 px-4 py-2 text-base font-bold text-green-800">🔔 通知已開啟，手機鎖著也會收到</div>
              ) : push === "needs-install" ? (
                <div className="rounded-2xl bg-orange-100 p-3 text-left text-base text-orange-900">
                  <b>iPhone 要先加入主畫面才能收通知：</b>點 Safari 下方的分享按鈕，選「加入主畫面」，再從主畫面打開阿寶，回到這裡按開啟通知。
                </div>
              ) : push === "denied" ? (
                <div className="rounded-2xl bg-stone-100 p-3 text-base text-stone-600">通知被關掉了。請到手機的設定裡允許阿寶的通知。</div>
              ) : push === "unsupported" ? (
                <button onClick={beep} className="rounded-full bg-orange-100 px-4 py-2 text-base font-bold text-orange-700">
                  🔔 開啟提示音（這個瀏覽器不支援系統通知）
                </button>
              ) : (
                <button onClick={turnOnPush} disabled={pushBusy} className="h-14 rounded-full bg-orange-500 px-6 text-xl font-extrabold text-white shadow disabled:opacity-60">
                  {pushBusy ? "開啟中…" : "🔔 開啟通知"}
                </button>
              )}
            </div>
        {pending.length === 0 && (
          <div className="enter rounded-3xl bg-white p-6 text-center shadow-sm">
            <div className="text-5xl">🛡️</div>
            <div className="mt-2 text-xl font-bold">目前沒有需要你確認的事</div>
            <div className="mt-1 text-base text-stone-500">有人冒充你聯絡{elder}時，阿寶會馬上在這裡問你。</div>
          </div>
        )}

        {pending.map((c) => (
          <div key={c.id} className="alarm rounded-3xl border-2 border-red-500 bg-white p-5 shadow-lg">
            <div className="text-sm font-bold text-red-600">阿寶需要你確認 · Abao needs you</div>
            <div className="title mt-1 text-2xl font-extrabold leading-snug">{c.question || `${elder}收到自稱是你的訊息，是你嗎？`}</div>
            <div className="mt-3 rounded-2xl bg-stone-100 p-3 text-lg text-stone-800">
              {c.thumb && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.thumb} alt="截圖" className="mb-2 max-h-56 rounded-xl" />
              )}
              「{clean(c.analysis.message_summary)}」
              {c.analysis.amount_twd ? <div className="nums mt-1 font-bold text-red-600">要求金額：NT${c.analysis.amount_twd.toLocaleString()}</div> : null}
            </div>
            {c.askKind === "heads_up" ? (
              <button disabled={answering === c.id} onClick={() => respond(c.id, "will_call")} className="mt-4 h-20 w-full rounded-2xl bg-orange-500 text-2xl font-extrabold text-white disabled:opacity-50">
                📞 我現在打給{elder}
              </button>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button disabled={answering === c.id} onClick={() => respond(c.id, "me")} className="h-20 rounded-2xl bg-green-600 text-2xl font-extrabold text-white disabled:opacity-50">
                  ✅ 是我
                </button>
                <button disabled={answering === c.id} onClick={() => respond(c.id, "not_me")} className="h-20 rounded-2xl bg-red-600 text-2xl font-extrabold text-white disabled:opacity-50">
                  ❌ 不是我
                </button>
              </div>
            )}
          </div>
        ))}

        {history.length > 0 && (
          <section>
            <h2 className="mb-2 mt-4 text-lg font-bold text-stone-600">{elder}最近給阿寶看過的</h2>
            <div className="space-y-2">
              {history.map((c) => (
                <div key={c.id} className="enter rounded-2xl bg-white p-3 shadow-sm">
                  <div className="nums flex items-center justify-between text-sm text-stone-500">
                    <span>{new Date(c.createdAt).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="font-bold">{STATUS[c.status]}</span>
                  </div>
                  <div className={`mt-1 text-lg font-bold ${c.analysis.risk === "low" ? "text-green-700" : "text-red-600"}`}>{c.analysis.verdict_zh}</div>
                  <div className="text-base text-stone-600">「{clean(c.analysis.message_summary)}」</div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

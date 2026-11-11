"use client";
import { useEffect, useState } from "react";

// Two real app screens side by side (parent + family member) for demos on one laptop.
export default function Demo() {
  const [ids, setIds] = useState<{ f: string; m: string } | null>(null);
  const [quiet, setQuiet] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    setQuiet(!!q.get("quiet"));
    const f = q.get("f");
    const m = q.get("m");
    if (f && m) return setIds({ f, m });
    (async () => {
     try {
      const fam = await (await fetch("/api/family", { method: "POST", body: JSON.stringify({ elderName: "媽媽" }) })).json();
      const { member } = await (await fetch(`/api/family/${fam.id}/join`, { method: "POST", body: JSON.stringify({ name: "小明", relation: "兒子" }) })).json();
      q.set("f", fam.id);
      q.set("m", member.id);
      history.replaceState(null, "", `/demo?${q}`);
      setIds({ f: fam.id, m: member.id });
     } catch {
      setFailed(true);
     }
    })();
  }, []);

  const W = 390;
  const H = 780;
  const S = 0.8;
  const phone = (id: string, src: string, zh: string, en: string) => (
    <div className="flex flex-col items-center gap-2">
      <div className="text-center leading-tight">
        <div className="text-xl font-extrabold text-stone-800">{zh}</div>
        <div className="text-sm text-stone-500">{en}</div>
      </div>
      <div className="overflow-hidden rounded-[36px] border-[8px] border-stone-900 bg-white shadow-2xl" style={{ width: W * S + 16, height: H * S + 16 }}>
        <iframe id={id} src={src} title={en} allow="microphone" style={{ width: W, height: H, border: 0, transform: `scale(${S})`, transformOrigin: "0 0" }} />
      </div>
    </div>
  );

  return (
    <main className="flex h-dvh items-center justify-center gap-16 overflow-hidden bg-gradient-to-br from-orange-100 to-amber-50">
      {failed && (
        <button onClick={() => location.reload()} className="rounded-full bg-orange-500 px-6 py-3 text-xl font-bold text-white">
          連線失敗，點這裡重試
        </button>
      )}
      {ids && (
        <a href={`/demo${quiet ? "?quiet=1" : ""}`} className="fixed right-3 top-3 rounded-full bg-white/80 px-3 py-1 text-sm text-stone-500 shadow">
          ↻ 重新開始 New demo
        </a>
      )}
      {ids && (
        <>
          {phone("elder", `/?f=${ids.f}&n=${encodeURIComponent("媽媽")}${quiet ? "&quiet=1" : ""}`, "媽媽的手機", "Mom's phone")}
          {phone("family", `/family?f=${ids.f}&m=${ids.m}`, "兒子小明的手機", "Her son's phone")}
        </>
      )}
    </main>
  );
}

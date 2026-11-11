import type { Card } from "@/lib/types";

const callBtn = "flex min-h-14 items-center justify-center rounded-2xl px-4 text-xl font-bold active:scale-95 transition";

export function cardSpeech(card: Card) {
  return [card.title, card.body].filter(Boolean).join("。");
}

export default function CardView({ card, done }: { card: Card; done?: boolean }) {
  if (card.type === "warning")
    return (
      <div className={`${card.call165 ? "alarm" : "pop"} rounded-3xl bg-red-600 p-5 text-white shadow-lg`}>
        <div className="text-[26px] font-extrabold leading-snug">⚠️ {card.title}</div>
        {card.body && <div className="mt-2 text-xl leading-relaxed">{card.body}</div>}
        {card.flags && card.flags.length > 0 && (
          <ul className="mt-3 space-y-1 text-xl">
            {card.flags.map((f) => (
              <li key={f}>• {f}</li>
            ))}
          </ul>
        )}
        {card.en && <div className="mt-3 text-sm opacity-80">{card.en}</div>}
        {card.call165 && (
          <a href="tel:165" className={`${callBtn} mt-4 bg-white text-red-700`}>
            📞 打 165 反詐騙專線
          </a>
        )}
      </div>
    );
  if (card.type === "safe")
    return (
      <div className="pop rounded-3xl bg-green-600 p-5 text-white shadow-lg">
        <div className="text-[26px] font-extrabold leading-snug">✅ {card.title}</div>
        {card.body && <div className="mt-2 text-xl">{card.body}</div>}
        {card.en && <div className="mt-3 text-sm opacity-80">{card.en}</div>}
      </div>
    );
  if (card.type === "waiting")
    return (
      <div className={`pop rounded-3xl border-2 border-amber-400 bg-amber-100 p-5 text-amber-950 shadow ${done ? "opacity-60" : ""}`}>
        <div className="flex items-center gap-3 text-2xl font-extrabold">
          {done ? <span>✔️</span> : <span className="inline-block h-7 w-7 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />}
          {done ? card.title.replace("正在", "已").replace("…", "") : card.title}
        </div>
        {card.body && <div className="mt-2 text-xl">{card.body}</div>}
        {card.en && <div className="mt-3 text-sm opacity-70">{card.en}</div>}
      </div>
    );
  return (
    <div className="pop rounded-3xl border-2 border-sky-300 bg-white p-5 shadow">
      <div className="text-2xl font-extrabold">☎️ {card.title}</div>
      {card.body && <div className="mt-2 text-xl text-stone-700">{card.body}</div>}
      <div className="mt-4 space-y-3">
        {card.contacts.map((c) =>
          c.tel ? (
            <a key={c.label} href={`tel:${c.tel}`} className={`${callBtn} bg-sky-600 text-white`}>
              📞 {c.label}
            </a>
          ) : (
            <div key={c.label} className="rounded-2xl bg-sky-50 p-3 text-lg text-sky-900">
              {c.label}
            </div>
          ),
        )}
      </div>
      {card.en && <div className="mt-3 text-sm text-stone-500">{card.en}</div>}
    </div>
  );
}

"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { save } from "@/lib/client";
import type { Family } from "@/lib/types";

const RELATIONS_EN = ["son", "daughter", "grandson", "granddaughter", "spouse", "other family"];
const RELATIONS = ["兒子", "女兒", "孫子", "孫女", "先生／太太", "其他家人"];

export default function Join() {
  const { familyId } = useParams<{ familyId: string }>();
  const [family, setFamily] = useState<Family | null>(null);
  const [missing, setMissing] = useState(false);
  const [name, setName] = useState("");
  const [relation, setRelation] = useState(RELATIONS[0]);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/family/${familyId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setFamily)
      .catch(() => setMissing(true));
  }, [familyId]);

  async function join() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/family/${familyId}/join`, { method: "POST", body: JSON.stringify({ name: name.trim(), relation: family?.lang === "en" && !RELATIONS_EN.includes(relation) ? RELATIONS_EN[0] : relation, phone }) });
      const { member } = await res.json();
      save("abao.family", { familyId, memberId: member.id, name: member.name });
      // Full page load (not a client transition) so the page carries its own install manifest for "Add to Home Screen".
      location.href = `/family?f=${familyId}&m=${member.id}`;
    } finally {
      setBusy(false);
    }
  }

  if (missing) return <main className="p-8 text-center text-xl">這個邀請連結已經失效，請長輩再傳一次。</main>;
  if (!family) return null;
  const en = family.lang === "en";
  const t = (zh: string, e: string) => (en ? e : zh);
  const relations = en ? RELATIONS_EN : RELATIONS;
  const rel = relations.includes(relation) ? relation : relations[0];

  return (
    <main className="stagger mx-auto flex min-h-full max-w-md flex-col justify-center gap-5 p-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="阿寶" className="mx-auto h-24 w-24 rounded-3xl shadow-lg" />
      <div className="text-center">
        <h1 className="title text-3xl font-extrabold">{en ? `${family.elderName} invited you` : `${family.elderName}邀請你當家人`}</h1>
        <p className="mt-2 text-lg text-stone-600">{en ? `When someone pretends to be you and asks ${family.elderName} for money, Abao asks you “was it you?”. One tap answers it.` : `有人冒充你向${family.elderName}要錢時，阿寶會直接問你「是你嗎？」，你按一下就好。`}</p>
        {!en && <p className="mt-1 text-sm text-stone-400">Abao will ask you directly when someone pretends to be you.</p>}
      </div>
      <label className="text-lg font-bold">
        {en ? `What does ${family.elderName} call you?` : `${family.elderName}都怎麼叫你？`}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("例如：小明", "e.g. Michael")} className="mt-1 h-14 w-full rounded-2xl border-2 border-orange-300 bg-white px-4 text-xl font-normal outline-none focus:border-orange-500" />
      </label>
      <div>
        <div className="text-lg font-bold">{en ? `You are ${family.elderName}’s` : `你是${family.elderName}的`}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {relations.map((r) => (
            <button key={r} onClick={() => setRelation(r)} className={`h-12 rounded-full px-4 text-lg font-bold ${rel === r ? "bg-orange-500 text-white" : "bg-white text-stone-700"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <label className="text-lg font-bold">
        {en ? `Your phone (optional, so ${family.elderName} can call you in one tap)` : `你的電話（選填，讓${family.elderName}一鍵打給你）`}
        <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder={t("09xx-xxx-xxx", "555-123-4567")} className="mt-1 h-14 w-full rounded-2xl border-2 border-orange-300 bg-white px-4 text-xl font-normal outline-none focus:border-orange-500" />
      </label>
      <button onClick={join} disabled={busy || !name.trim()} className="h-16 rounded-2xl bg-orange-500 text-2xl font-extrabold text-white shadow-lg disabled:opacity-50">
        {busy ? t("加入中…", "Joining…") : t("加入", "Join")}
      </button>
    </main>
  );
}

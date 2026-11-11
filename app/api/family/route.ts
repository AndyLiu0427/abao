import { newId, saveFamily } from "@/lib/store";
import type { Family } from "@/lib/types";

export async function POST(req: Request) {
  const { elderName, lang } = await req.json();
  const family: Family = { id: newId(6), elderName: String(elderName || (lang === "en" ? "Mom" : "媽媽")).slice(0, 20), members: [], createdAt: Date.now(), ...(lang === "en" ? { lang: "en" as const } : {}) };
  await saveFamily(family);
  return Response.json(family);
}

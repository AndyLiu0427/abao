import { getChatAfter, getFamily } from "@/lib/store";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const familyId = q.get("familyId") ?? "";
  const after = q.get("after");
  const [family, chat] = await Promise.all([getFamily(familyId), getChatAfter(familyId, after === null ? null : Math.max(0, Number(after) || 0))]);
  if (!family) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ family, ...chat });
}

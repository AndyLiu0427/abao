import { getChat, getFamily } from "@/lib/store";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const familyId = q.get("familyId") ?? "";
  const since = Number(q.get("since") ?? 0);
  const [family, chat] = await Promise.all([getFamily(familyId), getChat(familyId)]);
  if (!family) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json({ family, messages: chat.filter((m) => m.createdAt >= since) });
}

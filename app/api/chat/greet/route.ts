import { greet } from "@/lib/agent";
import { getChat, getFamily } from "@/lib/store";

export const maxDuration = 60;
const day = (t: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date(t));

export async function POST(req: Request) {
  const { familyId } = await req.json();
  const family = await getFamily(String(familyId ?? ""));
  if (!family) return Response.json({ error: "not_found" }, { status: 404 });
  const chat = await getChat(family.id);
  const last = chat[chat.length - 1];
  if (last && day(last.createdAt) === day(Date.now())) return Response.json({ message: null });
  return Response.json({ message: await greet(family) });
}

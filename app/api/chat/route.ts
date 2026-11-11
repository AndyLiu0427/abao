import { failSafeMessages, runAgent } from "@/lib/agent";
import { getFamily, newId, pushChat } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json();
  const family = await getFamily(String(body.familyId ?? ""));
  if (!family) return Response.json({ error: "not_found" }, { status: 404 });

  const userMessage: ChatMessage = {
    id: String(body.id || newId()),
    role: "user",
    text: body.text ? String(body.text).slice(0, 4000) : undefined,
    imageUrl: body.thumb ? String(body.thumb) : undefined,
    createdAt: Date.now(),
  };
  await pushChat(family.id, userMessage);

  try {
    const messages = await runAgent({ family, userMessage, imageBase64: body.imageBase64, mediaType: body.mediaType });
    return Response.json({ messages: [userMessage, ...messages] });
  } catch (e) {
    console.error(e);
    const messages = failSafeMessages(family.lang);
    for (const m of messages) await pushChat(family.id, m);
    return Response.json({ messages: [userMessage, ...messages] });
  }
}

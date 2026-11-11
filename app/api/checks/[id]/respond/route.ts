import { getCheck, newId, pushChat, saveCheck } from "@/lib/store";
import type { ChatMessage } from "@/lib/types";

// The family member's answer does not go through the model: it is written straight
// into the parent's chat as a proactive Abao message.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { answer } = await req.json();
  const check = await getCheck(id);
  if (!check) return Response.json({ error: "not_found" }, { status: 404 });
  if (check.status !== "waiting") return Response.json(check);

  const name = check.askedName ?? "家人";
  const notMe = answer === "not_me";
  check.status = notMe ? "confirmed_not_me" : "confirmed_me";
  check.answeredAt = Date.now();
  await saveCheck(check);

  const message: ChatMessage = {
    id: newId(),
    role: "abao",
    createdAt: Date.now(),
    card: notMe
      ? { type: "warning", title: `${name}說那不是本人！`, body: "這是詐騙。千萬不要匯款，也不要再回對方。", en: `${name} says it was NOT them. Do not send money.`, call165: true }
      : { type: "safe", title: `${name}確認是本人`, body: "可以放心了。", en: `${name} confirmed it was really them.` },
  };
  await pushChat(check.familyId, message);
  return Response.json(check);
}

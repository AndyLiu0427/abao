import { notifyMember } from "@/lib/push";
import { addPushSub, getFamily } from "@/lib/store";

export async function POST(req: Request) {
  const { familyId, memberId, subscription } = await req.json();
  const family = await getFamily(String(familyId ?? ""));
  const member = family?.members.find((m) => m.id === memberId);
  if (!family || !member || !subscription?.endpoint || !subscription?.keys) return Response.json({ error: "bad_request" }, { status: 400 });
  await addPushSub(family.id, member.id, { endpoint: subscription.endpoint, keys: subscription.keys });
  const sent = await notifyMember(family.id, member.id, {
    title: "阿寶通知已開啟",
    body: `有人冒充你聯絡${family.elderName}時，阿寶會在這裡通知你。`,
    url: `/family?f=${family.id}&m=${member.id}`,
  });
  return Response.json({ ok: true, sent });
}

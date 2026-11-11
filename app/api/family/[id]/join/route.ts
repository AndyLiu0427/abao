import { getFamily, newId, saveFamily } from "@/lib/store";
import type { Member } from "@/lib/types";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const family = await getFamily(id);
  if (!family) return Response.json({ error: "not_found" }, { status: 404 });
  const { name, relation, phone } = await req.json();
  const member: Member = {
    id: newId(6),
    name: String(name || "家人").slice(0, 20),
    relation: String(relation || "family").slice(0, 20),
    phone: phone ? String(phone).replace(/[^\d+]/g, "").slice(0, 20) : undefined,
  };
  family.members.push(member);
  await saveFamily(family);
  return Response.json({ family, member });
}

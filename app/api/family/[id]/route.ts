import { getFamily } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const family = await getFamily(id);
  if (!family) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(family);
}

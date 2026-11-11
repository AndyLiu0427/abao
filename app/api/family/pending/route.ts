import { getFamily, listChecks } from "@/lib/store";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const familyId = q.get("familyId") ?? "";
  const memberId = q.get("memberId") ?? "";
  const family = await getFamily(familyId);
  if (!family) return Response.json({ error: "not_found" }, { status: 404 });
  const checks = await listChecks(familyId);
  return Response.json({
    family,
    pending: checks.filter((c) => c.status === "waiting" && c.askedMemberId === memberId),
    history: checks.filter((c) => !(c.status === "waiting" && c.askedMemberId === memberId)).slice(0, 10),
  });
}

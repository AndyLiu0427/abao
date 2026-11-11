import { storageKind } from "@/lib/store";

export async function GET() {
  return Response.json({ ok: true, storage: storageKind, aiKey: !!process.env.ANTHROPIC_API_KEY, model: process.env.ABAO_MODEL || "claude-fable-5-2" });
}

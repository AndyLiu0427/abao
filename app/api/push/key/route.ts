import { getVapid } from "@/lib/push";

export async function GET() {
  return Response.json({ publicKey: (await getVapid()).publicKey });
}

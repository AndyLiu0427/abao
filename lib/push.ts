import * as webpush from "web-push";
import { getOrCreate, getPushSubs, setPushSubs } from "./store";

type Vapid = { publicKey: string; privateKey: string };
export const getVapid = () => getOrCreate<Vapid>("vapid", () => webpush.generateVAPIDKeys());

/** System notification to a family member's devices, so it reaches them with the app closed. Never throws. */
export async function notifyMember(familyId: string, memberId: string, payload: { title: string; body: string; url: string }) {
  try {
    const subs = await getPushSubs(familyId, memberId);
    if (!subs.length) return 0;
    const vapid = await getVapid();
    const options = { vapidDetails: { subject: "https://abao.vercel.app", ...vapid }, TTL: 600, urgency: "high" as const, timeout: 5000 };
    const gone: string[] = [];
    const results = await Promise.all(
      subs.map((sub) =>
        webpush.sendNotification(sub, JSON.stringify(payload), options).then(
          () => true,
          (e: { statusCode?: number }) => {
            if (e?.statusCode === 404 || e?.statusCode === 410) gone.push(sub.endpoint);
            else console.error("push failed:", e?.statusCode);
            return false;
          },
        ),
      ),
    );
    if (gone.length) await setPushSubs(familyId, memberId, subs.filter((s) => !gone.includes(s.endpoint)));
    return results.filter(Boolean).length;
  } catch (e) {
    console.error("push error:", e);
    return 0;
  }
}

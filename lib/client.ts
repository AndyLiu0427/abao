"use client";

export type ElderId = { familyId: string; name: string };
export type FamilyId = { familyId: string; memberId: string; name: string };

export function load<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function speak(text: string) {
  try {
    if (!("speechSynthesis" in window) || typeof text !== "string") return;
    // An empty call (from a tap) still speaks a blank utterance: that is what unlocks speech on iOS.
    const u = new SpeechSynthesisUtterance(text || " ");
    u.lang = "zh-TW";
    u.rate = 0.95;
    const voice = speechSynthesis.getVoices().find((v) => v.lang.replace("_", "-").startsWith("zh-TW"));
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  } catch {}
}
export function stopSpeaking() {
  try {
    speechSynthesis.cancel();
  } catch {}
}

function scale(img: HTMLImageElement, max: number, quality: number) {
  const r = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * r);
  c.height = Math.round(img.height * r);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}
/** Downscale a photo in the browser: one copy for the model, one small thumbnail to store. */
export async function prepareImage(file: File): Promise<{ imageBase64: string; thumb: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = url;
    });
    return { imageBase64: scale(img, 1500, 0.85).split(",")[1], thumb: scale(img, 420, 0.7) };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.2;
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.15);
    });
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
}

export type PushState = "unsupported" | "needs-install" | "off" | "on" | "denied";
const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

// Registers the worker itself if the page has not done so yet, so the button never waits forever.
async function swReady() {
  if (!(await navigator.serviceWorker.getRegistration())) await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export async function pushState(): Promise<PushState> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return isIos() && !isStandalone() ? "needs-install" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  const reg = await swReady();
  return (await reg.pushManager.getSubscription()) && Notification.permission === "granted" ? "on" : "off";
}

/** Must be called from a tap: asks permission, subscribes this device, and registers it for the member. */
export async function enablePush(familyId: string, memberId: string): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await swReady();
  const { publicKey } = await (await fetch("/api/push/key")).json();
  const raw = atob(publicKey.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(publicKey.length / 4) * 4, "="));
  const key = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  const existing = await reg.pushManager.getSubscription();
  const subscription = existing ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }));
  const res = await fetch("/api/push/subscribe", { method: "POST", body: JSON.stringify({ familyId, memberId, subscription: subscription.toJSON() }) });
  return res.ok ? "on" : "off";
}
export function clearBadge() {
  try {
    (navigator as unknown as { clearAppBadge?: () => Promise<void> }).clearAppBadge?.().catch(() => {});
  } catch {}
}

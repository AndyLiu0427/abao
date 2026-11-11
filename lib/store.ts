import { Redis } from "@upstash/redis";
import type { ChatMessage, Check, Family } from "./types";

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;
export const storageKind = redis ? "redis" : "memory";

// In-memory fallback for local development only (serverless memory is not shared).
const g = globalThis as unknown as { __abaoMem?: Map<string, unknown> };
const mem = (g.__abaoMem ??= new Map<string, unknown>());

async function get<T>(key: string): Promise<T | null> {
  if (redis) return (await redis.get<T>(key)) ?? null;
  return (mem.get(key) as T) ?? null;
}
async function set(key: string, value: unknown) {
  if (redis) await redis.set(key, value);
  else mem.set(key, value);
}
async function push(key: string, value: unknown) {
  if (redis) await redis.rpush(key, value);
  else mem.set(key, [...((mem.get(key) as unknown[]) ?? []), value]);
}
async function list<T>(key: string, start = 0, end = -1): Promise<T[]> {
  if (redis) return await redis.lrange<T>(key, start, end);
  const arr = (mem.get(key) as T[]) ?? [];
  return end === -1 ? arr.slice(start < 0 ? start : start) : arr.slice(start, end + 1);
}

export const newId = (n = 10) =>
  Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => "abcdefghjkmnpqrstuvwxyz23456789"[b % 31]).join("");

export const getFamily = (id: string) => get<Family>(`family:${id}`);
export const saveFamily = (f: Family) => set(`family:${f.id}`, f);

export const getChat = (familyId: string) => list<ChatMessage>(`chat:${familyId}`, -60, -1);
export const pushChat = (familyId: string, m: ChatMessage) => push(`chat:${familyId}`, m);

export const getCheck = (id: string) => get<Check>(`check:${id}`);
export async function saveCheck(c: Check, isNew = false) {
  await set(`check:${c.id}`, c);
  if (isNew) await push(`checks:${c.familyId}`, c.id);
}
export async function listChecks(familyId: string): Promise<Check[]> {
  const ids = await list<string>(`checks:${familyId}`, -20, -1);
  const checks = await Promise.all(ids.map((id) => getCheck(id)));
  return checks.filter((c): c is Check => !!c).reverse();
}

export const getMemory = (familyId: string) => list<string>(`memory:${familyId}`, -30, -1);
export const addMemory = (familyId: string, fact: string) => push(`memory:${familyId}`, fact);

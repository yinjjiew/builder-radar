import OpenAI from "openai";

/**
 * One place that decides which model answers. Any OpenAI-compatible provider
 * works through OPENAI_BASE_URL; unset, the SDK talks to OpenAI itself.
 */
export function hasAi() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export function aiModel() {
  // `||` rather than `??`: a blank OPENAI_MODEL must fall back, not send "".
  return process.env.OPENAI_MODEL?.trim() || "gpt-5-mini";
}

export function getAiClient() {
  if (!hasAi()) throw new Error("OPENAI_API_KEY is not configured");
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined,
    maxRetries: 2
  });
}

/**
 * Model output is a hint, never a source of truth, so a malformed answer must
 * degrade to null instead of aborting a run.
 */
export function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function asText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function asScore(value: unknown, fallback: number | null = null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Keeps only values the closed vocabulary allows, so aggregates never fragment. */
export function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function asEnumList<T extends string>(
  value: unknown,
  allowed: readonly T[],
  limit = 4
): T[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<T>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    if (!(allowed as readonly string[]).includes(entry)) continue;
    seen.add(entry as T);
    if (seen.size >= limit) break;
  }
  return [...seen];
}

export function asTextList(value: unknown, limit = 6, maxLength = 120) {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const entry of value) {
    const text = asText(entry);
    if (!text) continue;
    out.push(text.slice(0, maxLength));
    if (out.length >= limit) break;
  }
  return out;
}

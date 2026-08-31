/**
 * Puts the approved roster into a private X List, on behalf of the account that
 * owns the credentials.
 *
 * Why a List rather than following: sixty prolific accounts would drown the
 * owner's home timeline, a List is a separate timeline holding only them, and a
 * private List does not publish who is being watched — which matters for a
 * project that is behind a password on purpose.
 *
 * ## Authentication is different from the rest of the codebase
 *
 * `lib/x.ts` uses the app-only Bearer token, which can read anything public and
 * write nothing. Acting *as* an account requires user context, so this script
 * signs every request with OAuth 1.0a (HMAC-SHA1) using four values from the
 * developer portal. The app's permissions must be set to "Read and write"
 * *before* the access token is generated; a token minted under read-only
 * permissions stays read-only and has to be regenerated.
 *
 * ## The follow endpoint is tested, not assumed
 *
 * X removed follow/like/quote writes from the self-serve tiers on 20 April 2026,
 * which would make `POST /2/users/:id/following` unavailable on pay-per-use. That
 * was announced in a developer forum post rather than the docs, so the script
 * spends exactly one call finding out first-hand and reports the answer instead
 * of trusting the write-up. A single call is cheap; being wrong in either
 * direction is not.
 *
 * Usage:
 *   X_API_KEY=… X_API_SECRET=… X_ACCESS_TOKEN=… X_ACCESS_SECRET=… \
 *     npx tsx scripts/x-list.mts [--follow-test-handle=MengTo] [--no-follow-test]
 */
import crypto from "node:crypto";
import { getDb } from "../lib/db";

const API = "https://api.x.com";
const LIST_NAME = "Builder Radar roster";
const LIST_DESCRIPTION =
  "The approved builders tracked by Builder Radar. Maintained by scripts/x-list.mts.";

/** Milliseconds between member adds. Well inside any window, and unhurried
 *  enough that sixty writes do not look like a burst. */
const PACE_MS = 900;

type Creds = {
  apiKey: string;
  apiSecret: string;
  accessToken: string;
  accessSecret: string;
};

function readCreds(): Creds {
  const missing: string[] = [];
  const need = (name: string) => {
    const value = process.env[name]?.trim();
    if (!value) missing.push(name);
    return value ?? "";
  };
  const creds = {
    apiKey: need("X_API_KEY"),
    apiSecret: need("X_API_SECRET"),
    accessToken: need("X_ACCESS_TOKEN"),
    accessSecret: need("X_ACCESS_SECRET")
  };
  if (missing.length) {
    throw new Error(
      `Missing ${missing.join(", ")}. Generate all four in the X developer portal ` +
        `under Keys and tokens, with the app set to Read and write first.`
    );
  }
  return creds;
}

/**
 * OAuth 1.0a wants RFC 3986, and `encodeURIComponent` leaves six characters
 * alone that the spec requires escaped. Missing this produces a signature that
 * is correct for every handle without punctuation and fails for the rest.
 */
function rfc3986(value: string) {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

/**
 * Builds the Authorization header for one request.
 *
 * A JSON request body is deliberately absent from the signature base string:
 * OAuth 1.0a only signs `oauth_*` parameters plus query-string parameters, and
 * folding the body in is the single most common reason these calls return 401.
 */
export function authHeader(
  creds: Creds,
  method: string,
  url: string,
  // Injectable only so the signature can be checked against the published
  // OAuth 1.0a test vector, where both are fixed. See scripts/x-list.test.mts.
  fixed?: { nonce: string; timestamp: string }
) {
  const parsed = new URL(url);
  const oauth: Record<string, string> = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: fixed?.nonce ?? crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: fixed?.timestamp ?? Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: "1.0"
  };

  const all: Record<string, string> = { ...oauth };
  parsed.searchParams.forEach((value, key) => {
    all[key] = value;
  });

  const normalised = Object.keys(all)
    .sort()
    .map((key) => `${rfc3986(key)}=${rfc3986(all[key])}`)
    .join("&");

  const base = [
    method.toUpperCase(),
    rfc3986(`${parsed.origin}${parsed.pathname}`),
    rfc3986(normalised)
  ].join("&");

  const signingKey = `${rfc3986(creds.apiSecret)}&${rfc3986(creds.accessSecret)}`;
  oauth.oauth_signature = crypto.createHmac("sha1", signingKey).update(base).digest("base64");

  const header = Object.keys(oauth)
    .sort()
    .map((key) => `${rfc3986(key)}="${rfc3986(oauth[key])}"`)
    .join(", ");

  return `OAuth ${header}`;
}

type XResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  detail: string;
};

async function call<T>(
  creds: Creds,
  method: string,
  path: string,
  body?: unknown
): Promise<XResult<T>> {
  const url = `${API}${path}`;
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(creds, method, url),
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const text = await response.text();
  let parsed: Record<string, unknown> = {};
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text.slice(0, 300) };
  }

  if (response.status === 429) {
    const reset = Number(response.headers.get("x-rate-limit-reset"));
    const waitMs = Number.isFinite(reset)
      ? Math.max(reset * 1000 - Date.now() + 2000, 5000)
      : 60_000;
    console.log(`  rate limited, waiting ${Math.ceil(waitMs / 1000)}s`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return call<T>(creds, method, path, body);
  }

  const detail =
    (parsed.detail as string) ??
    (parsed.title as string) ??
    (Array.isArray(parsed.errors) ? JSON.stringify(parsed.errors[0]) : "") ??
    text.slice(0, 200);

  return {
    ok: response.ok,
    status: response.status,
    data: (parsed.data as T) ?? null,
    detail: detail || `HTTP ${response.status}`
  };
}

const argFor = (name: string) =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

async function main() {
  const creds = readCreds();
  const sql = getDb();

  const roster = await sql<Array<{ username: string; x_user_id: string }>>`
    select username, x_user_id
    from creators
    where status = 'approved' and x_user_id is not null
    order by followers_count desc nulls last
  `;
  console.log(`roster: ${roster.length} approved builders with a user id`);

  // Whose account is this? Also the cheapest possible proof the four values work
  // together, before anything is written.
  const me = await call<{ id: string; username: string; name: string }>(
    creds,
    "GET",
    "/2/users/me"
  );
  if (!me.ok || !me.data) {
    throw new Error(
      `Could not authenticate as a user (HTTP ${me.status}): ${me.detail}\n` +
        `A 401 here usually means the access token was generated before the app was ` +
        `set to Read and write, or that one of the four values has a stray space.`
    );
  }
  console.log(`authenticated as @${me.data.username} (${me.data.name})`);

  // --- Does the follow endpoint still exist for this account? ---------------
  let followVerdict = "not tested";
  if (!process.argv.includes("--no-follow-test")) {
    const handle = argFor("follow-test-handle") ?? roster[0]?.username;
    const target = roster.find((row) => row.username.toLowerCase() === handle?.toLowerCase());
    if (!target) {
      followVerdict = `skipped: @${handle} is not on the roster`;
    } else {
      const attempt = await call<{ following: boolean; pending_follow: boolean }>(
        creds,
        "POST",
        `/2/users/${me.data.id}/following`,
        { target_user_id: target.x_user_id }
      );
      if (attempt.ok && attempt.data) {
        followVerdict =
          `WORKS — now following @${target.username}` +
          (attempt.data.pending_follow ? " (request pending, account is protected)" : "");
      } else if (attempt.status === 403 || attempt.status === 453) {
        followVerdict = `unavailable on this access tier (HTTP ${attempt.status}): ${attempt.detail}`;
      } else {
        followVerdict = `failed (HTTP ${attempt.status}): ${attempt.detail}`;
      }
    }
    console.log(`follow endpoint: ${followVerdict}`);
  }

  // --- Find or create the List ---------------------------------------------
  const owned = await call<Array<{ id: string; name: string }>>(
    creds,
    "GET",
    `/2/users/${me.data.id}/owned_lists?max_results=100`
  );
  let listId = (owned.data ?? []).find((list) => list.name === LIST_NAME)?.id ?? null;

  if (listId) {
    console.log(`reusing existing list "${LIST_NAME}" (${listId})`);
  } else {
    const created = await call<{ id: string }>(creds, "POST", "/2/lists", {
      name: LIST_NAME,
      description: LIST_DESCRIPTION,
      private: true
    });
    if (!created.ok || !created.data) {
      throw new Error(`Could not create the list (HTTP ${created.status}): ${created.detail}`);
    }
    listId = created.data.id;
    console.log(`created private list "${LIST_NAME}" (${listId})`);
  }

  // Existing members, so a re-run does not re-post sixty writes.
  const members = await call<Array<{ id: string; username: string }>>(
    creds,
    "GET",
    `/2/lists/${listId}/members?max_results=100`
  );
  const already = new Set((members.data ?? []).map((row) => row.id));
  if (already.size) console.log(`already in the list: ${already.size}`);

  const todo = roster.filter((row) => !already.has(row.x_user_id));
  console.log(`adding ${todo.length}\n`);

  let added = 0;
  const failures: Array<{ username: string; reason: string }> = [];

  for (const [index, row] of todo.entries()) {
    const result = await call<{ is_member: boolean }>(
      creds,
      "POST",
      `/2/lists/${listId}/members`,
      { user_id: row.x_user_id }
    );
    if (result.ok) {
      added += 1;
      console.log(`  ${index + 1}/${todo.length}  @${row.username}`);
    } else {
      failures.push({ username: row.username, reason: `HTTP ${result.status}: ${result.detail}` });
      console.log(`  ${index + 1}/${todo.length}  @${row.username} — FAILED ${result.status}`);
    }
    if (index < todo.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, PACE_MS));
    }
  }

  console.log(`\nadded ${added} of ${todo.length}`);
  if (failures.length) {
    console.log("failures:");
    failures.forEach((f) => console.log(`  @${f.username}: ${f.reason}`));
  }
  console.log(`\nlist: https://x.com/i/lists/${listId}`);
  console.log(`follow endpoint verdict: ${followVerdict}`);

  await sql.end();
}

// Guarded so the signing helper above can be imported and checked without the
// script trying to talk to X.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop() ?? "\0")) {
  main().catch((error) => {
    console.error(`\n${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
}

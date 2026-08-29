import { headers } from "next/headers";
import { ROLE_HEADER } from "@/proxy";

/**
 * Whether the current request came in on the admin credentials.
 *
 * The value is set by the gate in `proxy.ts`, which overwrites whatever the
 * caller sent, so it cannot be forged from outside. Pages use it to decide
 * whether to render curation controls; every mutating action calls
 * `requireAdmin` instead, because hiding a button does not protect the action
 * behind it — a server action is an HTTP endpoint reachable on its own.
 */
export async function isAdmin() {
  const store = await headers();
  return store.get(ROLE_HEADER) === "admin";
}

export class NotAdminError extends Error {
  constructor() {
    super("Admin credentials are required for this action.");
    this.name = "NotAdminError";
  }
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new NotAdminError();
}

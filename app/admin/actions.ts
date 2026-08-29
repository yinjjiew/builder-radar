"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/role";

/**
 * These were previously protected only by living on `/admin`, which the gate
 * restricts to admin credentials. That is no longer sufficient: the same actions
 * are now reachable from pages the read-only viewing password can open, and a
 * server action is posted to whichever route rendered it.
 *
 * Adding a builder used to live here too. It moved to the directory page, which
 * is the only form that asks for the tags a builder is required to have, and
 * keeping a second path that skipped them would have quietly reintroduced the
 * untagged rows this was meant to prevent.
 */

export async function setCreatorStatus(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["approved", "paused", "removed"].includes(status)) return;

  const sql = getDb();
  await sql`
    update creators
    set status = ${status}, updated_at = now()
    where id = ${id}
  `;

  revalidatePath("/");
  revalidatePath("/admin");
}

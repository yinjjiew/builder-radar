"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/role";
import { lookupUsersByUsernames, type XUser } from "@/lib/x";
import { normalizeUsername } from "@/lib/username";
import type { CreatorStatus } from "@/lib/types";

/**
 * These were previously protected only by living on `/admin`, which the gate
 * restricts to admin credentials. That is no longer sufficient: the same actions
 * are now reachable from pages the read-only viewing password can open, and a
 * server action is posted to whichever route rendered it.
 */

export async function addCreator(formData: FormData) {
  await requireAdmin();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  if (!username) {
    redirect("/admin?error=Enter+a+valid+X+username.");
  }

  const sql = getDb();
  const [existing] = await sql<{ status: CreatorStatus }[]>`
    select status from creators where lower(username) = lower(${username})
  `;
  if (existing?.status === "approved") {
    redirect(`/admin?error=@${username}+is+already+in+the+directory.`);
  }

  // Best effort: fill in the real profile now so the row is not blank until the
  // next scheduled sync. One user read is billable, so a failure is not fatal.
  let profile: XUser | undefined;
  try {
    [profile] = await lookupUsersByUsernames([username]);
  } catch {
    profile = undefined;
  }

  await sql`
    insert into creators (
      x_user_id, username, name, description, profile_image_url,
      followers_count, verified, status
    ) values (
      ${profile?.id ?? null}, ${profile?.username ?? username},
      ${profile?.name ?? username}, ${profile?.description ?? ""},
      ${profile?.profile_image_url ?? null},
      ${profile?.public_metrics?.followers_count ?? null},
      ${profile?.verified ?? false}, 'approved'
    )
    on conflict (username) do update set
      status = 'approved',
      x_user_id = coalesce(excluded.x_user_id, creators.x_user_id),
      updated_at = now()
  `;

  revalidatePath("/");
  revalidatePath("/admin");
  redirect(
    profile
      ? `/admin?added=@${username}+added+to+the+directory.`
      : `/admin?added=@${username}+added.+Details+fill+in+on+the+next+sync.`
  );
}

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

export async function reviewCandidate(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  if (!id || !["approved", "rejected"].includes(decision)) return;

  const sql = getDb();
  if (decision === "approved") {
    await sql.begin(async (transaction) => {
      const [candidate] = await transaction<
        Array<{
          x_user_id: string;
          username: string;
          name: string;
          description: string;
          profile_image_url: string | null;
          followers_count: number;
        }>
      >`select * from discovery_candidates where id = ${id}`;
      if (!candidate) return;

      await transaction`
        insert into creators (
          x_user_id, username, name, description, profile_image_url,
          followers_count, status
        ) values (
          ${candidate.x_user_id}, ${candidate.username}, ${candidate.name},
          ${candidate.description}, ${candidate.profile_image_url},
          ${candidate.followers_count}, 'approved'
        )
        on conflict (username) do update set
          status = 'approved', x_user_id = excluded.x_user_id,
          name = excluded.name, description = excluded.description,
          profile_image_url = excluded.profile_image_url,
          followers_count = excluded.followers_count,
          updated_at = now()
      `;
      await transaction`
        update discovery_candidates
        set status = 'approved', reviewed_at = now(), updated_at = now()
        where id = ${id}
      `;
    });
  } else {
    await sql`
      update discovery_candidates
      set status = 'rejected', reviewed_at = now(), updated_at = now()
      where id = ${id}
    `;
  }

  revalidatePath("/");
  revalidatePath("/admin");
}

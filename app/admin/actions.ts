"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";

export async function reviewCandidate(formData: FormData) {
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

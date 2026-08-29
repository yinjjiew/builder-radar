"use server";

import { revalidatePath } from "next/cache";
import {
  addPostByLink,
  addUpByLink,
  blockPost,
  removeUp,
  restoreUp,
  setCreatorTags,
  setPostCategories,
  unblockPost,
  type CurateResult,
} from "@/lib/curate";
import { requireAdmin } from "@/lib/role";

/**
 * Every action here re-checks the credential tier.
 *
 * A server action is an HTTP endpoint in its own right: it is reachable by anyone
 * who can reach the page it was defined on, whether or not that page chose to
 * render its button. Since the read-only viewing password opens `/` and `/posts`,
 * where these controls live, hiding the buttons is presentation only and the
 * check below is the actual protection.
 */

/**
 * Every page that reads tags is invalidated after every edit, which is what makes
 * a correction show up in both rankings on the next page view rather than at the
 * next six-hour cycle. The pages compute their statistics per request, so there
 * is no cached number to go stale behind them.
 */
const PATHS = ["/", "/posts", "/categories", "/review", "/admin"];

function refresh<T extends CurateResult>(result: T): T {
  for (const path of PATHS) revalidatePath(path);
  return result;
}

/**
 * Reads the tag selects out of a form. The controls are two named slots rather
 * than a multi-select because a fixed maximum of two is easier to use and to
 * validate than a list that has to be trimmed after the fact; the sanitiser drops
 * blanks, duplicates and anything outside the vocabulary.
 */
function tagsFrom(formData: FormData) {
  return formData
    .getAll("tag")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

/**
 * Each action returns its outcome instead of redirecting with it. The caller
 * renders that string beside the control through `ActionForm`, which is what
 * keeps a save from scrolling the page; see the note there.
 */

export async function deletePostAction(
  _previous: CurateResult | null,
  formData: FormData,
): Promise<CurateResult> {
  await requireAdmin();
  const postId = String(formData.get("postId") ?? "").trim();
  if (!postId) return { ok: false, message: "No post specified." };
  return refresh(await blockPost(postId));
}

export async function addPostAction(
  _previous: CurateResult | null,
  formData: FormData,
): Promise<CurateResult> {
  await requireAdmin();
  const link = String(formData.get("link") ?? "");
  return refresh(await addPostByLink(link));
}

export async function unblockPostAction(
  _previous: CurateResult | null,
  formData: FormData,
): Promise<CurateResult> {
  await requireAdmin();
  const postId = String(formData.get("postId") ?? "").trim();
  if (!postId) return { ok: false, message: "No post specified." };
  return refresh(await unblockPost(postId));
}

export async function addUpAction(
  _previous: CurateResult | null,
  formData: FormData,
): Promise<CurateResult> {
  await requireAdmin();
  const link = String(formData.get("link") ?? "");
  const note = String(formData.get("note") ?? "");
  return refresh(await addUpByLink(link, tagsFrom(formData), note));
}

export async function setCreatorTagsAction(
  _previous: CurateResult | null,
  formData: FormData,
): Promise<CurateResult> {
  await requireAdmin();
  const creatorId = String(formData.get("creatorId") ?? "").trim();
  const note = String(formData.get("note") ?? "");
  if (!creatorId) return { ok: false, message: "No builder specified." };
  return refresh(await setCreatorTags(creatorId, tagsFrom(formData), note));
}

export async function setPostCategoriesAction(
  _previous: CurateResult | null,
  formData: FormData,
): Promise<CurateResult> {
  await requireAdmin();
  const postId = String(formData.get("postId") ?? "").trim();
  if (!postId) return { ok: false, message: "No post specified." };
  return refresh(await setPostCategories(postId, tagsFrom(formData)));
}

export async function removeUpAction(
  _previous: CurateResult | null,
  formData: FormData,
): Promise<CurateResult> {
  await requireAdmin();
  const creatorId = String(formData.get("creatorId") ?? "").trim();
  if (!creatorId) return { ok: false, message: "No builder specified." };
  return refresh(await removeUp(creatorId));
}

export async function restoreUpAction(
  _previous: CurateResult | null,
  formData: FormData,
): Promise<CurateResult> {
  await requireAdmin();
  const creatorId = String(formData.get("creatorId") ?? "").trim();
  if (!creatorId) return { ok: false, message: "No builder specified." };
  return refresh(await restoreUp(creatorId));
}

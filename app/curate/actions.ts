"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addPostByLink,
  addUpByLink,
  blockPost,
  removeUp,
  restoreUp,
  unblockPost,
  type CurateResult
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

const PATHS = ["/", "/posts", "/categories", "/admin"];

function refresh() {
  for (const path of PATHS) revalidatePath(path);
}

/**
 * Feedback travels in the query string because these forms are plain server
 * actions with no client state. `redirect` throws, so it must run after the work
 * and outside any try block.
 */
function finish(result: CurateResult, returnTo: string): never {
  refresh();
  const key = result.ok ? "done" : "error";
  const separator = returnTo.includes("?") ? "&" : "?";
  redirect(`${returnTo}${separator}${key}=${encodeURIComponent(result.message)}`);
}

function target(formData: FormData, fallback: string) {
  const raw = String(formData.get("returnTo") ?? "").trim();
  // Only same-site paths: a form field must not be able to bounce the owner to
  // another origin after an action.
  if (!raw.startsWith("/") || raw.startsWith("//")) return fallback;
  return raw;
}

export async function deletePostAction(formData: FormData) {
  await requireAdmin();
  const postId = String(formData.get("postId") ?? "").trim();
  const returnTo = target(formData, "/posts");
  if (!postId) finish({ ok: false, message: "No post specified." }, returnTo);
  finish(await blockPost(postId), returnTo);
}

export async function addPostAction(formData: FormData) {
  await requireAdmin();
  const link = String(formData.get("link") ?? "");
  const returnTo = target(formData, "/posts");
  finish(await addPostByLink(link), returnTo);
}

export async function unblockPostAction(formData: FormData) {
  await requireAdmin();
  const postId = String(formData.get("postId") ?? "").trim();
  const returnTo = target(formData, "/admin");
  if (!postId) finish({ ok: false, message: "No post specified." }, returnTo);
  finish(await unblockPost(postId), returnTo);
}

export async function addUpAction(formData: FormData) {
  await requireAdmin();
  const link = String(formData.get("link") ?? "");
  const returnTo = target(formData, "/");
  finish(await addUpByLink(link), returnTo);
}

export async function removeUpAction(formData: FormData) {
  await requireAdmin();
  const creatorId = String(formData.get("creatorId") ?? "").trim();
  const returnTo = target(formData, "/");
  if (!creatorId) finish({ ok: false, message: "No builder specified." }, returnTo);
  finish(await removeUp(creatorId), returnTo);
}

export async function restoreUpAction(formData: FormData) {
  await requireAdmin();
  const creatorId = String(formData.get("creatorId") ?? "").trim();
  const returnTo = target(formData, "/admin");
  if (!creatorId) finish({ ok: false, message: "No builder specified." }, returnTo);
  finish(await restoreUp(creatorId), returnTo);
}

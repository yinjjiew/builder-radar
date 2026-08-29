"use client";

import { useActionState } from "react";
import type { CurateResult } from "@/lib/curate";

export type FormAction = (
  previous: CurateResult | null,
  formData: FormData,
) => Promise<CurateResult>;

/**
 * A form whose result comes back in place.
 *
 * These forms used to end in a redirect carrying the outcome in the query
 * string, which is the standard shape for a server action but the wrong one
 * here: a redirect is a navigation, a navigation resets the scroll position, and
 * the work these forms exist for is re-tagging several hundred posts one row at
 * a time. Every save threw the reviewer back to the top of the page and made
 * them find their place again.
 *
 * Binding the action through `useActionState` posts it without navigating, so
 * the revalidated markup swaps in underneath an unmoved viewport and the outcome
 * lands next to the button that caused it rather than in a banner far above it.
 * Without scripting the form still submits as an ordinary POST and the page
 * reloads, which is the same behaviour as before.
 */
export function ActionForm({
  action,
  className,
  children,
}: {
  action: FormAction;
  className?: string;
  children: React.ReactNode;
}) {
  const [result, submit, pending] = useActionState<
    CurateResult | null,
    FormData
  >(action, null);

  return (
    <form action={submit} className={className}>
      {/* Disabling the set rather than the button covers every control the caller
          passed in, and `display: contents` keeps the caller's own layout. */}
      <fieldset className="form-fields" disabled={pending}>
        {children}
      </fieldset>
      {result ? (
        <span
          className={
            result.ok ? "form-note form-note-ok" : "form-note form-note-bad"
          }
          role="status"
        >
          {result.message}
        </span>
      ) : null}
    </form>
  );
}

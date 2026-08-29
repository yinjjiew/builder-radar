import { productCategoryLabel, WORK_KINDS } from "@/lib/mission";

/**
 * The two tag slots, used for both a builder and a post.
 *
 * Two named selects rather than a multi-select or a row of checkboxes. A
 * multi-select is unusable on a phone and invisible about its own maximum; a row
 * of eight checkboxes needs client-side code to stop the third tick. Two slots
 * carry the rule in their shape — one main answer, one optional second — and post
 * back as two values of the same field, which the action reads with getAll.
 *
 * `primaryEmptyLabel` is what makes this work for posts as well as builders. A
 * builder must be something, so their first slot has no empty option. A post is
 * allowed to be nothing, and choosing that is how it gets marked as not work.
 */
export function TagSlots({
  selected,
  idPrefix,
  primaryEmptyLabel
}: {
  selected: string[];
  idPrefix: string;
  primaryEmptyLabel?: string;
}) {
  const [first, second] = selected;

  return (
    <div className="tag-slots">
      <label className="sr-only" htmlFor={`${idPrefix}-tag-primary`}>
        Main kind of work
      </label>
      <select
        id={`${idPrefix}-tag-primary`}
        name="tag"
        defaultValue={first ?? ""}
        required={!primaryEmptyLabel}
      >
        {primaryEmptyLabel ? (
          <option value="">{primaryEmptyLabel}</option>
        ) : (
          <option value="" disabled>
            Choose what they build…
          </option>
        )}
        {WORK_KINDS.map((kind) => (
          <option value={kind} key={kind}>
            {productCategoryLabel(kind)}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor={`${idPrefix}-tag-second`}>
        Second kind of work, if there genuinely is one
      </label>
      <select id={`${idPrefix}-tag-second`} name="tag" defaultValue={second ?? ""}>
        <option value="">No second tag</option>
        {WORK_KINDS.map((kind) => (
          <option value={kind} key={kind}>
            {productCategoryLabel(kind)}
          </option>
        ))}
      </select>
    </div>
  );
}

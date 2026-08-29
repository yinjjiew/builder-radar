export function compactNumber(value: number | null) {
  if (value === null) return "Sync pending";
  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

// X serves post text HTML-escaped, so an ampersand arrives as "&amp;" and shows
// up literally once React escapes it again on the way out.
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " "
};

/**
 * Post text arrives with t.co shortlinks that carry no meaning for a reader and
 * crowd out the words that do. Collapses whitespace too, since posts are written
 * with line breaks that turn into ragged gaps in a single-line context.
 */
export function cleanPostText(value: string, limit = 220) {
  const cleaned = value
    .replace(/https?:\/\/t\.co\/\w+/g, "")
    .replace(/&(?:amp|lt|gt|quot|#39|apos|nbsp);/g, (match) => ENTITIES[match] ?? match)
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > limit ? `${cleaned.slice(0, limit).trimEnd()}…` : cleaned;
}

export function relativeDate(value: string) {
  const date = new Date(value);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
}

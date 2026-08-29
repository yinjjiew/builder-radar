/**
 * Pulls the post id out of anything a person is likely to paste: a full x.com or
 * twitter.com status link, a link with tracking parameters on the end, a mobile
 * or nitter host, or the bare numeric id on its own.
 */
export function parsePostId(raw: string) {
  const value = raw.trim();
  if (!value) return null;

  const fromUrl = value.match(/(?:status(?:es)?)\/(\d{5,25})/i);
  if (fromUrl) return fromUrl[1];

  // A bare id. Bounded to plausible snowflake lengths so a stray number in
  // pasted text is not mistaken for a post.
  if (/^\d{5,25}$/.test(value)) return value;

  return null;
}

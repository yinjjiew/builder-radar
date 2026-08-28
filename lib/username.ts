const USERNAME_PATTERN = /^[A-Za-z0-9_]{1,15}$/;

/**
 * Accepts "@name", "name", or any x.com/twitter.com profile URL.
 * Returns null when the result is not a syntactically valid X username.
 */
export function normalizeUsername(raw: string) {
  let value = raw.trim();
  const urlMatch = value.match(/(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})/i);
  if (urlMatch) value = urlMatch[1];
  value = value.replace(/^@/, "");
  return USERNAME_PATTERN.test(value) ? value : null;
}

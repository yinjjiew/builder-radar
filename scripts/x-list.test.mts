/**
 * Checks the OAuth 1.0a signing in x-list.mts against the worked example X
 * publishes in its "Creating a signature" guide.
 *
 * This exists because a signing bug and a withdrawn endpoint fail identically:
 * both come back as 401 or 403 with a terse message. Without a known-good vector
 * there is no way to tell "your signature is wrong" from "this endpoint is gone",
 * and the second conclusion is the one that would be reported.
 *
 * The published example signs form-encoded body parameters. This script passes
 * them in the query string instead, which produces a byte-identical signature
 * base string — OAuth normalises query and form parameters into the same list —
 * so the expected signature still applies.
 *
 *   npx tsx scripts/x-list.test.mts
 */
import { authHeader } from "./x-list.mts";

const CREDS = {
  apiKey: "xvz1evFS4wEEPTGEFPHBog",
  apiSecret: "kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw",
  accessToken: "370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb",
  accessSecret: "LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE"
};

const EXPECTED = "hCtSmYh+iHYCEqBWrE7C7hYmtUk=";

// The status carries a space, a plus, a comma and a bang, which between them
// exercise every encoding rule that matters: `+` must become %2B rather than
// surviving as a plus, and `!` must become %21, which `encodeURIComponent`
// leaves alone on its own.
const status = "Hello Ladies + Gentlemen, a signed OAuth request!";

// api.twitter.com, not api.x.com. The published signature was computed against
// the old host, and current mirrors of the page show the new one in the base
// string without having recomputed the hash — signing the x.com form yields
// Ls93hJiZbQ3akF3HF3x1Bz8/zU4= and would fail this check for no real reason.
const url =
  "https://api.twitter.com/1.1/statuses/update.json" +
  `?status=${encodeURIComponent(status)}&include_entities=true`;

const header = authHeader(CREDS, "POST", url, {
  nonce: "kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg",
  timestamp: "1318622958"
});

const signature = decodeURIComponent(
  header.match(/oauth_signature="([^"]+)"/)?.[1] ?? "(none found)"
);

console.log("expected:", EXPECTED);
console.log("computed:", signature);

if (signature !== EXPECTED) {
  console.error("\nFAIL — the signature does not match the published vector.");
  process.exit(1);
}

console.log("\nPASS — the signing matches the published vector byte for byte.");

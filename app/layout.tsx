import type { Metadata } from "next";
import "./globals.css";

// Absolute URLs are required for social image tags. Vercel injects the
// production domain; SITE_URL overrides it for a custom domain.
// Note the `||`: an unset variable arrives as an empty string, not undefined.
function resolveSiteUrl() {
  const explicit = process.env.SITE_URL?.trim();
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const candidate =
    explicit || (vercelHost ? `https://${vercelHost}` : "") || "http://localhost:3000";

  // A malformed value must not take down every page that renders metadata.
  try {
    return new URL(candidate);
  } catch {
    return new URL("http://localhost:3000");
  }
}

export const metadata: Metadata = {
  metadataBase: resolveSiteUrl(),
  title: "Builder Radar",
  description: "A ranked directory of design engineers and creative developers shipping in public.",
  // Belt and braces alongside the basic auth gate in proxy.ts. A crawler cannot
  // get past the password anyway, but if the gate is ever relaxed the pages
  // should not start appearing in search results by default.
  robots: { index: false, follow: false },
  openGraph: {
    title: "Builder Radar",
    description: "Follow what the internet's most inventive builders are shipping.",
    type: "website"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

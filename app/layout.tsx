import type { Metadata } from "next";
import "./globals.css";

// Absolute URLs are required for social image tags. Vercel injects the
// production domain; SITE_URL overrides it for a custom domain.
const siteUrl =
  process.env.SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Builder Radar",
  description: "A ranked directory of design engineers and creative developers shipping in public.",
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

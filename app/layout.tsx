import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
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

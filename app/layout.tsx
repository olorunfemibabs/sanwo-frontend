import type { Metadata } from "next";
import { Albert_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const albert = Albert_Sans({
  variable: "--font-albert",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * The site's own address, used to make link-preview URLs absolute. Set
 * NEXT_PUBLIC_SITE_URL to pin it. On Vercel it otherwise falls back to the
 * production domain, or to a preview deployment's own URL.
 */
function siteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const host =
    process.env.VERCEL_ENV === "production" ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_URL;
  return host ? `https://${host}` : "http://localhost:3100";
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: "Sanwo: get paid before your client pays",
    template: "%s · Sanwo",
  },
  description:
    "Sanwo advances up to 85% of a verified, client-accepted US dollar invoice in USDC within minutes, and settles when the client pays. Receivables financing on Stellar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${albert.variable} ${geistMono.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Marks that scripts run, so scroll reveals never hide content without them. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="min-h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

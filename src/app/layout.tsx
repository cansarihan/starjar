import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { CONFIG } from "@/lib/config";

import "./globals.css";

const DESCRIPTION =
  "Gasless tip jars for creators on Stellar. Fans tip in XLM or USDC with a short message, and StarJar pays the network fee.";

export const metadata: Metadata = {
  metadataBase: new URL(CONFIG.siteUrl),
  title: { default: "starjar · gasless tips on Stellar", template: "%s · starjar" },
  description: DESCRIPTION,
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }] },
  openGraph: {
    title: "starjar · gasless tips on Stellar",
    description: DESCRIPTION,
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A0A0A",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

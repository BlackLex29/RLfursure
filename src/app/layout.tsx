// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import StyledComponentsRegistry from "@/lib/registry";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// CRITICAL: Default SEO blocking for ALL pages
export const metadata: Metadata = {
  title: "FursureCare",
  description: "FursureCare Pet Clinic System",
  // ITO ANG MAGBABLOCK NG SEARCH ENGINES
  robots: {
    index: false,        // Wag i-index
    follow: false,       // Wag i-follow ang links
    nocache: true,       // Wag i-cache
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  // Additional security
  keywords: ["private", "secure"],
  authors: [{ name: "FursureCare" }],
  icons: {
    icon: [
      { url: "/RL.jpg", sizes: "32x32", type: "image/jpg" },
      { url: "/RL.jpg", sizes: "64x64", type: "image/jpg" },
      { url: "/RL.jpg", sizes: "196x196", type: "image/jpg" },
    ],
    apple: "/RL.jpg", 
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        {/* ADDITIONAL SEO BLOCKING */}
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
        <meta name="googlebot" content="noindex, nofollow, noarchive, nosnippet" />
        <meta name="slurp" content="noindex, nofollow, noarchive, nosnippet" />
        <meta name="msnbot" content="noindex, nofollow, noarchive, nosnippet" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
      </body>
    </html>
  );
}
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

export const metadata: Metadata = {
  title: "FursureCare",
  description: "FursureCare Pet Clinic System",
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <StyledComponentsRegistry>{children}</StyledComponentsRegistry>
      </body>
    </html>
  );
}
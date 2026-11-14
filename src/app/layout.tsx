import type { Metadata } from "next";
import { Syne, DM_Sans } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

const display = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
});
const body = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm",
});

export const metadata: Metadata = {
  title: "Wagro | Grow smarter. Rotate wiser.",
  description:
    "Crop rotation decision support built on NASA POWER climate data.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
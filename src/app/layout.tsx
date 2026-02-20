import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mizan — Infinite Timeline",
  description: "A high-performance historical timeline from 4001 BC to 2026 AD",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

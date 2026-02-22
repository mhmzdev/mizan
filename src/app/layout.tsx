import type { Metadata } from "next";
import { Roboto_Mono } from "next/font/google";
import "./globals.css";

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mizan — The Balance of Time & Thought",
  description: "A high-performance historical timeline from 4001 BC to 2026 AD",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`antialiased ${robotoMono.variable}`}>
        {children}
      </body>
    </html>
  );
}

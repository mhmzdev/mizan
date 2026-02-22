import type { Metadata } from "next";
import { Roboto_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const robotoMono = Roboto_Mono({
  subsets: ["latin"],
  variable: "--font-roboto-mono",
  display: "swap",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mizan — Infinite Timeline",
  description: "A high-performance historical timeline from 4001 BC to 2026 AD",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`antialiased ${robotoMono.variable} ${plusJakarta.variable}`}>
        {children}
      </body>
    </html>
  );
}

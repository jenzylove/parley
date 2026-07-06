import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Parley",
  description: "Protocol-first agent negotiation demo",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

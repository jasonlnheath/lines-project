import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lines Prototype - Agent Search",
  description: "Unified communication management with agent-based search",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

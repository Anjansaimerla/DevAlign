import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DevAlign | Automated Team Sync Digest",
  description: "Automated GitHub activity aggregation and daily standup digests for engineering teams.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased font-sans">
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}

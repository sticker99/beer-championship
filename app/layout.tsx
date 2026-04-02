import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Beer Championship",
  description: "A fun and interactive craft beer tasting application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}

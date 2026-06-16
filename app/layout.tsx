import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PickUp Driver",
  description: "PickUp — accept and run VTC missions.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "PickUp", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#0b1f3a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

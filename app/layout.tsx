import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MotorMatte — Car photos, listing ready",
  description:
    "Remove a car photo background, choose a clean replacement and blur number plates privately in your browser.",
  applicationName: "MotorMatte",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MotorMatte",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-AU">
      <body className="antialiased">{children}</body>
    </html>
  );
}

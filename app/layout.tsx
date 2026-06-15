import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Image Comparison Viewer",
  description: "Full-screen viewer for comparing generated image folders."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

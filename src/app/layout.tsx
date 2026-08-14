import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fuhrpark-Manager",
  description: "Fahrzeuge, Fristen, Wartung und Kosten im Fuhrpark verwalten.",
};

export const viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}

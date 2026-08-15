import type { Metadata } from "next";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";
import { NativeShell } from "@/components/NativeShell";

export const metadata: Metadata = {
  title: "Fuhrpark-Manager",
  description: "Fahrzeuge, Fristen, Wartung und Kosten im Fuhrpark verwalten.",
  manifest: "/manifest.webmanifest",
  applicationName: "Fuhrpark-Manager",
  appleWebApp: {
    capable: true,
    title: "Fuhrpark",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f4" },
    { media: "(prefers-color-scheme: dark)", color: "#17171a" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

/**
 * Setzt das gespeicherte Theme vor dem ersten Paint, damit die App beim Start
 * nicht kurz in der falschen Helligkeit aufblitzt.
 */
const THEME_INIT = `
(function () {
  try {
    var stored = localStorage.getItem('fuhrpark-theme') || 'light';
    var dark = stored === 'dark' ||
      (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.compact =
      localStorage.getItem('fuhrpark-compact') === 'true' ? 'true' : 'false';
  } catch (e) {
    document.documentElement.dataset.theme = 'light';
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className="h-full" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full">
        {children}
        <ServiceWorker />
        <NativeShell />
      </body>
    </html>
  );
}

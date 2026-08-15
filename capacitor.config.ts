import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor-Konfiguration für die iOS-App.
 *
 * Die App ist serverseitig gerendert und kann deshalb nicht als statisches
 * Bundle mitgeliefert werden — `server.url` zeigt auf das Deployment.
 * Damit Apple die App nicht als bloße Website einstuft (Richtlinie 4.2),
 * bringt sie native Funktionen mit, die im Browser nicht möglich sind:
 * Push über APNs, Kamera-Zugriff, Haptik und Netzwerkerkennung
 * (siehe src/lib/native.ts).
 */
const config: CapacitorConfig = {
  appId: "de.fuhrparkmanager.app",
  appName: "Fuhrpark",
  webDir: "public",
  server: {
    // Beim Release auf die eigene Domain setzen (muss HTTPS sein).
    url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://fuhrpark.example.com",
    cleartext: false,
  },
  ios: {
    contentInset: "always",
    // Verhindert das Gummiband-Scrollen über den Seitenrand hinaus.
    scrollEnabled: true,
    limitsNavigationsToAppBoundDomains: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 800,
      backgroundColor: "#f5f5f4",
      showSpinner: false,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;

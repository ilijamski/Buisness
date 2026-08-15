/**
 * Brücke zu den nativen Funktionen der iOS-/Android-App.
 *
 * Alle Aufrufe sind so gebaut, dass sie im normalen Browser einfach nichts
 * tun — die Weboberfläche bleibt also unverändert nutzbar, und die native
 * Hülle bekommt zusätzlich Kamera, Push, Haptik und Statusleiste.
 *
 * Die Capacitor-Pakete werden bewusst dynamisch geladen, damit sie nicht im
 * Web-Bundle landen.
 */

let nativeChecked = false;
let nativeAvailable = false;

export async function isNative(): Promise<boolean> {
  if (nativeChecked) return nativeAvailable;
  nativeChecked = true;

  try {
    const { Capacitor } = await import("@capacitor/core");
    nativeAvailable = Capacitor.isNativePlatform();
  } catch {
    nativeAvailable = false;
  }
  return nativeAvailable;
}

export async function getPlatform(): Promise<"ios" | "android" | "web"> {
  try {
    const { Capacitor } = await import("@capacitor/core");
    const platform = Capacitor.getPlatform();
    if (platform === "ios" || platform === "android") return platform;
  } catch {
    // Kein Capacitor vorhanden.
  }
  return "web";
}

/** Kurzes haptisches Feedback nach erfolgreichem Speichern. */
export async function hapticSuccess(): Promise<void> {
  if (!(await isNative())) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Success });
  } catch {
    // Haptik ist optional.
  }
}

export async function hapticWarning(): Promise<void> {
  if (!(await isNative())) return;
  try {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Warning });
  } catch {
    // Haptik ist optional.
  }
}

/**
 * Foto über die native Kamera aufnehmen.
 * Liefert eine Datei, die sich wie ein `<input type="file">`-Ergebnis
 * weiterverarbeiten lässt. Im Web wird null zurückgegeben, dort greift das
 * normale Dateifeld.
 */
export async function takePhoto(): Promise<File | null> {
  if (!(await isNative())) return null;

  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      quality: 80,
      width: 1600,
      allowEditing: false,
      correctOrientation: true,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      promptLabelHeader: "Beleg erfassen",
      promptLabelPhoto: "Aus Fotos wählen",
      promptLabelPicture: "Foto aufnehmen",
      promptLabelCancel: "Abbrechen",
    });

    if (!photo.webPath) return null;
    const response = await fetch(photo.webPath);
    const blob = await response.blob();

    return new File([blob], `beleg-${Date.now()}.${photo.format || "jpg"}`, {
      type: blob.type || "image/jpeg",
    });
  } catch {
    return null;
  }
}

/**
 * Registriert das Gerät für native Push-Nachrichten (APNs/FCM) und meldet den
 * Token an den übergebenen Callback, damit er gespeichert werden kann.
 */
export async function registerNativePush(
  saveToken: (token: string, platform: "ios" | "android") => Promise<void>,
): Promise<boolean> {
  if (!(await isNative())) return false;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    const permission = await PushNotifications.requestPermissions();
    if (permission.receive !== "granted") return false;

    const platform = (await getPlatform()) as "ios" | "android";

    await PushNotifications.addListener("registration", (token) => {
      void saveToken(token.value, platform);
    });
    await PushNotifications.addListener("registrationError", (error) => {
      console.error("Push-Registrierung fehlgeschlagen:", error);
    });

    await PushNotifications.register();
    return true;
  } catch {
    return false;
  }
}

/** Statusleiste an das gewählte Farbschema anpassen. */
export async function syncStatusBar(theme: "light" | "dark"): Promise<void> {
  if (!(await isNative())) return;
  try {
    const { StatusBar, Style } = await import("@capacitor/status-bar");
    await StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light });
  } catch {
    // Auf Android ohne Berechtigung o. Ä. schlicht überspringen.
  }
}

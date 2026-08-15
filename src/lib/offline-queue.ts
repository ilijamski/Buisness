/**
 * Warteschlange für Erfassungen ohne Netz.
 *
 * Fahrer stehen regelmäßig im Funkloch — an der Tankstelle, in der Tiefgarage,
 * auf der Baustelle. Statt einer Fehlermeldung landet der Eintrag dann lokal
 * in IndexedDB und wird verschickt, sobald wieder Verbindung besteht.
 *
 * Bewusst nur für das Anlegen von Einträgen: Änderungen und Löschungen
 * offline zu puffern würde Konfliktauflösung erfordern, die den Nutzen hier
 * nicht rechtfertigt.
 */

const DB_NAME = "fuhrpark-offline";
const DB_VERSION = 1;
const STORE = "pending-entries";

export type PendingEntry = {
  id?: number;
  createdAt: number;
  vehicleId: string;
  vehicleName: string;
  /** Serialisierte Formulardaten inkl. optionalem Beleg-Foto. */
  fields: Record<string, string>;
  receipt?: { name: string; type: string; blob: Blob };
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function queueEntry(entry: PendingEntry): Promise<void> {
  await withStore("readwrite", (store) => store.add(entry));
  notifyChange();
}

export async function listQueued(): Promise<PendingEntry[]> {
  try {
    const all = await withStore<PendingEntry[]>("readonly", (store) =>
      store.getAll() as IDBRequest<PendingEntry[]>,
    );
    return all.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function removeQueued(id: number): Promise<void> {
  await withStore("readwrite", (store) => store.delete(id) as unknown as IDBRequest<undefined>);
  notifyChange();
}

export async function countQueued(): Promise<number> {
  try {
    return await withStore<number>("readonly", (store) => store.count());
  } catch {
    return 0;
  }
}

/** Damit die Statusanzeige ohne Polling aktuell bleibt. */
const CHANGE_EVENT = "fuhrpark-queue-change";

export function notifyChange() {
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function onQueueChange(handler: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, handler);
  window.addEventListener("online", handler);
  window.addEventListener("offline", handler);
  return () => {
    window.removeEventListener(CHANGE_EVENT, handler);
    window.removeEventListener("online", handler);
    window.removeEventListener("offline", handler);
  };
}

/**
 * Schickt alle wartenden Einträge ab. Ein fehlgeschlagener Eintrag bleibt in
 * der Warteschlange, damit nichts verloren geht; der Rest wird trotzdem
 * versucht.
 */
export async function flushQueue(
  send: (formData: FormData) => Promise<{ error: string | null }>,
): Promise<{ sent: number; failed: number }> {
  const pending = await listQueued();
  let sent = 0;
  let failed = 0;

  for (const entry of pending) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(entry.fields)) {
      formData.set(key, value);
    }
    if (entry.receipt) {
      formData.set(
        "receipt",
        new File([entry.receipt.blob], entry.receipt.name, { type: entry.receipt.type }),
      );
    }

    try {
      const result = await send(formData);
      if (result.error) {
        failed++;
        continue;
      }
      if (entry.id !== undefined) await removeQueued(entry.id);
      sent++;
    } catch {
      failed++;
    }
  }

  return { sent, failed };
}

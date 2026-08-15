"use client";

/* eslint-disable react-hooks/set-state-in-effect --
   Warteschlangenstand kommt asynchron aus IndexedDB. Ein Effect mit setState ist dafür der vorgesehene Weg. */

import { useCallback, useEffect, useState } from "react";
import { createEntry } from "@/app/fahrzeuge/actions";
import { countQueued, flushQueue, onQueueChange } from "@/lib/offline-queue";

/**
 * Zeigt an, ob Einträge lokal warten, und schickt sie ab, sobald wieder
 * Verbindung besteht. Liegt im Layout, damit der Abgleich unabhängig davon
 * läuft, auf welcher Seite man gerade ist.
 */
export function OfflineStatus() {
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
    setPending(await countQueued());
  }, []);

  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    const waiting = await countQueued();
    if (waiting === 0) return;

    setSyncing(true);
    try {
      await flushQueue(async (formData) => {
        const result = await createEntry({ error: null, success: false }, formData);
        return { error: result.error };
      });
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const unsubscribe = onQueueChange(() => {
      void refresh();
      void sync();
    });
    void sync();
    return unsubscribe;
  }, [refresh, sync]);

  if (pending === 0 && !offline) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-lg px-4 md:bottom-4"
    >
      <div className="rounded border border-accent-bg bg-accent-soft px-3 py-2 text-sm text-accent shadow-sm">
        {syncing
          ? `${pending} Eintrag${pending === 1 ? "" : "e"} wird übertragen…`
          : pending > 0
            ? `${pending} Eintrag${pending === 1 ? "" : "e"} wartet auf Verbindung.`
            : "Offline — Einträge werden lokal gespeichert."}
      </div>
    </div>
  );
}

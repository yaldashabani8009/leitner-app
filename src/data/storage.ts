/**
 * Ask the browser to keep our data instead of clearing it when space is low (ADR-002).
 * Matters most on iPhone. Call once on launch; it is safe to call again.
 */
export async function requestPersistentStorage(
  storage: Pick<StorageManager, 'persist' | 'persisted'> | undefined = globalThis.navigator
    ?.storage,
): Promise<boolean> {
  if (!storage?.persist) return false;
  if (await storage.persisted()) return true;
  return storage.persist();
}

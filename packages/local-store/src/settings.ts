/**
 * Den settings operations for @meerkat/local-store.
 *
 * Settings live in the private Yjs doc and are persisted to IndexedDB.
 * These are the imperative equivalents of the useSetting / useSetSetting hooks.
 */

import { openDen } from "./den.js";

/**
 * Reads a setting value from the den's private settings map.
 * Returns undefined if the key has never been set.
 */
export async function getSetting<T = unknown>(
  denId: string,
  key: string,
): Promise<T | undefined> {
  const { privateDen } = await openDen(denId);
  return privateDen.settings.get(key) as T | undefined;
}

/**
 * Writes a setting value into the den's private settings map.
 */
export async function setSetting<T = unknown>(
  denId: string,
  key: string,
  value: T,
): Promise<void> {
  const { privateDen } = await openDen(denId);
  privateDen.ydoc.transact(() => {
    privateDen.settings.set(key, value);
  });
}

/**
 * Deletes a setting key from the den's private settings map.
 */
export async function deleteSetting(denId: string, key: string): Promise<void> {
  const { privateDen } = await openDen(denId);
  privateDen.ydoc.transact(() => {
    privateDen.settings.delete(key);
  });
}

/**
 * Returns all settings as a plain object snapshot.
 */
export async function getAllSettings(
  denId: string,
): Promise<Record<string, unknown>> {
  const { privateDen } = await openDen(denId);
  return Object.fromEntries(privateDen.settings.entries());
}

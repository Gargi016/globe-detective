import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db, isConfigured } from '../lib/firebase';
import { firestorePaths } from '../lib/firestorePaths';
import type { UserInvestigationDoc } from '../types/database';
import { parseInvestigation } from './investigation';
import type { Investigation, SavedInvestigation } from './investigation';

/** Merges local and cloud investigations, removing duplicates and prioritizing newer updates. */
export function mergeInvestigationSaves(
  local: readonly SavedInvestigation[],
  cloud: readonly SavedInvestigation[],
): SavedInvestigation[] {
  const map = new Map<string, SavedInvestigation>();

  for (const item of [...local, ...cloud]) {
    const existing = map.get(item.id);
    if (!existing || item.savedAt > existing.savedAt) {
      map.set(item.id, item);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.savedAt - a.savedAt);
}

/** Saves an investigation into Firestore under `users/{uid}/investigations/{id}`. */
export async function saveCloudInvestigation(
  uid: string,
  inv: Investigation,
  customId?: string,
  now = Date.now(),
): Promise<{ ok: boolean; id: string; error?: string }> {
  if (!db || !isConfigured || !uid) {
    return { ok: false, id: '', error: 'Cloud storage is unavailable (Guest Mode active).' };
  }

  const cleanName = inv.name.trim().slice(0, 80) || 'Untitled investigation';
  const id = customId ?? `inv_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const docData: UserInvestigationDoc = {
      id,
      userId: uid,
      name: cleanName,
      savedAt: now,
      updatedAt: now,
      investigation: { ...inv, name: cleanName },
    };

    const docRef = doc(db, firestorePaths.userInvestigation(uid, id));
    await setDoc(docRef, docData, { merge: true });
    return { ok: true, id };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to save investigation to cloud';
    console.warn('Could not save investigation to cloud:', msg);
    return { ok: false, id: '', error: msg };
  }
}

/** Fetches all saved investigations for a user from Firestore. */
export async function fetchCloudInvestigations(uid: string): Promise<SavedInvestigation[]> {
  if (!db || !isConfigured || !uid) return [];

  try {
    const colRef = collection(db, firestorePaths.userInvestigations(uid));
    const snapshot = await getDocs(colRef);
    const results: SavedInvestigation[] = [];

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data() as Partial<UserInvestigationDoc>;
      if (!data || typeof data.id !== 'string') continue;

      const parsed = parseInvestigation(data.investigation);
      if (!parsed) continue;

      const name = typeof data.name === 'string' && data.name.trim() ? data.name.slice(0, 80) : parsed.investigation.name;
      results.push({
        id: data.id,
        name,
        savedAt: typeof data.savedAt === 'number' ? data.savedAt : Date.now(),
        investigation: { ...parsed.investigation, name },
      });
    }

    return results.sort((a, b) => b.savedAt - a.savedAt);
  } catch (err) {
    console.warn('Could not fetch cloud investigations:', err);
    return [];
  }
}

/** Deletes a saved investigation from Firestore. */
export async function deleteCloudInvestigation(uid: string, investigationId: string): Promise<boolean> {
  if (!db || !isConfigured || !uid || !investigationId) return false;

  try {
    const docRef = doc(db, firestorePaths.userInvestigation(uid, investigationId));
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.warn('Could not delete cloud investigation:', err);
    return false;
  }
}

/**
 * Synchronizes local and cloud investigations:
 * 1. Fetches cloud saves.
 * 2. Uploads any local saves that are missing from cloud.
 * 3. Returns the merged set.
 */
export async function syncInvestigationsWithCloud(
  uid: string,
  localSaves: readonly SavedInvestigation[],
): Promise<SavedInvestigation[]> {
  if (!db || !isConfigured || !uid) return [...localSaves];

  try {
    const cloudSaves = await fetchCloudInvestigations(uid);
    const cloudIds = new Set(cloudSaves.map((s) => s.id));

    // Upload any local saves not yet in the cloud
    for (const local of localSaves) {
      if (!cloudIds.has(local.id)) {
        await saveCloudInvestigation(uid, local.investigation, local.id, local.savedAt);
      }
    }

    return mergeInvestigationSaves(localSaves, cloudSaves);
  } catch (err) {
    console.warn('Could not synchronize investigations with cloud:', err);
    return [...localSaves];
  }
}

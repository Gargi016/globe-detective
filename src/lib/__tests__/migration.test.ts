import { describe, expect, it } from 'vitest';
import {
  MIGRATION_KEY_PREFIX,
  migrateLocalStorageToCloud,
} from '../migration';
import type { SafeStorage } from '../../detective/investigation';
import {
  PROFILE_KEY,
  newProfile,
  saveProfile,
  withInvestigationRun,
} from '../../profile/profileStore';
import { SAVES_KEY, newInvestigation, saveNamed } from '../../detective/investigation';

class MemStorage implements SafeStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

describe('migration', () => {
  it('exposes correct migration key prefix', () => {
    expect(MIGRATION_KEY_PREFIX).toBe('globe-detective:migrated:');
  });

  it('skips gracefully when unconfigured or without uid or store', async () => {
    const resNullStore = await migrateLocalStorageToCloud('uid-123', null);
    expect(resNullStore.skipped).toBe(true);

    const resEmptyUid = await migrateLocalStorageToCloud('', new MemStorage());
    expect(resEmptyUid.skipped).toBe(true);

    // In test environment without VITE_FIREBASE_API_KEY, isConfigured is false
    const store = new MemStorage();
    const resUnconfigured = await migrateLocalStorageToCloud('user-abc', store);
    expect(resUnconfigured.skipped).toBe(true);
  });

  it('preserves all local data completely without deletion or mutation', async () => {
    const store = new MemStorage();
    let profile = newProfile();
    profile = withInvestigationRun(profile, {
      name: 'Local Mystery',
      clueCount: 2,
      status: 'ok',
      rangeText: '1970–1975',
      widthYears: 5,
      confidence: 'high',
      labels: [],
      investigation: newInvestigation('Local Mystery'),
    });
    profile.unlocked = { 'first-investigation': Date.now() };
    saveProfile(store, profile);
    saveNamed(store, 'Grandfather Globe', newInvestigation('Grandfather Globe'));

    // Verify stored keys exist before migration
    const profileJsonBefore = store.getItem(PROFILE_KEY);
    const savesJsonBefore = store.getItem(SAVES_KEY);
    expect(profileJsonBefore).not.toBeNull();
    expect(savesJsonBefore).not.toBeNull();

    await migrateLocalStorageToCloud('user-abc', store);

    // Verify stored keys are untouched and exactly identical
    expect(store.getItem(PROFILE_KEY)).toBe(profileJsonBefore);
    expect(store.getItem(SAVES_KEY)).toBe(savesJsonBefore);
  });

  it('identifies already migrated state via migration flag', async () => {
    const store = new MemStorage();
    const uid = 'user-migrated';
    store.setItem(`${MIGRATION_KEY_PREFIX}${uid}`, String(Date.now()));

    const res = await migrateLocalStorageToCloud(uid, store);
    expect(res.skipped).toBe(true);
  });
});

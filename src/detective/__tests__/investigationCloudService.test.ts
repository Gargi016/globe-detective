import { describe, expect, it } from 'vitest';
import {
  deleteCloudInvestigation,
  fetchCloudInvestigations,
  mergeInvestigationSaves,
  saveCloudInvestigation,
  syncInvestigationsWithCloud,
} from '../investigationCloudService';
import { newInvestigation } from '../investigation';
import type { SavedInvestigation } from '../investigation';

const makeSaved = (id: string, name: string, savedAt: number): SavedInvestigation => ({
  id,
  name,
  savedAt,
  investigation: { ...newInvestigation(name), name },
});

describe('investigationCloudService', () => {
  describe('mergeInvestigationSaves', () => {
    it('returns empty array when both inputs are empty', () => {
      expect(mergeInvestigationSaves([], [])).toEqual([]);
    });

    it('combines distinct local and cloud saves sorted by savedAt descending', () => {
      const local = [makeSaved('loc-1', 'Local Case', 1000)];
      const cloud = [makeSaved('cld-1', 'Cloud Case', 2000)];

      const merged = mergeInvestigationSaves(local, cloud);
      expect(merged).toHaveLength(2);
      expect(merged[0].id).toBe('cld-1');
      expect(merged[1].id).toBe('loc-1');
    });

    it('resolves duplicate IDs by keeping the version with newer savedAt', () => {
      const local = [makeSaved('case-1', 'Older Local', 1000)];
      const cloud = [makeSaved('case-1', 'Newer Cloud', 5000)];

      const merged = mergeInvestigationSaves(local, cloud);
      expect(merged).toHaveLength(1);
      expect(merged[0].name).toBe('Newer Cloud');
      expect(merged[0].savedAt).toBe(5000);
    });

    it('resolves duplicate IDs when local is newer than cloud', () => {
      const local = [makeSaved('case-1', 'Newer Local', 8000)];
      const cloud = [makeSaved('case-1', 'Older Cloud', 5000)];

      const merged = mergeInvestigationSaves(local, cloud);
      expect(merged).toHaveLength(1);
      expect(merged[0].name).toBe('Newer Local');
      expect(merged[0].savedAt).toBe(8000);
    });
  });

  describe('unconfigured cloud fallback behavior', () => {
    it('handles saveCloudInvestigation gracefully when unconfigured', async () => {
      const res = await saveCloudInvestigation('user-1', newInvestigation('Test Inv'));
      expect(res.ok).toBe(false);
      expect(res.error).toMatch(/unavailable|guest/i);

      const emptyUid = await saveCloudInvestigation('', newInvestigation('Test'));
      expect(emptyUid.ok).toBe(false);
    });

    it('handles fetchCloudInvestigations safely when unconfigured', async () => {
      const res = await fetchCloudInvestigations('user-1');
      expect(res).toEqual([]);

      const emptyRes = await fetchCloudInvestigations('');
      expect(emptyRes).toEqual([]);
    });

    it('handles deleteCloudInvestigation safely when unconfigured', async () => {
      const res = await deleteCloudInvestigation('user-1', 'inv-1');
      expect(res).toBe(false);

      const emptyRes = await deleteCloudInvestigation('', '');
      expect(emptyRes).toBe(false);
    });

    it('returns local saves intact from syncInvestigationsWithCloud when unconfigured', async () => {
      const local = [makeSaved('loc-1', 'Local Only', 1000)];
      const res = await syncInvestigationsWithCloud('user-1', local);
      expect(res).toEqual(local);
    });
  });
});

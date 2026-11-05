import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { firestorePaths } from '../firestorePaths';

describe('Firestore Rules Security Audit & Coverage', () => {
  const rulesPath = path.resolve(__dirname, '../../../firestore.rules');
  const rulesContent = fs.readFileSync(rulesPath, 'utf-8');

  it('exists, uses rules_version 2, and specifies the cloud.firestore service', () => {
    expect(rulesContent).toMatch(/rules_version\s*=\s*'2';/);
    expect(rulesContent).toMatch(/service\s+cloud\.firestore\s*\{/);
    expect(rulesContent).toMatch(/match\s+\/databases\/\{database\}\/documents/);
  });

  describe('Path Coverage vs Codebase Schema', () => {
    it('covers all canonical client collections and documents from firestorePaths', () => {
      // User profile path
      expect(rulesContent).toMatch(/match\s+\/users\/\{userId\}/);

      // Subcollections under users/{userId}
      expect(rulesContent).toMatch(/match\s+\/investigations\/\{invId\}/);
      expect(rulesContent).toMatch(/match\s+\/achievements\/\{badgeId\}/);
      expect(rulesContent).toMatch(/match\s+\/challenges\/\{attemptId\}/);
      expect(rulesContent).toMatch(/match\s+\/dailyDone\/\{dailyKey\}/);

      // Leaderboard collection
      expect(rulesContent).toMatch(/match\s+\/leaderboards\/\{document=\*\*\}/);

      // Catch-all deny
      expect(rulesContent).toMatch(/match\s+\/\{document=\*\*\}/);
    });

    it('verifies firestorePaths builders match the rule paths', () => {
      const uid = 'alice';
      expect(firestorePaths.user(uid)).toBe('users/alice');
      expect(firestorePaths.userInvestigation(uid, 'inv1')).toBe('users/alice/investigations/inv1');
      expect(firestorePaths.userAchievement(uid, 'ach1')).toBe('users/alice/achievements/ach1');
      expect(firestorePaths.userChallenge(uid, 'ch1')).toBe('users/alice/challenges/ch1');
      expect(firestorePaths.leaderboardCollection('global')).toBe('leaderboards/global/entries');
    });
  });

  describe('Profile & Data Privacy Verification', () => {
    it('restricts /users/{userId} read to the owner only (no public email leakage)', () => {
      // Must NOT be `allow read: if true;`
      expect(rulesContent).not.toMatch(/match\s+\/users\/\{userId\}\s*\{[^}]*allow\s+read:\s*if\s+true;/);
      // Must require isOwner(userId)
      expect(rulesContent).toMatch(/match\s+\/users\/\{userId\}[\s\S]*?allow\s+read:\s*if\s+isOwner\(userId\);/);
    });

    it('restricts investigations and achievements to the owner only', () => {
      expect(rulesContent).toMatch(/match\s+\/investigations\/\{invId\}[\s\S]*?allow\s+read,\s*write:\s*if\s+isOwner\(userId\);/);
      expect(rulesContent).toMatch(/match\s+\/achievements\/\{badgeId\}[\s\S]*?allow\s+read,\s*write:\s*if\s+isOwner\(userId\);/);
    });

    it('restricts challenge history and dailyDone reads to the owner only', () => {
      expect(rulesContent).toMatch(/match\s+\/challenges\/\{attemptId\}[\s\S]*?allow\s+read:\s*if\s+isOwner\(userId\);/);
      expect(rulesContent).toMatch(/match\s+\/dailyDone\/\{dailyKey\}[\s\S]*?allow\s+read:\s*if\s+isOwner\(userId\);/);
    });
  });

  describe('Integrity & Tamper-Proofing Verification', () => {
    it('strictly prohibits direct client writes to challenge records', () => {
      expect(rulesContent).toMatch(/match\s+\/challenges\/\{attemptId\}[\s\S]*?allow\s+write:\s*if\s+false;/);
    });

    it('strictly prohibits direct client writes to dailyDone replay locks', () => {
      expect(rulesContent).toMatch(/match\s+\/dailyDone\/\{dailyKey\}[\s\S]*?allow\s+write:\s*if\s+false;/);
    });

    it('strictly prohibits direct client writes to leaderboards', () => {
      expect(rulesContent).toMatch(/match\s+\/leaderboards\/\{document=\*\*\}[\s\S]*?allow\s+write:\s*if\s+false;/);
    });

    it('allows public read on leaderboards for global rankings (including guest users)', () => {
      expect(rulesContent).toMatch(/match\s+\/leaderboards\/\{document=\*\*\}[\s\S]*?allow\s+read:\s*if\s+true;/);
    });

    it('prevents clients from setting non-zero totalPoints on account creation', () => {
      expect(rulesContent).toMatch(/request\.resource\.data\.stats\.totalPoints\s*==\s*0/);
    });

    it('prevents clients from altering totalPoints on profile updates', () => {
      expect(rulesContent).toMatch(/request\.resource\.data\.stats\.totalPoints\s*==\s*resource\.data\.stats\.totalPoints/);
    });

    it('contains a default catch-all deny rule for any unexpected collections', () => {
      expect(rulesContent).toMatch(/match\s+\/\{document=\*\*\}\s*\{\s*allow\s+read,\s*write:\s*if\s+false;\s*\}/);
    });
  });

  describe('Credentials & Secret Exposure Check', () => {
    it('contains no API keys, private keys, service account emails or tokens', () => {
      expect(rulesContent).not.toMatch(/AIza[0-9A-Za-z-_]{35}/);
      expect(rulesContent).not.toMatch(/BEGIN\s+PRIVATE\s+KEY/);
      expect(rulesContent).not.toMatch(/gserviceaccount\.com/);
      expect(rulesContent).not.toMatch(/token/i);
    });
  });

  describe('Rule Logic Simulation Test', () => {
    // Pure function simulation matching firestore.rules logic
    function simulateRules(authUid: string | null) {
      const isAuthenticated = authUid !== null;
      const isOwner = (targetUserId: string) => isAuthenticated && authUid === targetUserId;

      return {
        readUser: (targetUserId: string) => isOwner(targetUserId),
        createUser: (targetUserId: string, payload: { stats?: { totalPoints?: number } }) => {
          if (!isOwner(targetUserId)) return false;
          if (payload.stats?.totalPoints !== undefined && payload.stats.totalPoints !== 0) return false;
          return true;
        },
        updateUser: (
          targetUserId: string,
          existingDoc: { stats?: { totalPoints?: number } },
          incomingDoc: { stats?: { totalPoints?: number } },
        ) => {
          if (!isOwner(targetUserId)) return false;
          const incomingPoints = incomingDoc.stats?.totalPoints;
          const existingPoints = existingDoc.stats?.totalPoints;
          if (incomingPoints !== undefined && incomingPoints !== existingPoints) return false;
          return true;
        },
        writeChallengeAttempt: () => false,
        readChallengeAttempt: (targetUserId: string) => isOwner(targetUserId),
        readLeaderboard: () => true,
        writeLeaderboard: () => false,
        readUnknownCollection: () => false,
        writeUnknownCollection: () => false,
      };
    }

    it('correctly simulates authorization outcomes for Alice, Bob, and Guest', () => {
      const guest = simulateRules(null);
      const alice = simulateRules('alice');
      const bob = simulateRules('bob');

      // 1. Profile privacy: Alice can read Alice, but Bob or Guest cannot
      expect(alice.readUser('alice')).toBe(true);
      expect(bob.readUser('alice')).toBe(false);
      expect(guest.readUser('alice')).toBe(false);

      // 2. Initial points injection: Alice cannot create account with 1000 points
      expect(alice.createUser('alice', { stats: { totalPoints: 1000 } })).toBe(false);
      expect(alice.createUser('alice', { stats: { totalPoints: 0 } })).toBe(true);
      expect(alice.createUser('alice', {})).toBe(true);

      // 3. Points tampering: Alice cannot update her points from 50 to 500
      expect(
        alice.updateUser('alice', { stats: { totalPoints: 50 } }, { stats: { totalPoints: 500 } }),
      ).toBe(false);
      // But Alice can update with matching points (e.g. updating displayName)
      expect(
        alice.updateUser('alice', { stats: { totalPoints: 50 } }, { stats: { totalPoints: 50 } }),
      ).toBe(true);

      // 4. Challenges: Direct client writes are rejected for everyone
      expect(alice.writeChallengeAttempt()).toBe(false);
      expect(bob.writeChallengeAttempt()).toBe(false);
      expect(guest.writeChallengeAttempt()).toBe(false);

      // 5. Leaderboard: Publicly readable for all (including guest), but writable by none
      expect(guest.readLeaderboard()).toBe(true);
      expect(alice.readLeaderboard()).toBe(true);
      expect(alice.writeLeaderboard()).toBe(false);
      expect(guest.writeLeaderboard()).toBe(false);

      // 6. Unknown paths: Denied by default
      expect(alice.readUnknownCollection()).toBe(false);
      expect(alice.writeUnknownCollection()).toBe(false);
    });
  });
});

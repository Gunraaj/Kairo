import type { TimeCapsule } from '../types';
import { normalizeTimeCapsules } from '../data/validation';

const STORAGE_KEY = 'kairo_time_capsules';

export const readTimeCapsules = (): TimeCapsule[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : parsed?.data;
    return normalizeTimeCapsules(list);
  } catch {
    return [];
  }
};

export const writeTimeCapsules = (capsules: TimeCapsule[]): void => {
  if (typeof window === 'undefined') return;
  try {
    const normalized = normalizeTimeCapsules(capsules);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, data: normalized }),
    );
  } catch {
    // Ignore storage quota
  }
};

/**
 * Check if any locked capsules should be unsealed given the current session state.
 */
export const checkUnlockableCapsules = (
  capsules: TimeCapsule[],
  totalCompletedRounds: number,
  now: Date = new Date(),
): { unlockable: TimeCapsule[]; remaining: TimeCapsule[] } => {
  const unlockable: TimeCapsule[] = [];
  const remaining: TimeCapsule[] = [];

  for (const capsule of capsules) {
    if (capsule.isUnlocked) {
      remaining.push(capsule);
      continue;
    }

    let shouldUnlock = false;

    if (capsule.triggerType === 'rounds') {
      const roundsNeeded = capsule.targetRounds ?? 4;
      const roundsGained = totalCompletedRounds - capsule.completedRoundsAtCreation;
      if (roundsGained >= roundsNeeded) {
        shouldUnlock = true;
      }
    } else if (capsule.triggerType === 'tomorrow') {
      const createdDate = new Date(capsule.createdAt).toDateString();
      const todayDate = now.toDateString();
      if (createdDate !== todayDate) {
        shouldUnlock = true;
      }
    } else if (capsule.triggerType === 'time' && capsule.targetTime) {
      const [hours, minutes] = capsule.targetTime.split(':').map(Number);
      if (
        !Number.isNaN(hours) &&
        !Number.isNaN(minutes) &&
        Number.isInteger(hours) &&
        Number.isInteger(minutes) &&
        hours >= 0 &&
        hours <= 23 &&
        minutes >= 0 &&
        minutes <= 59
      ) {
        const createdAtDate = new Date(capsule.createdAt);
        const targetDate = new Date(capsule.createdAt);
        targetDate.setHours(hours, minutes, 0, 0);

        // If scheduled time has already passed on the day of creation, roll over to tomorrow
        if (targetDate.getTime() <= createdAtDate.getTime()) {
          targetDate.setDate(targetDate.getDate() + 1);
        }

        if (now.getTime() >= targetDate.getTime()) {
          shouldUnlock = true;
        }
      }
    }

    if (shouldUnlock) {
      unlockable.push({
        ...capsule,
        isUnlocked: true,
        unlockedAt: now.toISOString(),
      });
    } else {
      remaining.push(capsule);
    }
  }

  return { unlockable, remaining };
};

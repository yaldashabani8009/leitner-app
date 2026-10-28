/**
 * Copy the signed-in profile (name, time zone) from Supabase onto the device,
 * so the Loading screen and "today" work offline. Offline or failing: keep the saved copy.
 */

import type { Repository } from './repository';

export interface ProfileSource {
  fetchProfile(userId: string): Promise<{
    display_name: string | null;
    time_zone: string;
    updated_at: string;
  } | null>;
}

export async function refreshProfile(
  source: ProfileSource,
  repo: Pick<Repository, 'saveProfile'>,
  userId: string,
): Promise<boolean> {
  try {
    const row = await source.fetchProfile(userId);
    if (!row) return false;
    await repo.saveProfile({
      userId,
      displayName: row.display_name,
      timeZone: row.time_zone,
      updatedAt: row.updated_at,
    });
    return true;
  } catch {
    return false;
  }
}

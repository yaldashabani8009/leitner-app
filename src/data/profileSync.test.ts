import { describe, expect, it, vi } from 'vitest';
import { refreshProfile, type ProfileSource } from './profileSync';

const row = { display_name: 'Yali', time_zone: 'Asia/Tehran', updated_at: '2026-10-28T10:00:00Z' };

describe('refreshProfile', () => {
  it('copies the cloud profile onto the device', async () => {
    const saveProfile = vi.fn(async () => {});
    const source: ProfileSource = { fetchProfile: async () => row };
    expect(await refreshProfile(source, { saveProfile }, 'u1')).toBe(true);
    expect(saveProfile).toHaveBeenCalledWith({
      userId: 'u1',
      displayName: 'Yali',
      timeZone: 'Asia/Tehran',
      updatedAt: '2026-10-28T10:00:00Z',
    });
  });

  it('keeps the saved copy when offline', async () => {
    const saveProfile = vi.fn(async () => {});
    const source: ProfileSource = {
      fetchProfile: async () => {
        throw new TypeError('Failed to fetch');
      },
    };
    expect(await refreshProfile(source, { saveProfile }, 'u1')).toBe(false);
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it('does nothing when there is no profile row', async () => {
    const saveProfile = vi.fn(async () => {});
    expect(await refreshProfile({ fetchProfile: async () => null }, { saveProfile }, 'u1')).toBe(
      false,
    );
    expect(saveProfile).not.toHaveBeenCalled();
  });
});

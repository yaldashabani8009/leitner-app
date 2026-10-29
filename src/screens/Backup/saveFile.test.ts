// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveFile } from './saveFile';

const file = () => new File(['{}'], 'leitner-backup-2026-03-10.json', { type: 'application/json' });

/** Records the download link clicks instead of navigating. */
function watchDownloads() {
  vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:backup', revokeObjectURL: () => {} });
  const clicks: { href: string; download: string }[] = [];
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    clicks.push({ href: this.href, download: this.download });
  });
  return clicks;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('saveFile', () => {
  it('uses the share sheet when the device can share files', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const clicks = watchDownloads();
    expect(await saveFile(file(), { canShare: () => true, share })).toBe('saved');
    expect(share).toHaveBeenCalledWith({
      files: [expect.any(File)],
      title: 'leitner-backup-2026-03-10.json',
    });
    expect(clicks).toEqual([]);
  });

  it('reports a cancelled share sheet', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('no', 'AbortError'));
    expect(await saveFile(file(), { canShare: () => true, share })).toBe('cancelled');
  });

  it('downloads the file when sharing is not possible or fails', async () => {
    const clicks = watchDownloads();
    expect(await saveFile(file(), { share: vi.fn() })).toBe('saved');
    const share = vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError'));
    expect(await saveFile(file(), { canShare: () => true, share })).toBe('saved');
    expect(clicks).toEqual([
      { href: 'blob:backup', download: 'leitner-backup-2026-03-10.json' },
      { href: 'blob:backup', download: 'leitner-backup-2026-03-10.json' },
    ]);
  });
});

/**
 * Hands a file to the person (roadmap 7.12). On phones: the share sheet (Save to Files,
 * AirDrop, email). Elsewhere, or if sharing fails: a normal download.
 * Call it straight from a tap: iPhone Safari only allows sharing right after one.
 */

export type SaveOutcome = 'saved' | 'cancelled';

type ShareNavigator = Pick<Navigator, 'share'> & { canShare?: Navigator['canShare'] };

export async function saveFile(
  file: File,
  nav: ShareNavigator = navigator,
  doc: Document = document,
): Promise<SaveOutcome> {
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: file.name });
      return 'saved';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Sharing isn't allowed here after all: fall back to a download.
    }
  }
  const url = URL.createObjectURL(file);
  const link = doc.createElement('a');
  link.href = url;
  link.download = file.name;
  doc.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'saved';
}

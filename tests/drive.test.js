import { describe, expect, it } from 'vitest';
import { canEmbedDrive, toDrivePreviewUrl } from '../src/lib/drive.js';

describe('toDrivePreviewUrl', () => {
  it('converts Drive file links', () => {
    expect(toDrivePreviewUrl('https://drive.google.com/file/d/abc123/view?usp=sharing')).toBe(
      'https://drive.google.com/file/d/abc123/preview',
    );
  });

  it('converts open?id links', () => {
    expect(toDrivePreviewUrl('https://drive.google.com/open?id=file-id')).toBe(
      'https://drive.google.com/file/d/file-id/preview',
    );
  });

  it('converts Google Slides links', () => {
    expect(toDrivePreviewUrl('https://docs.google.com/presentation/d/deck-id/edit#slide=id.p')).toBe(
      'https://docs.google.com/presentation/d/deck-id/preview',
    );
  });

  it('rejects unsupported links', () => {
    expect(canEmbedDrive('https://example.com/file.pdf')).toBe(false);
  });
});

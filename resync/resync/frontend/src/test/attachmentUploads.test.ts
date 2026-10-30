import { describe, expect, it } from 'vitest';
import { createPdfUploadEntries, overallUploadProgress, uploadPdfEntries } from '../api/attachmentUploads';

const pdf = (name: string, content = name) => new File([content], name, { type: 'application/pdf' });

describe('PDF upload queue', () => {
  it('creates UUID idempotency tokens and rejects non-PDF and oversized selections locally', () => {
    const entries = createPdfUploadEntries([
      pdf('lecture.pdf', 'small'),
      new File(['text'], 'notes.txt', { type: 'text/plain' }),
      pdf('too-large.pdf', 'more than limit'),
    ], 10);

    expect(entries.map((entry) => entry.status)).toEqual(['queued', 'rejected', 'rejected']);
    expect(entries[0].idempotencyKey).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    expect(entries[0].key).toBe(entries[0].idempotencyKey);
    expect(entries[1].error).toContain('.pdf');
    expect(entries[2].error).toContain('upload limit');
  });

  it('measures aggregate progress only across files accepted for upload', () => {
    const entries = createPdfUploadEntries([pdf('valid.pdf', '1234'), new File(['rejected bytes'], 'invalid.txt')], 10);
    entries[0] = { ...entries[0], status: 'uploaded', progress: 1 };
    expect(overallUploadProgress(entries)).toBe(100);
  });

  it('uploads sequentially, keeps a stable retry token, and retries only failed files', async () => {
    const entries = createPdfUploadEntries([pdf('first.pdf', 'first'), pdf('second.pdf', 'second')], 100);
    const timeline: string[] = [];
    const firstToken = entries[0].idempotencyKey;
    const secondToken = entries[1].idempotencyKey;
    const firstAttempt = await uploadPdfEntries(4201, entries, async (_id, file, token, onProgress) => {
      timeline.push(`start:${file.name}`);
      expect(token).toBe(file.name === 'first.pdf' ? firstToken : secondToken);
      await Promise.resolve();
      timeline.push(`finish:${file.name}`);
      if (file.name === 'first.pdf') onProgress(0.5);
      else throw new Error('Temporary network interruption');
    }, () => undefined);

    expect(timeline).toEqual(['start:first.pdf', 'finish:first.pdf', 'start:second.pdf', 'finish:second.pdf']);
    expect(firstAttempt.map((entry) => entry.status)).toEqual(['uploaded', 'failed']);
    expect(overallUploadProgress(firstAttempt)).toBe(45);

    const retryCalls: string[] = [];
    const retried = await uploadPdfEntries(4201, firstAttempt, async (_id, file, token) => {
      retryCalls.push(file.name);
      expect(token).toBe(secondToken);
    }, () => undefined, ['failed']);

    expect(retryCalls).toEqual(['second.pdf']);
    expect(retried.map((entry) => entry.status)).toEqual(['uploaded', 'uploaded']);
    expect(retried[0].idempotencyKey).toBe(firstToken);
    expect(retried[1].idempotencyKey).toBe(secondToken);
    expect(overallUploadProgress(retried)).toBe(100);
  });
});

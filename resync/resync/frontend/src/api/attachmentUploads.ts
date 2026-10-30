import type { UploadProgressHandler } from './client';

export type PdfUploadStatus = 'queued' | 'uploading' | 'uploaded' | 'failed' | 'rejected';

export interface PdfUploadEntry {
  key: string;
  idempotencyKey: string;
  file: File;
  status: PdfUploadStatus;
  progress: number;
  error?: string;
}

function newUuid(): string {
  const source = globalThis.crypto;
  const bytes = new Uint8Array(16);
  if (source?.getRandomValues) source.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function fileIssue(file: File, maxFileSizeBytes: number): string | undefined {
  if (!file.size) return 'The selected file is empty.';
  if (file.size > maxFileSizeBytes) return `This file exceeds the ${formatBytes(maxFileSizeBytes)} upload limit.`;
  if (!file.name.toLocaleLowerCase('en').endsWith('.pdf')) return 'Choose a file with a .pdf filename.';
  if (file.type && file.type !== 'application/pdf' && file.type !== 'application/octet-stream') {
    return 'Only PDF documents can be uploaded.';
  }
  return undefined;
}

export function createPdfUploadEntries(files: File[], maxFileSizeBytes: number): PdfUploadEntry[] {
  return files.map((file) => {
    const issue = fileIssue(file, maxFileSizeBytes);
    const idempotencyKey = newUuid();
    return {
      key: idempotencyKey,
      idempotencyKey,
      file,
      status: issue ? 'rejected' : 'queued',
      progress: 0,
      ...(issue ? { error: issue } : {}),
    };
  });
}

export async function uploadPdfEntries(
  resourceId: number,
  entries: PdfUploadEntry[],
  uploadOne: (resourceId: number, file: File, idempotencyKey: string, onProgress: UploadProgressHandler) => Promise<unknown>,
  onUpdate: (entries: PdfUploadEntry[]) => void,
  eligibleStatuses: PdfUploadStatus[] = ['queued'],
): Promise<PdfUploadEntry[]> {
  let current = entries.map((entry) => ({ ...entry }));
  const publish = () => onUpdate(current.map((entry) => ({ ...entry })));

  for (let index = 0; index < current.length; index += 1) {
    if (!eligibleStatuses.includes(current[index].status)) continue;
    current[index] = { ...current[index], status: 'uploading', progress: 0, error: undefined };
    publish();
    try {
      await uploadOne(resourceId, current[index].file, current[index].idempotencyKey, (ratio) => {
        current[index] = { ...current[index], progress: Math.min(1, Math.max(0, ratio)) };
        publish();
      });
      current[index] = { ...current[index], status: 'uploaded', progress: 1, error: undefined };
    } catch (error) {
      current[index] = {
        ...current[index],
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : 'The PDF could not be uploaded. Try again.',
      };
    }
    publish();
  }
  return current;
}

export function overallUploadProgress(entries: PdfUploadEntry[]): number {
  const eligible = entries.filter((entry) => entry.status !== 'rejected');
  const total = eligible.reduce((sum, entry) => sum + entry.file.size, 0);
  if (total <= 0) return 0;
  const progressed = eligible.reduce((sum, entry) => {
    if (entry.status === 'uploaded') return sum + entry.file.size;
    if (entry.status === 'uploading') return sum + entry.file.size * entry.progress;
    return sum;
  }, 0);
  return Math.round((progressed / total) * 100);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = units[0];
  for (let index = 1; value >= 1024 && index < units.length; index += 1) {
    value /= 1024;
    unit = units[index];
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${unit}`;
}

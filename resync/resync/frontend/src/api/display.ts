import type { Resource } from './types';

export function formatTimestamp(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? fallback : new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

function compact(value: string, limit = 180) {
  const trimmed = value.trim();
  return trimmed.length > limit ? `${trimmed.slice(0, limit - 1)}…` : trimmed;
}

export function resourceMetadataSummary(resource: Resource): string {
  const fields = [
    resource.subject ? `Subject: ${resource.subject}` : null,
    `Category: ${resource.category}`,
    `Type: ${resource.resourceType}`,
    resource.academicTerm ? `Term: ${resource.academicTerm}` : null,
    resource.description ? `Description: ${compact(resource.description)}` : null,
    resource.tags.length ? `Tags: ${compact(resource.tags.join(', '))}` : null,
    resource.resourceUrl ? `URL: ${compact(resource.resourceUrl)}` : null,
    resource.resourceReference ? `Reference: ${compact(resource.resourceReference)}` : null,
  ];
  return fields.filter((field): field is string => field !== null).join(' · ');
}

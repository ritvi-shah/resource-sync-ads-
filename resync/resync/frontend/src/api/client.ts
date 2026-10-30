import type {
  AttachmentMetadata,
  AttachmentPolicy,
  ApiErrorPayload,
  Resource,
  ResourceFilters,
  ResourcePage,
  ResourceWriteRequest,
} from './types';
import {
  isAttachmentMetadata,
  isAttachmentMetadataArray,
  isAttachmentPolicy,
  isAnalyticsSummary,
  isApiErrorPayload,
  isBenchmarkReport,
  isHealthResponse,
  isPopularResourceArray,
  isRecentResourceArray,
  isResource,
  isResourceLookup,
  isResourcePage,
  isTreeMetrics,
  isTreeSnapshot,
  isVoidResponse,
  type ResponseGuard,
} from './guards';

const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim();
export const API_BASE_URL = (configuredBase || '/api').replace(/\/$/, '');

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, string>;
  readonly payload: ApiErrorPayload | null;

  constructor(
    status: number,
    code: string,
    message: string,
    details: Record<string, string> = {},
    payload: ApiErrorPayload | null = null,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.payload = payload;
  }
}

async function request<T>(path: string, init: RequestInit, guard: ResponseGuard<T>): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiClientError(0, 'NETWORK_ERROR', 'The server could not be reached. Check the connection and try again.');
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') || '';
  let body: unknown;
  try {
    body = contentType.includes('application/json') ? await response.json() : await response.text();
  } catch {
    throw new ApiClientError(response.status, 'MALFORMED_RESPONSE', 'The server returned an unreadable response.');
  }

  if (!response.ok) {
    const payload = isApiErrorPayload(body) ? body : null;
    throw new ApiClientError(
      response.status,
      payload?.code || `HTTP_${response.status}`,
      payload?.message || 'The request could not be completed.',
      payload?.details || {},
      payload,
    );
  }

  if (!contentType.includes('application/json') || !guard(body)) {
    throw new ApiClientError(response.status, 'MALFORMED_RESPONSE', 'The server returned data in an unexpected format.');
  }
  return body;
}

type QueryValue = string | number | undefined;
function queryString<T extends object>(values: T): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values) as [string, QueryValue][]) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export type UploadProgressHandler = (ratio: number) => void;

function uploadAttachment(resourceId: number, file: File, idempotencyKey: string, onProgress: UploadProgressHandler = () => undefined): Promise<AttachmentMetadata> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file, file.name);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/resources/${resourceId}/attachments`);
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Idempotency-Key', idempotencyKey);
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) onProgress(Math.min(1, Math.max(0, event.loaded / event.total)));
    });
    xhr.addEventListener('load', () => {
      const contentType = xhr.getResponseHeader('content-type') || '';
      let body: unknown;
      try {
        body = contentType.includes('application/json') ? JSON.parse(xhr.responseText) as unknown : xhr.responseText;
      } catch {
        reject(new ApiClientError(xhr.status, 'MALFORMED_RESPONSE', 'The server returned an unreadable upload response.'));
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        const payload = isApiErrorPayload(body) ? body : null;
        reject(new ApiClientError(
          xhr.status,
          payload?.code || `HTTP_${xhr.status}`,
          payload?.message || 'The PDF upload could not be completed.',
          payload?.details || {},
          payload,
        ));
        return;
      }
      if (!contentType.includes('application/json') || !isAttachmentMetadata(body)) {
        reject(new ApiClientError(xhr.status, 'MALFORMED_RESPONSE', 'The server returned attachment data in an unexpected format.'));
        return;
      }
      onProgress(1);
      resolve(body);
    });
    xhr.addEventListener('error', () => reject(new ApiClientError(0, 'NETWORK_ERROR', 'The server could not be reached. Check the connection and try again.')));
    xhr.addEventListener('abort', () => reject(new ApiClientError(0, 'UPLOAD_CANCELLED', 'The PDF upload was cancelled.')));
    xhr.send(form);
  });
}

async function checkAttachmentContent(resourceId: number, attachmentId: number): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/resources/${resourceId}/attachments/${attachmentId}/content`, {
      method: 'HEAD',
      headers: { Accept: 'application/pdf' },
    });
  } catch {
    throw new ApiClientError(0, 'NETWORK_ERROR', 'The server could not be reached. Check the connection and try again.');
  }
  if (!response.ok) {
    const missing = response.status === 404;
    throw new ApiClientError(
      response.status,
      missing ? 'ATTACHMENT_FILE_MISSING' : `HTTP_${response.status}`,
      missing ? 'The attached PDF is no longer available in local storage.' : 'The attached PDF could not be checked.',
    );
  }
  if (!(response.headers.get('content-type') || '').includes('application/pdf')) {
    throw new ApiClientError(response.status, 'MALFORMED_RESPONSE', 'The server did not identify the attachment as a PDF.');
  }
}

export const api = {
  health: () => request('/health', {}, isHealthResponse),
  listResources: (filters: ResourceFilters = {}) =>
    request<ResourcePage>(`/resources${queryString(filters)}`, {}, isResourcePage),
  searchResources: (q: string, filters: Pick<ResourceFilters, 'category' | 'type'> = {}, limit = 50) =>
    request<ResourcePage>(`/resources/search${queryString({ q, ...filters, limit })}`, {}, isResourcePage),
  getResource: (id: number) => request(`/resources/${id}`, {}, isResourceLookup),
  createResource: (resource: ResourceWriteRequest) =>
    request<Resource>('/resources', { method: 'POST', body: JSON.stringify(resource) }, isResource),
  updateResource: (id: number, resource: ResourceWriteRequest) =>
    request<Resource>(`/resources/${id}`, { method: 'PUT', body: JSON.stringify(resource) }, isResource),
  deleteResource: (id: number) =>
    request<void>(`/resources/${id}`, { method: 'DELETE' }, isVoidResponse),
  getAttachmentPolicy: () => request<AttachmentPolicy>('/attachments/policy', {}, isAttachmentPolicy),
  getAttachments: (resourceId: number) => request<AttachmentMetadata[]>(`/resources/${resourceId}/attachments`, {}, isAttachmentMetadataArray),
  uploadAttachment,
  checkAttachmentContent,
  deleteAttachment: (resourceId: number, attachmentId: number) =>
    request<void>(`/resources/${resourceId}/attachments/${attachmentId}`, { method: 'DELETE' }, isVoidResponse),
  attachmentContentUrl: (resourceId: number, attachmentId: number) =>
    `${API_BASE_URL}/resources/${resourceId}/attachments/${attachmentId}/content`,
  attachmentDownloadUrl: (resourceId: number, attachmentId: number) =>
    `${API_BASE_URL}/resources/${resourceId}/attachments/${attachmentId}/download`,
  getPopular: (limit = 10) =>
    request(`/resources/popular${queryString({ limit })}`, {}, isPopularResourceArray),
  getRecent: (limit = 20) =>
    request(`/resources/recent${queryString({ limit })}`, {}, isRecentResourceArray),
  getSummary: () => request('/analytics/summary', {}, isAnalyticsSummary),
  getBenchmarks: () => request('/analytics/benchmarks', {}, isBenchmarkReport),
  getTree: () => request('/dsa/splay-tree', {}, isTreeSnapshot),
  getTreeMetrics: () => request('/dsa/splay-tree/metrics', {}, isTreeMetrics),
};

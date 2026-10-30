import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, api } from '../api/client';

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe('typed API client', () => {
  it('uses relative same-origin API paths and URL-encodes metadata search', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ items: [], page: 0, size: 50, totalElements: 0, totalPages: 0 }));
    await api.searchResources('database & lab');
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/resources/search?q=database+%26+lab&limit=50');
  });

  it('preserves structured 404 search metrics without leaking stack traces', async () => {
    const payload = {
      code: 'RESOURCE_NOT_FOUND',
      message: 'Resource 9999 was not found.',
      details: {},
      timestamp: '2026-10-10T09:10:00Z',
      searchMetrics: { resourceId: 9999, found: false, comparisons: 2, searchDepth: 1, rotations: 1, rootAfterSearch: 1001, searchedAt: '2026-10-10T09:10:00Z' },
    };
    fetchMock.mockResolvedValue(jsonResponse(payload, 404));
    await expect(api.getResource(9999)).rejects.toMatchObject({ status: 404, code: 'RESOURCE_NOT_FOUND', payload });
  });

  it('returns a safe error when the backend response is malformed JSON', async () => {
    fetchMock.mockResolvedValue(new Response('{invalid', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    await expect(api.health()).rejects.toBeInstanceOf(ApiClientError);
    await expect(api.health()).rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' });
  });

  it('rejects valid JSON whose shape does not match the requested DTO', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ resourceCount: 'seven', popularResources: null }));
    await expect(api.getSummary()).rejects.toMatchObject({ status: 200, code: 'MALFORMED_RESPONSE' });
  });

  it('surfaces persistence-unavailable responses as safe typed service errors', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      code: 'PERSISTENCE_UNAVAILABLE',
      message: 'The catalogue is temporarily unavailable.',
      details: {},
      timestamp: '2026-10-10T09:10:00Z',
      searchMetrics: null,
    }, 503));
    await expect(api.getSummary()).rejects.toMatchObject({
      status: 503,
      code: 'PERSISTENCE_UNAVAILABLE',
      message: 'The catalogue is temporarily unavailable.',
    });
  });

  it('sends the upload idempotency key and reports XHR progress', async () => {
    const metadata = {
      id: 4,
      resourceId: 1201,
      originalFilename: 'notes.pdf',
      sizeBytes: 4,
      contentType: 'application/pdf',
      uploadedAt: '2026-10-20T00:00:00Z',
    };
    const listeners: Record<string, (event?: Event) => void> = {};
    let progressListener: ((event: ProgressEvent) => void) | undefined;
    const xhr = {
      upload: { addEventListener: vi.fn((_name: string, callback: EventListenerOrEventListenerObject) => {
        if (typeof callback === 'function') progressListener = callback as (event: ProgressEvent) => void;
      }) },
      open: vi.fn(),
      setRequestHeader: vi.fn(),
      addEventListener: vi.fn((name: string, callback: EventListenerOrEventListenerObject) => {
        if (typeof callback === 'function') listeners[name] = callback as (event?: Event) => void;
      }),
      getResponseHeader: vi.fn(() => 'application/json'),
      send: vi.fn(() => {
        progressListener?.({ lengthComputable: true, loaded: 50, total: 100 } as ProgressEvent);
        listeners.load?.(new Event('load'));
      }),
      status: 201,
      responseText: JSON.stringify(metadata),
    };
    vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr));
    const progress = vi.fn();
    const token = '123e4567-e89b-42d3-a456-426614174000';

    await expect(api.uploadAttachment(1201, new File(['data'], 'notes.pdf', { type: 'application/pdf' }), token, progress))
      .resolves.toMatchObject({ id: 4, originalFilename: 'notes.pdf' });

    expect(xhr.open).toHaveBeenCalledWith('POST', '/api/resources/1201/attachments');
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Idempotency-Key', token);
    expect(progress).toHaveBeenNthCalledWith(1, 0.5);
    expect(progress).toHaveBeenLastCalledWith(1);
  });
});

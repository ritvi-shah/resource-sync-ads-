import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AttachmentMetadata } from '../api/types';
import DocumentAttachments from '../components/DocumentAttachments';

const resourceId = 4201;
const policy = { maxFileSizeBytes: 1024 * 1024, contentType: 'application/pdf', maxFilesPerRequest: 1 };
let attachments: AttachmentMetadata[];
let attachmentsByToken: Map<string, AttachmentMetadata>;
let simulatedLostResponseTokens: Set<string>;
let nextAttachmentId: number;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let xhrRequests: Array<{ filename: string; token: string }>;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

class FakeXhr {
  uploadListeners = new Map<string, EventListenerOrEventListenerObject>();
  listeners = new Map<string, EventListenerOrEventListenerObject>();
  headers: Record<string, string> = {};
  method = '';
  url = '';
  status = 0;
  responseText = '';
  upload = {
    addEventListener: (name: string, listener: EventListenerOrEventListenerObject | null) => {
      if (listener) this.uploadListeners.set(name, listener);
    },
  };

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }

  addEventListener(name: string, listener: EventListenerOrEventListenerObject | null) {
    if (listener) this.listeners.set(name, listener);
  }

  getResponseHeader(name: string) {
    return name.toLowerCase() === 'content-type' ? 'application/json' : null;
  }

  private emit(target: Map<string, EventListenerOrEventListenerObject>, name: string, event: Event) {
    const listener = target.get(name);
    if (typeof listener === 'function') listener.call(this, event);
    else listener?.handleEvent(event);
  }

  send(body: FormData) {
    const file = body.get('file');
    if (!(file instanceof File)) throw new Error('Expected the multipart file field.');
    const token = this.headers['Idempotency-Key'];
    xhrRequests.push({ filename: file.name, token });

    let metadata = attachmentsByToken.get(token);
    const wasPreviouslyStored = Boolean(metadata);
    if (!metadata) {
      metadata = {
        id: nextAttachmentId++,
        resourceId,
        originalFilename: file.name,
        sizeBytes: file.size,
        contentType: 'application/pdf',
        uploadedAt: '2026-10-20T00:00:00Z',
      };
      attachmentsByToken.set(token, metadata);
      attachments.push(metadata);
    }

    this.emit(this.uploadListeners, 'progress', { lengthComputable: true, loaded: file.size, total: file.size } as ProgressEvent);

    // The server stored this second file, but the first response was lost. The retry must
    // reuse the same token and return the original metadata instead of creating a duplicate.
    if (file.name === 'slides.pdf' && !simulatedLostResponseTokens.has(token)) {
      simulatedLostResponseTokens.add(token);
      this.emit(this.listeners, 'error', new Event('error'));
      return;
    }

    this.status = wasPreviouslyStored ? 200 : 201;
    this.responseText = JSON.stringify(metadata);
    this.emit(this.listeners, 'load', new Event('load'));
  }
}

function withClient(element: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>;
}

beforeEach(() => {
  attachments = [];
  attachmentsByToken = new Map();
  simulatedLostResponseTokens = new Set();
  nextAttachmentId = 1;
  xhrRequests = [];
  fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = new URL(String(input), 'http://campus.test');
    const method = init?.method ?? 'GET';
    if (url.pathname === '/api/attachments/policy' && method === 'GET') return jsonResponse(policy);
    if (url.pathname === `/api/resources/${resourceId}/attachments` && method === 'GET') return jsonResponse([...attachments]);
    if (/^\/api\/resources\/4201\/attachments\/\d+\/content$/.test(url.pathname) && method === 'HEAD') {
      return new Response(null, { status: 200, headers: { 'Content-Type': 'application/pdf' } });
    }
    throw new Error(`Unexpected fetch: ${method} ${url.pathname}`);
  });
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('XMLHttpRequest', FakeXhr);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PDF attachment manager', () => {
  it('uploads sequentially, retries an accepted-but-unacknowledged PDF with the same key, and opens the real attachment URL', async () => {
    const user = userEvent.setup();
    render(withClient(<DocumentAttachments resourceId={resourceId} />));

    expect(await screen.findByText('No PDFs attached yet')).toBeInTheDocument();
    const fileInput = screen.getByLabelText(/select pdf files/i) as HTMLInputElement;
    const notes = new File(['0123456789'], 'notes.pdf', { type: 'application/pdf' });
    const slides = new File(['abcdefghij'], 'slides.pdf', { type: 'application/pdf' });
    fireEvent.change(fileInput, { target: { files: [notes, slides] } });

    await user.click(screen.getByRole('button', { name: 'Upload 2 PDFs' }));
    expect(await screen.findByRole('button', { name: 'Retry 1 failed PDF' })).toBeInTheDocument();
    expect(await screen.findByTitle('PDF document: notes.pdf')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 uploaded')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Overall PDF upload progress' })).toHaveProperty('value', 50);

    const initialNotesRequests = xhrRequests.filter((request) => request.filename === 'notes.pdf');
    const initialSlidesRequests = xhrRequests.filter((request) => request.filename === 'slides.pdf');
    expect(initialNotesRequests).toHaveLength(1);
    expect(initialSlidesRequests).toHaveLength(1);
    expect(attachments).toHaveLength(2); // The server accepted both despite the lost second response.

    await user.click(screen.getByRole('button', { name: 'Retry 1 failed PDF' }));
    expect(await screen.findByText('2 of 2 uploaded')).toBeInTheDocument();
    expect(await screen.findAllByText('slides.pdf')).toHaveLength(2);
    expect(await screen.findByTitle('PDF document: notes.pdf')).toBeInTheDocument();

    const retriedSlidesRequests = xhrRequests.filter((request) => request.filename === 'slides.pdf');
    expect(retriedSlidesRequests).toHaveLength(2);
    expect(retriedSlidesRequests[0].token).toBe(retriedSlidesRequests[1].token);
    expect(xhrRequests.filter((request) => request.filename === 'notes.pdf')).toHaveLength(1);
    expect(attachments).toHaveLength(2);
    expect(screen.getByTitle('PDF document: notes.pdf')).toHaveAttribute(
      'src',
      '/api/resources/4201/attachments/1/content',
    );
    await waitFor(() => expect(fetchMock.mock.calls.some(([input, init]) =>
      String(input) === '/api/resources/4201/attachments/1/content' && init?.method === 'HEAD',
    )).toBe(true));
  });
});

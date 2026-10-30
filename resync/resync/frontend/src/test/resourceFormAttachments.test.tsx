import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ResourceFormPage from '../pages/ResourceFormPage';
import type { Resource } from '../api/types';

const policy = { maxFileSizeBytes: 20 * 1024 * 1024, contentType: 'application/pdf', maxFilesPerRequest: 1 };
const sequence: string[] = [];
let uploadFailureNames = new Set<string>();
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;

const page = {
  items: [resource(1007, 'Highest ID')],
  page: 0,
  size: 1,
  totalElements: 1,
  totalPages: 1,
};

function resource(id: number, title: string): Resource {
  return {
    id,
    title,
    description: '',
    category: 'Lecture Notes',
    resourceType: 'Study Material',
    subject: '',
    academicTerm: '',
    resourceUrl: null,
    resourceReference: null,
    tags: [],
    createdAt: '2026-10-20T00:00:00Z',
    updatedAt: '2026-10-20T00:00:00Z',
    sample: false,
    accessCount: 0,
    lastAccessed: null,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

class UploadXhr {
  static requests: Array<{ filename: string; key: string; hasFilePart: boolean }> = [];
  uploadListeners = new Map<string, EventListenerOrEventListenerObject>();
  listeners = new Map<string, EventListenerOrEventListenerObject>();
  headers: Record<string, string> = {};
  status = 0;
  responseText = '';
  upload = {
    addEventListener: (name: string, listener: EventListenerOrEventListenerObject | null) => {
      if (listener) this.uploadListeners.set(name, listener);
    },
  };

  open(_method: string, url: string) {
    expect(url).toBe('/api/resources/1008/attachments');
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
    if (!(file instanceof File)) throw new Error('Upload must use the existing multipart field named file.');
    sequence.push(`upload:${file.name}`);
    UploadXhr.requests.push({ filename: file.name, key: this.headers['Idempotency-Key'], hasFilePart: file instanceof File });
    this.emit(this.uploadListeners, 'progress', { lengthComputable: true, loaded: file.size, total: file.size } as ProgressEvent);
    if (uploadFailureNames.has(file.name)) {
      uploadFailureNames.delete(file.name);
      this.emit(this.listeners, 'error', new Event('error'));
      return;
    }
    this.status = 201;
    this.responseText = JSON.stringify({
      id: UploadXhr.requests.length,
      resourceId: 1008,
      originalFilename: file.name,
      sizeBytes: file.size,
      contentType: 'application/pdf',
      uploadedAt: '2026-10-20T00:00:00Z',
    });
    this.emit(this.listeners, 'load', new Event('load'));
  }
}

function withClient(element: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queryClient.setQueryData(['attachments', 'policy'], policy);
  return <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>;
}

function Destination() {
  const location = useLocation();
  const state = location.state as { notice?: string; retryUploads?: Array<{ file: File }> } | null;
  return <div role="status" data-testid="destination">{JSON.stringify({ path: location.pathname, ...state, retryUploads: state?.retryUploads?.map(({ file }) => file.name) ?? [] })}</div>;
}

function renderCreateForm() {
  return render(withClient(
    <MemoryRouter initialEntries={['/resources/new']}>
      <Routes>
        <Route path="/resources/new" element={<ResourceFormPage />} />
        <Route path="/resources/:id" element={<Destination />} />
        <Route path="/resources" element={<Destination />} />
      </Routes>
    </MemoryRouter>,
  ));
}

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/title/i), 'Resource with PDF documents');
  await user.type(screen.getByLabelText(/^category/i), 'Course Material');
  await user.type(screen.getByLabelText(/resource type/i), 'Lecture Notes');
}

beforeEach(() => {
  sequence.length = 0;
  UploadXhr.requests = [];
  uploadFailureNames = new Set();
  vi.stubGlobal('XMLHttpRequest', UploadXhr);
  fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const path = String(input);
    if (path.startsWith('/api/resources?') && (init?.method ?? 'GET') === 'GET') return jsonResponse(page);
    if (path === '/api/resources' && init?.method === 'POST') {
      sequence.push('create');
      return jsonResponse(resource(1008, 'Resource with PDF documents'), 201);
    }
    throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${path}`);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('resource creation with PDF attachments', () => {
  it('creates the resource before uploading a single selected PDF and navigates to its returned ID', async () => {
    const user = userEvent.setup();
    renderCreateForm();
    await fillRequiredFields(user);
    fireEvent.change(screen.getByLabelText(/select pdfs/i), {
      target: { files: [new File(['%PDF-one'], 'notes.pdf', { type: 'application/pdf' })] },
    });
    expect(await screen.findByText('notes.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add resource/i }));

    expect(await screen.findByTestId('destination')).toHaveTextContent('/resources/1008');
    expect(sequence).toEqual(['create', 'upload:notes.pdf']);
    expect(UploadXhr.requests).toHaveLength(1);
    expect(UploadXhr.requests[0]).toMatchObject({ filename: 'notes.pdf', hasFilePart: true });
    expect(UploadXhr.requests[0].key).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it('uploads multiple PDFs sequentially and keeps a partial failure available for retry without recreating the resource', async () => {
    const user = userEvent.setup();
    uploadFailureNames = new Set(['slides.pdf']);
    renderCreateForm();
    await fillRequiredFields(user);
    fireEvent.change(screen.getByLabelText(/select pdfs/i), {
      target: { files: [
        new File(['%PDF-notes'], 'notes.pdf', { type: 'application/pdf' }),
        new File(['%PDF-slides'], 'slides.pdf', { type: 'application/pdf' }),
      ] },
    });
    expect(await screen.findByText('notes.pdf')).toBeInTheDocument();
    expect(screen.getByText('slides.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add resource/i }));

    const destination = await screen.findByTestId('destination');
    await waitFor(() => expect(destination).toHaveTextContent('1 PDF uploaded. 1 file need a retry; successful uploads were kept.'));
    expect(destination).toHaveTextContent('"retryUploads":["slides.pdf"]');
    expect(sequence).toEqual(['create', 'upload:notes.pdf', 'upload:slides.pdf']);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
    expect(UploadXhr.requests.map((request) => request.filename)).toEqual(['notes.pdf', 'slides.pdf']);
    expect(UploadXhr.requests.every((request) => request.hasFilePart && /^[0-9a-f-]{36}$/i.test(request.key))).toBe(true);
  });

  it('retains selected PDFs and does not upload them when resource metadata creation fails', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input);
      if (path.startsWith('/api/resources?') && (init?.method ?? 'GET') === 'GET') return jsonResponse(page);
      if (path === '/api/resources' && init?.method === 'POST') {
        sequence.push('create');
        return jsonResponse({ code: 'PERSISTENCE_UNAVAILABLE', message: 'The data store could not complete the request.', details: {}, timestamp: '2026-10-20T00:00:00Z', searchMetrics: null }, 503);
      }
      throw new Error(`Unexpected request: ${init?.method ?? 'GET'} ${path}`);
    });
    const user = userEvent.setup();
    renderCreateForm();
    await fillRequiredFields(user);
    fireEvent.change(screen.getByLabelText(/select pdfs/i), {
      target: { files: [new File(['%PDF-kept'], 'keep-for-retry.pdf', { type: 'application/pdf' })] },
    });
    expect(await screen.findByText('keep-for-retry.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /add resource/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The data store could not complete the request.');
    expect(screen.getByText('keep-for-retry.pdf')).toBeInTheDocument();
    expect(sequence).toEqual(['create']);
    expect(UploadXhr.requests).toHaveLength(0);
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === 'POST')).toHaveLength(1);
  });
});
